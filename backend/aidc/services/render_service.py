"""
AIDC Render Service
Pure Python ReportLab vector barcode drawing and SVG / PDF synthesis.
"""
from typing import Dict, Any, Optional, Tuple
from io import BytesIO
import base64
import re

from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics import renderSVG, renderPDF
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from ..schemas import RenderVisualConfig

class RenderService:
    # Map normalized symbology keys to ReportLab barcode engine types
    SYMBOLOGY_MAP: Dict[str, str] = {
        "code128": "Code128",
        "code-128": "Code128",
        "code39": "Standard39",
        "code-39": "Standard39",
        "code93": "Standard93",
        "code-93": "Standard93",
        "ean13": "EAN13",
        "ean-13": "EAN13",
        "gtin13": "EAN13",
        "ean8": "EAN8",
        "ean-8": "EAN8",
        "gtin8": "EAN8",
        "upca": "UPCA",
        "upc-a": "UPCA",
        "gtin12": "UPCA",
        "itf": "I2of5",
        "itf14": "I2of5",
        "itf-14": "I2of5",
        "gtin14": "I2of5",
        "interleaved2of5": "I2of5",
        "codabar": "Codabar",
        "rationalizedcodabar": "Codabar",
        "datamatrix": "ECC200DataMatrix",
        "gs1datamatrix": "ECC200DataMatrix",
        "qr": "QR",
        "qrcode": "QR",
        "gs1-128": "Code128", # Encoded with Code128 standard
        "gs1_128": "Code128",
    }

    @classmethod
    def create_drawing(cls, symbology: str, payload: str, config: Optional[RenderVisualConfig] = None) -> Drawing:
        """
        Builds a ReportLab Drawing object for the requested symbology and payload.
        """
        sym = symbology.lower().strip()
        rl_code = cls.SYMBOLOGY_MAP.get(sym, "Code128")
        clean_payload = payload.strip()
        cfg = config or RenderVisualConfig()

        height_pts = cfg.height_mm * 2.83465 # mm to points conversion

        if rl_code == "QR":
            # Native QR Code widget inside a Drawing
            size = max(80, int(height_pts * 2.5))
            d = Drawing(size, size)
            qr = QrCodeWidget(clean_payload)
            qr.barWidth = size
            qr.barHeight = size
            d.add(qr)
            return d

        elif rl_code == "ECC200DataMatrix":
            try:
                d = createBarcodeDrawing(
                    'ECC200DataMatrix',
                    value=clean_payload
                )
                return d
            except Exception:
                # Fallback to Code128 if DataMatrix payload triggers library edge case
                return createBarcodeDrawing('Code128', value=clean_payload, barHeight=height_pts)

        elif rl_code in ["EAN13", "UPCA", "EAN8"]:
            # ReportLab EAN/UPCA widgets require strictly digits without formatting
            numeric_only = re.sub(r'\D', '', clean_payload)
            try:
                d = createBarcodeDrawing(
                    rl_code,
                    value=numeric_only,
                    barHeight=height_pts,
                    humanReadable=cfg.show_text
                )
                return d
            except Exception:
                # If strict checksum failed, draw as Code128 so rendering doesn't crash
                return createBarcodeDrawing('Code128', value=clean_payload, barHeight=height_pts)

        else:
            # Code128, Standard39, Standard93, I2of5, Codabar
            try:
                d = createBarcodeDrawing(
                    rl_code,
                    value=clean_payload,
                    barHeight=height_pts,
                    humanReadable=cfg.show_text
                )
                return d
            except Exception:
                # Fallback to general Code128
                return createBarcodeDrawing('Code128', value=clean_payload, barHeight=height_pts)

    @classmethod
    def render_svg(cls, symbology: str, payload: str, config: Optional[RenderVisualConfig] = None) -> str:
        """
        Renders pure vector SVG string.
        """
        drawing = cls.create_drawing(symbology, payload, config)
        svg_str = renderSVG.drawToString(drawing)
        return svg_str

    @classmethod
    def render_pdf_bytes(cls, symbology: str, payload: str, config: Optional[RenderVisualConfig] = None) -> bytes:
        """
        Renders a single vector PDF document into raw bytes.
        """
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        page_w, page_h = letter

        drawing = cls.create_drawing(symbology, payload, config)
        
        # Center drawing on page
        draw_w = getattr(drawing, 'width', 200)
        draw_h = getattr(drawing, 'height', 100)
        x = (page_w - draw_w) / 2
        y = (page_h - draw_h) / 2

        # Title
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(page_w / 2, y + draw_h + 30, f"{symbology.upper()}: {payload}")

        # Render vector drawing
        renderPDF.draw(drawing, c, x, y)
        c.save()
        return buf.getvalue()

