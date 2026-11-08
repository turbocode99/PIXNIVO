"""
Comprehensive Test Suite for Pixnivo AIDC Studio
Covers validation, identifier generation, ReportLab vector rendering, document exports, and API endpoints.
"""
import sys
import os
import unittest

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from aidc.services.validation_service import ValidationService
from aidc.services.identifier_service import IdentifierService
from aidc.services.render_service import RenderService
from aidc.services.export_service import ExportService
from aidc.services.storage_service import StorageService
from aidc.schemas import BarcodeExportItem, PrefixSettings
from starlette.testclient import TestClient
import main

class TestAIDCValidation(unittest.TestCase):
    def test_mod10_check_digit(self):
        # Known test vectors
        # EAN-13: 400638133393 -> check digit 1 (4006381333931)
        self.assertEqual(ValidationService.calculate_mod10_check_digit("400638133393"), "1")
        # UPC-A: 03600029145 -> check digit 2 (036000291452)
        self.assertEqual(ValidationService.calculate_mod10_check_digit("03600029145"), "2")
        # GTIN-14: 1540014128876 -> check digit 3 (15400141288763)
        self.assertEqual(ValidationService.calculate_mod10_check_digit("1540014128876"), "3")

    def test_gtin_validation_valid(self):
        res = ValidationService.validate("ean13", "4006381333931")
        self.assertEqual(res.status, "valid")
        self.assertEqual(res.check_digit, "1")

    def test_gtin_validation_auto_fix_missing_check(self):
        res = ValidationService.validate("ean13", "400638133393")
        self.assertEqual(res.status, "warning")
        self.assertTrue(res.auto_fix_available)
        self.assertEqual(res.suggested_payload, "4006381333931")

    def test_gtin_validation_checksum_failed(self):
        res = ValidationService.validate("ean13", "4006381333939")
        self.assertEqual(res.status, "invalid")
        self.assertEqual(res.expected_check_digit, "1")

    def test_gs1_ai_parsing(self):
        # 0950110153000 has check digit 3 -> 09501101530003
        payload = "(01)09501101530003(17)261231(10)LOT42"
        res = ValidationService.validate("gs1-128", payload)
        self.assertEqual(res.status, "valid")
        self.assertTrue(res.is_gs1_compliant)
        self.assertEqual(len(res.elements), 3)
        self.assertEqual(res.elements[0].ai, "01")
        self.assertEqual(res.elements[1].interpretation, "2026-12-31")

class TestAIDCIdentifiers(unittest.TestCase):
    def test_uuidv7_generation(self):
        u7 = IdentifierService.generate_uuidv7()
        parts = u7.split("-")
        self.assertEqual(len(parts), 5)
        # 3rd part starts with '7'
        self.assertTrue(parts[2].startswith("7"))
        # 4th part starts with 8, 9, a, or b (variant)
        self.assertIn(parts[3][0].lower(), ["8", "9", "a", "b"])

    def test_bulk_gtin_generation(self):
        res = IdentifierService.generate_identifiers("gtin13", prefix="8901234", item_ref="100", quantity=3)
        self.assertEqual(res.count, 3)
        for item in res.identifiers:
            self.assertEqual(len(item.payload), 13)
            # Verify checksum
            body = item.payload[:-1]
            check = item.payload[-1]
            self.assertEqual(ValidationService.calculate_mod10_check_digit(body), check)
            self.assertTrue(item.digital_link_url.startswith("https://id.gs1.org/01/"))

class TestAIDCReportLabRendering(unittest.TestCase):
    def test_vector_svg_rendering(self):
        svg = RenderService.render_svg("code128", "PIXNIVO-PRO")
        self.assertTrue(svg.startswith("<?xml") or "<svg" in svg)
        self.assertIn("</svg>", svg)

    def test_vector_pdf_rendering(self):
        pdf_bytes = RenderService.render_pdf_bytes("ean13", "4006381333931")
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

class TestAIDCExports(unittest.TestCase):
    def test_pdf_catalog_export(self):
        items = [
            BarcodeExportItem(text="PIX-001", symbology="code128", title="Asset 1", sku="SKU-1"),
            BarcodeExportItem(text="4006381333931", symbology="ean13", title="Asset 2", sku="SKU-2")
        ]
        pdf = ExportService.export_pdf_catalog(items)
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_zip_export(self):
        items = [
            BarcodeExportItem(text="PIX-001", symbology="code128", title="Asset 1", sku="SKU-1")
        ]
        z = ExportService.export_zip(items)
        self.assertTrue(z.startswith(b"PK"))

class TestAIDCAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_api_validate(self):
        resp = self.client.post("/api/v1/aidc/validate", json={"symbology": "upca", "payload": "012345678905"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "valid")

    def test_api_identifiers(self):
        resp = self.client.post("/api/v1/aidc/identifiers/generate", json={"type": "uuidv7", "quantity": 2})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["identifiers"]), 2)

    def test_api_templates(self):
        resp = self.client.get("/api/v1/aidc/templates")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 5)

    def test_api_prefix_settings(self):
        resp = self.client.get("/api/v1/aidc/settings/prefix")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("gs1_company_prefix", resp.json())

if __name__ == "__main__":
    unittest.main()
