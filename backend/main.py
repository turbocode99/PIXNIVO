import os
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_enable_pir_in_executor'] = '0'
import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
import base64
from io import BytesIO
from fastapi.responses import Response
from docx import Document
from docx.shared import Inches
import openpyxl
from openpyxl.drawing.image import Image as OpenpyxlImage
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

class BarcodeImage(BaseModel):
    text: str
    base64_data: str

class ExportRequest(BaseModel):
    format: str
    images: List[BarcodeImage]
from paddleocr import PaddleOCR
from pdf2image import convert_from_path
from PIL import Image, ImageOps, ImageEnhance
import pillow_heif
pillow_heif.register_heif_opener()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

print('Initializing PaddleOCR...')
ocr_engine = PaddleOCR(use_angle_cls=True, use_gpu=False, lang='en')
print('PaddleOCR ready!')

@app.get('/api/health')
def health_check():
    return {'status': 'ok'}

@app.post('/api/ocr')
async def process_ocr(file: UploadFile = File(...), enhance: str = Form('none')):
    if not file:
        raise HTTPException(status_code=400, detail='No file provided')
        
    filename = file.filename or 'upload'
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = os.path.join(temp_dir, filename)
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        full_text = ''
        
        try:
            # Detect if file is PDF
            is_pdf = (ext == 'pdf')
            if not is_pdf:
                try:
                    with open(file_path, 'rb') as f_chk:
                        if f_chk.read(5).startswith(b'%PDF-'):
                            is_pdf = True
                except:
                    pass

            if is_pdf:
                images = convert_from_path(file_path)
                for i, img in enumerate(images):
                    img = ImageOps.exif_transpose(img)
                    if max(img.size) > 2400:
                        img.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
                    if enhance == 'auto':
                        img = ImageEnhance.Contrast(img).enhance(1.4)
                        
                    img_path = os.path.join(temp_dir, f'page_{i}.jpg')
                    img.convert('RGB').save(img_path, 'JPEG', quality=95)
                    
                    result = ocr_engine.ocr(img_path, cls=True)
                    for res in result:
                        if res:
                            for line in res:
                                full_text += line[1][0] + '\n'
                    full_text += '\n--- Page Break ---\n\n'
            else:
                # Universal image processing: HEIC, HEIF, JPG, PNG, WEBP, BMP, AVIF, TIFF
                try:
                    img = Image.open(file_path)
                except Exception as img_err:
                    raise HTTPException(status_code=400, detail=f'Unable to decode image file: {str(img_err)}')

                # Crucial for phone photos: automatically rotate image based on EXIF tag (portrait/landscape)
                img = ImageOps.exif_transpose(img)

                # Downscale giant phone photos (e.g. 12MP - 48MP) to max 2400px edge for fast, reliable OCR
                if max(img.size) > 2400:
                    img.thumbnail((2400, 2400), Image.Resampling.LANCZOS)

                if enhance == 'auto':
                    img = ImageEnhance.Contrast(img).enhance(1.4)

                norm_path = os.path.join(temp_dir, 'normalized_input.jpg')
                img.convert('RGB').save(norm_path, 'JPEG', quality=95)

                result = ocr_engine.ocr(norm_path, cls=True)
                for res in result:
                    if res:
                        for line in res:
                            full_text += line[1][0] + '\n'
                            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    if not full_text.strip():
        full_text = 'No text could be detected.'
        
    return {'text': full_text}





@app.post('/api/export-barcodes')
async def export_barcodes(req: ExportRequest):
    if req.format not in ['pdf', 'docx', 'xlsx']:
        raise HTTPException(status_code=400, detail='Invalid format')
        
    if not req.images:
        raise HTTPException(status_code=400, detail='No images provided')
        
    if req.format == 'docx':
        doc = Document()
        doc.add_heading('Generated Barcodes', 0)
        table = doc.add_table(rows=1, cols=2)
        table.autofit = True
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Data'
        hdr_cells[1].text = 'Barcode'
        
        for item in req.images:
            row_cells = table.add_row().cells
            row_cells[0].text = item.text
            
            # Decode base64 (strip data:image/png;base64, if present)
            b64_str = item.base64_data.split(',')[-1]
            img_data = base64.b64decode(b64_str)
            img_stream = BytesIO(img_data)
            
            p = row_cells[1].paragraphs[0]
            r = p.add_run()
            try:
                r.add_picture(img_stream, width=Inches(2.0))
            except:
                pass
                
        output = BytesIO()
        doc.save(output)
        return Response(content=output.getvalue(), media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        
    elif req.format == 'xlsx':
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Barcodes"
        ws.cell(row=1, column=1, value="Data")
        ws.cell(row=1, column=2, value="Barcode")
        
        ws.column_dimensions['A'].width = 25
        ws.column_dimensions['B'].width = 40
        
        for idx, item in enumerate(req.images, start=2):
            ws.cell(row=idx, column=1, value=item.text)
            
            b64_str = item.base64_data.split(',')[-1]
            img_data = base64.b64decode(b64_str)
            img_stream = BytesIO(img_data)
            
            try:
                img = OpenpyxlImage(img_stream)
                # Resize slightly if too big
                img.width = 150
                img.height = int(img.height * (150 / img.width))
                ws.add_image(img, f"B{idx}")
                ws.row_dimensions[idx].height = img.height * 0.75 # Adjust row height
            except:
                pass
                
        output = BytesIO()
        wb.save(output)
        return Response(content=output.getvalue(), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        
    elif req.format == 'pdf':
        output = BytesIO()
        c = canvas.Canvas(output, pagesize=letter)
        width, height = letter
        
        y_pos = height - 50
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y_pos, "Generated Barcodes")
        y_pos -= 50
        
        for item in req.images:
            b64_str = item.base64_data.split(',')[-1]
            img_data = base64.b64decode(b64_str)
            img_stream = BytesIO(img_data)
            
            # Using PIL to get dimensions safely
            pil_img = Image.open(img_stream)
            img_w, img_h = pil_img.size
            
            # Scale to max 250 width
            draw_w = min(250, img_w)
            draw_h = img_h * (draw_w / img_w)
            
            if y_pos - draw_h - 20 < 50:
                c.showPage()
                y_pos = height - 50
                
            c.setFont("Helvetica", 12)
            c.drawString(50, y_pos - 15, item.text)
            
            # Need to rewind stream for reportlab
            img_stream.seek(0)
            from reportlab.lib.utils import ImageReader
            rl_img = ImageReader(img_stream)
            c.drawImage(rl_img, 50, y_pos - draw_h - 20, width=draw_w, height=draw_h)
            
            y_pos -= (draw_h + 50)
            
        c.save()
        return Response(content=output.getvalue(), media_type='application/pdf')
