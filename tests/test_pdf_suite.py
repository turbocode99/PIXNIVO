import sys
import io
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from pdf.services.conversion_service import ConversionService
from pdf.services.security_service import SecurityService
from pdf.services.advanced_service import AdvancedService


class TestPdfSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Generate sample PDF with text and structure
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(100, 750, "Pixnivo Financial Report 2026")
        c.setFont("Helvetica", 12)
        c.drawString(100, 720, "Confidential Document — User Danish Khan")
        c.drawString(100, 700, "Secret Key: CLASSIFIED_TOKEN_998877")
        c.drawString(100, 670, "Summary of operations:")
        c.drawString(120, 650, "• Revenue grew by 45% year-over-year")
        c.drawString(120, 630, "• Gross margins maintained at 82%")
        c.drawString(100, 590, "Item\tQ1\tQ2\tTotal")
        c.drawString(100, 570, "Subscriptions\t1200\t1500\t2700")
        c.showPage()
        c.save()
        cls.sample_pdf = buf.getvalue()

    def test_01_pdf_to_docx(self):
        docx_bytes = ConversionService.pdf_to_docx(self.sample_pdf)
        self.assertGreater(len(docx_bytes), 500)
        self.assertTrue(docx_bytes.startswith(b'PK')) # standard zip format for docx

    def test_02_pdf_to_pptx(self):
        pptx_bytes = ConversionService.pdf_to_pptx(self.sample_pdf)
        self.assertGreater(len(pptx_bytes), 500)
        self.assertTrue(pptx_bytes.startswith(b'PK')) # standard zip format for pptx

    def test_03_pdf_to_xlsx(self):
        xlsx_bytes = ConversionService.pdf_to_xlsx(self.sample_pdf)
        self.assertGreater(len(xlsx_bytes), 500)
        self.assertTrue(xlsx_bytes.startswith(b'PK')) # standard zip format for xlsx

    def test_04_docx_to_pdf(self):
        docx_bytes = ConversionService.pdf_to_docx(self.sample_pdf)
        pdf_out = ConversionService.docx_to_pdf(docx_bytes)
        self.assertGreater(len(pdf_out), 200)
        self.assertTrue(pdf_out.startswith(b'%PDF-'))

    def test_05_pptx_to_pdf(self):
        pptx_bytes = ConversionService.pdf_to_pptx(self.sample_pdf)
        pdf_out = ConversionService.pptx_to_pdf(pptx_bytes)
        self.assertGreater(len(pdf_out), 200)
        self.assertTrue(pdf_out.startswith(b'%PDF-'))

    def test_06_xlsx_to_pdf(self):
        xlsx_bytes = ConversionService.pdf_to_xlsx(self.sample_pdf)
        pdf_out = ConversionService.xlsx_to_pdf(xlsx_bytes)
        self.assertGreater(len(pdf_out), 200)
        self.assertTrue(pdf_out.startswith(b'%PDF-'))

    def test_07_pdf_to_markdown(self):
        md = ConversionService.pdf_to_markdown(self.sample_pdf)
        self.assertIn("Pixnivo Financial Report", md)
        self.assertIn("Revenue grew", md)

    def test_08_html_to_pdf(self):
        html = "<h1>Company Overview</h1><p>This is a paragraph with <b>bold text</b>.</p><li>Item 1</li><li>Item 2</li>"
        pdf_out = ConversionService.html_to_pdf(html)
        self.assertGreater(len(pdf_out), 200)
        self.assertTrue(pdf_out.startswith(b'%PDF-'))

    def test_09_redact_pdf_permanent(self):
        res = SecurityService.redact_pdf(self.sample_pdf, ["CLASSIFIED_TOKEN_998877", "Danish Khan"])
        self.assertGreater(res["redacted_count"], 0)
        self.assertTrue(res["verified_clean"])
        self.assertTrue(res["pdf_bytes"].startswith(b'%PDF-'))
        # Crucial check: verify sensitive term does NOT exist anywhere in the raw bytes
        self.assertNotIn(b"CLASSIFIED_TOKEN_998877", res["pdf_bytes"])

    def test_10_pdf_to_pdfa(self):
        pdfa_bytes = SecurityService.pdf_to_pdfa(self.sample_pdf)
        self.assertTrue(pdfa_bytes.startswith(b'%PDF-'))
        self.assertIn(b"GTS_PDFA1Version", pdfa_bytes)
        self.assertIn(b"pdfaid:part", pdfa_bytes)

    def test_11_repair_pdf(self):
        # Create a damaged PDF with corrupted header prefix and stripped startxref pointer
        base_without_startxref = self.sample_pdf[:self.sample_pdf.rfind(b'startxref')]
        damaged = b"GARBAGE_BYTES_PREFIX_" + base_without_startxref + b"CORRUPTED_TRAILING_BYTES"
        res = AdvancedService.repair_pdf(damaged)
        self.assertEqual(res["status"], "success")
        self.assertGreaterEqual(res["recovered_pages"], 1)
        self.assertTrue(res["repaired_bytes"].startswith(b'%PDF-'))

    def test_12_summarize_pdf(self):
        res = AdvancedService.summarize_pdf(self.sample_pdf, max_sentences=3)
        self.assertGreater(res["word_count"], 5)
        self.assertGreaterEqual(res["pages"], 1)
        self.assertTrue(len(res["summary"]) > 0)
        self.assertTrue(len(res["key_takeaways"]) > 0)

    def test_13_translate_pdf(self):
        res = AdvancedService.translate_pdf(self.sample_pdf, target_lang="es")
        self.assertEqual(res["target_language"], "es")
        self.assertGreater(res["pages_translated"], 0)
        self.assertTrue(res["pdf_bytes"].startswith(b'%PDF-'))

    def test_14_protect_and_unlock_pdf(self):
        password = "SecurePassword2026!"
        protected = SecurityService.protect_pdf(self.sample_pdf, password)
        self.assertTrue(protected.startswith(b'%PDF-'))
        from pypdf import PdfReader
        r = PdfReader(io.BytesIO(protected))
        self.assertTrue(r.is_encrypted)

        # Unlocking with correct password
        unlocked = SecurityService.unlock_pdf(protected, password)
        self.assertTrue(unlocked.startswith(b'%PDF-'))
        r2 = PdfReader(io.BytesIO(unlocked))
        self.assertFalse(r2.is_encrypted)
        self.assertGreaterEqual(len(r2.pages), 1)

        # Wrong password raises error
        with self.assertRaises(ValueError):
            SecurityService.unlock_pdf(protected, "WrongPassword")

    def test_15_merge_pdfs(self):
        # Merge 2 copies of sample_pdf
        merged = AdvancedService.merge_pdfs([self.sample_pdf, self.sample_pdf])
        self.assertTrue(merged.startswith(b'%PDF-'))
        from pypdf import PdfReader
        r = PdfReader(io.BytesIO(merged))
        self.assertEqual(len(r.pages), 2)

    def test_16_split_pdf(self):
        # First create a 3-page PDF
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        for i in range(1, 4):
            c.drawString(100, 700, f"Page {i}")
            c.showPage()
        c.save()
        three_page = buf.getvalue()

        # Extract page 2
        split_one = AdvancedService.split_pdf(three_page, [1])
        from pypdf import PdfReader
        r = PdfReader(io.BytesIO(split_one))
        self.assertEqual(len(r.pages), 1)

        # Extract all pages to ZIP
        zip_bytes = AdvancedService.split_pdf_to_zip(three_page)
        import zipfile
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        self.assertEqual(len(zf.namelist()), 3)
        self.assertIn("page-1.pdf", zf.namelist())
        self.assertIn("page-2.pdf", zf.namelist())
        self.assertIn("page-3.pdf", zf.namelist())



if __name__ == '__main__':
    unittest.main()
