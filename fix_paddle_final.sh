cd /opt/pixnivo-backend
sudo ./venv/bin/pip uninstall -y paddlepaddle paddleocr numpy scipy
sudo ./venv/bin/pip install paddlepaddle paddleocr
sudo ./venv/bin/pip install "numpy<2.0.0"

cat << 'EOF' > /opt/pixnivo-backend/main.py
import os
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_enable_pir_in_executor'] = '0'
import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from paddleocr import PaddleOCR
from pdf2image import convert_from_path
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

print('Initializing PaddleOCR...')
ocr_engine = PaddleOCR(use_textline_orientation=True, use_gpu=False, lang='en')
print('PaddleOCR ready!')

@app.get('/api/health')
def health_check():
    return {'status': 'ok'}

@app.post('/api/ocr')
async def process_ocr(file: UploadFile = File(...), enhance: str = Form('none')):
    if not file:
        raise HTTPException(status_code=400, detail='No file provided')
        
    ext = file.filename.split('.')[-1].lower()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = os.path.join(temp_dir, file.filename)
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        full_text = ''
        
        try:
            if ext == 'pdf':
                images = convert_from_path(file_path)
                for i, img in enumerate(images):
                    img_path = os.path.join(temp_dir, f'page_{i}.jpg')
                    img.save(img_path, 'JPEG')
                    
                    result = ocr_engine.ocr(img_path, )
                    for res in result:
                        if res:
                            for line in res:
                                full_text += line[1][0] + '\n'
                    full_text += '\n--- Page Break ---\n\n'
            else:
                result = ocr_engine.ocr(file_path, )
                for res in result:
                    if res:
                        for line in res:
                            full_text += line[1][0] + '\n'
                            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    if not full_text.strip():
        full_text = 'No text could be detected.'
        
    return {'text': full_text}




EOF

sudo systemctl restart pixnivo-ocr
