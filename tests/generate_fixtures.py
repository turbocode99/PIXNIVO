import os
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from PIL import Image
from docx import Document
from pptx import Presentation
from pptx.util import Inches, Pt
from openpyxl import Workbook
from pypdf import PdfWriter, PdfReader

FIXTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures"))
os.makedirs(FIXTURES_DIR, exist_ok=True)

# 1. Two-page PDF
p2_path = os.path.join(FIXTURES_DIR, "two_page.pdf")
c = canvas.Canvas(p2_path, pagesize=letter)
c.setFont("Helvetica-Bold", 18)
c.drawString(100, 750, "Pixnivo Test Document - Page 1")
c.setFont("Helvetica", 12)
c.drawString(100, 720, "This is the first page of a verified two-page PDF.")
c.drawString(100, 700, "Content: Architecture overview and system metrics.")
c.showPage()
c.setFont("Helvetica-Bold", 18)
c.drawString(100, 750, "Pixnivo Test Document - Page 2")
c.setFont("Helvetica", 12)
c.drawString(100, 720, "This is the second page of the verified two-page PDF.")
c.drawString(100, 700, "Content: Financial calculations and summary.")
c.showPage()
c.save()
print("Generated two_page.pdf")

# 2. Ten-page PDF
p10_path = os.path.join(FIXTURES_DIR, "ten_page.pdf")
c = canvas.Canvas(p10_path, pagesize=letter)
for i in range(1, 11):
    c.setFont("Helvetica-Bold", 18)
    c.drawString(100, 750, f"Pixnivo Multi-Page Report - Section {i}")
    c.setFont("Helvetica", 12)
    c.drawString(100, 720, f"Detailed report page {i} of 10. Designed for split, merge, and page number verification.")
    c.drawString(100, 700, f"Key metric: Value_{i * 100} units.")
    c.drawString(100, 680, f"Audit tag: CHECKPOINT_ALPHA_{i}")
    c.showPage()
c.save()
print("Generated ten_page.pdf")

# 3. Sample JPG and PNG images
img_jpg_path = os.path.join(FIXTURES_DIR, "sample.jpg")
img_png_path = os.path.join(FIXTURES_DIR, "sample.png")
im1 = Image.new("RGB", (600, 400), color=(207, 74, 12))
im1.save(img_jpg_path, format="JPEG", quality=90)
im2 = Image.new("RGB", (600, 400), color=(30, 41, 59))
im2.save(img_png_path, format="PNG")
print("Generated sample.jpg and sample.png")

# 4. PDF with images
p_img_path = os.path.join(FIXTURES_DIR, "pdf_with_images.pdf")
c = canvas.Canvas(p_img_path, pagesize=letter)
c.setFont("Helvetica-Bold", 16)
c.drawString(100, 750, "Document with Embedded Image")
c.drawImage(img_jpg_path, 100, 400, width=300, height=200)
c.showPage()
c.save()
print("Generated pdf_with_images.pdf")

# 5. Protected PDF
p_prot_path = os.path.join(FIXTURES_DIR, "protected.pdf")
r = PdfReader(p2_path)
w = PdfWriter()
for p in r.pages:
    w.add_page(p)
w.encrypt("PixnivoSecret2026")
with open(p_prot_path, "wb") as f:
    w.write(f)
print("Generated protected.pdf (password: PixnivoSecret2026)")

# 6. Sample DOCX
docx_path = os.path.join(FIXTURES_DIR, "sample.docx")
doc = Document()
doc.add_heading("Pixnivo Word Document", level=1)
doc.add_paragraph("This is a verified test document in Microsoft Word DOCX format.")
doc.add_paragraph("Bullet point item 1", style="List Bullet")
doc.add_paragraph("Bullet point item 2", style="List Bullet")
doc.save(docx_path)
print("Generated sample.docx")

# 7. Sample PPTX
pptx_path = os.path.join(FIXTURES_DIR, "sample.pptx")
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "Pixnivo Presentation"
slide.placeholders[1].text = "Slide subtitle with verified text"
prs.save(pptx_path)
print("Generated sample.pptx")

# 8. Sample XLSX
xlsx_path = os.path.join(FIXTURES_DIR, "sample.xlsx")
wb = Workbook()
ws = wb.active
ws.title = "Financials"
ws.append(["Item", "Q1", "Q2", "Total"])
ws.append(["Cloud Hosting", 500, 550, 1050])
ws.append(["CDN Bandwidth", 200, 250, 450])
wb.save(xlsx_path)
print("Generated sample.xlsx")

# 9. Invalid text file
inv_path = os.path.join(FIXTURES_DIR, "invalid.txt")
with open(inv_path, "w", encoding="utf-8") as f:
    f.write("This is a plain text file, not a PDF.")
print("Generated invalid.txt")

