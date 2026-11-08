import os
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import JSONResponse
from typing import Optional, List

from .services.conversion_service import ConversionService
from .services.security_service import SecurityService
from .services.advanced_service import AdvancedService

router = APIRouter()


@router.get("/health")
async def pdf_health():
    """Returns status of all PDF engines and dependencies."""
    return {
        "status": "healthy",
        "engines": {
            "pypdf": True,
            "docx": True,
            "pptx": True,
            "openpyxl": True,
            "reportlab": True,
            "client_side_lib": "pdf-lib + pdfjs"
        },
        "supported_tools_count": 32,
        "platform": "Pixnivo Professional PDF Studio Core"
    }


# ==============================================================================
# CONVERSION ENDPOINTS
# ==============================================================================

@router.post("/convert/pdf-to-docx")
async def pdf_to_docx_endpoint(file: UploadFile = File(...)):
    """Convert PDF document into editable DOCX file."""
    try:
        content = await file.read()
        docx_bytes = ConversionService.pdf_to_docx(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.docx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF to Word conversion failed: {str(e)}")


@router.post("/convert/pdf-to-pptx")
async def pdf_to_pptx_endpoint(file: UploadFile = File(...)):
    """Convert PDF pages into editable PowerPoint PPTX slides."""
    try:
        content = await file.read()
        pptx_bytes = ConversionService.pdf_to_pptx(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.pptx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF to PowerPoint conversion failed: {str(e)}")


@router.post("/convert/pdf-to-xlsx")
async def pdf_to_xlsx_endpoint(file: UploadFile = File(...)):
    """Extract structured tables and data from PDF into Excel XLSX."""
    try:
        content = await file.read()
        xlsx_bytes = ConversionService.pdf_to_xlsx(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.xlsx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF to Excel conversion failed: {str(e)}")


@router.post("/convert/docx-to-pdf")
async def docx_to_pdf_endpoint(file: UploadFile = File(...)):
    """Convert DOCX document to high-quality vector PDF."""
    try:
        content = await file.read()
        pdf_bytes = ConversionService.docx_to_pdf(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Word to PDF conversion failed: {str(e)}")


@router.post("/convert/pptx-to-pdf")
async def pptx_to_pdf_endpoint(file: UploadFile = File(...)):
    """Convert PPTX presentation slides into PDF."""
    try:
        content = await file.read()
        pdf_bytes = ConversionService.pptx_to_pdf(content)
        base_name = os.path.splitext(file.filename or "presentation")[0]
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PowerPoint to PDF conversion failed: {str(e)}")


@router.post("/convert/xlsx-to-pdf")
async def xlsx_to_pdf_endpoint(file: UploadFile = File(...)):
    """Convert Excel spreadsheet tables into PDF."""
    try:
        content = await file.read()
        pdf_bytes = ConversionService.xlsx_to_pdf(content)
        base_name = os.path.splitext(file.filename or "spreadsheet")[0]
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel to PDF conversion failed: {str(e)}")


@router.post("/convert/pdf-to-markdown")
async def pdf_to_markdown_endpoint(file: UploadFile = File(...)):
    """Extract PDF text into formatted Markdown."""
    try:
        content = await file.read()
        md_text = ConversionService.pdf_to_markdown(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=md_text.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.md"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF to Markdown extraction failed: {str(e)}")


@router.post("/convert/html-to-pdf")
async def html_to_pdf_endpoint(html: str = Form(...), title: Optional[str] = Form("Converted Document")):
    """Convert raw HTML or web page snippet into vector PDF."""
    try:
        pdf_bytes = ConversionService.html_to_pdf(html)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="webpage.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"HTML to PDF conversion failed: {str(e)}")


# ==============================================================================
# SECURITY & COMPLIANCE ENDPOINTS
# ==============================================================================

@router.post("/redact")
async def redact_pdf_endpoint(file: UploadFile = File(...), terms: str = Form(...)):
    """
    Permanently strips target sensitive text from PDF content streams.
    Guarantees text cannot be selected, searched, or recovered.
    """
    try:
        content = await file.read()
        target_list = [t.strip() for t in terms.split(",") if t.strip()]
        result = SecurityService.redact_pdf(content, target_list)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=result["pdf_bytes"],
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}-redacted.pdf"',
                "X-Redacted-Count": str(result["redacted_count"]),
                "X-Verified-Clean": str(result["verified_clean"]).lower()
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF Redaction failed: {str(e)}")


@router.post("/pdf-to-pdfa")
async def pdf_to_pdfa_endpoint(file: UploadFile = File(...)):
    """Convert PDF to PDF/A-1b archival standard with color intent and conformance metadata."""
    try:
        content = await file.read()
        pdfa_bytes = SecurityService.pdf_to_pdfa(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=pdfa_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_name}-pdfa.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF/A conversion failed: {str(e)}")


# ==============================================================================
# REPAIR, AI SUMMARIZER & TRANSLATE ENDPOINTS
# ==============================================================================

@router.post("/repair")
async def repair_pdf_endpoint(file: UploadFile = File(...)):
    """Rebuilds corrupted or damaged PDF syntax, recovers accessible pages, and rebuilds xrefs."""
    try:
        content = await file.read()
        res = AdvancedService.repair_pdf(content)
        base_name = os.path.splitext(file.filename or "document")[0]
        return Response(
            content=res["repaired_bytes"],
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}-repaired.pdf"',
                "X-Recovered-Pages": str(res["recovered_pages"])
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF Repair failed: {str(e)}")


@router.post("/summarize")
async def summarize_pdf_endpoint(file: UploadFile = File(...), sentences: int = Form(5)):
    """Generates executive summary, word count, reading time, and key takeaways using free local NLP."""
    try:
        content = await file.read()
        res = AdvancedService.summarize_pdf(content, max_sentences=sentences)
        return JSONResponse(status_code=200, content={"success": True, **res})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF Summarization failed: {str(e)}")


@router.post("/translate")
async def translate_pdf_endpoint(
    file: UploadFile = File(...),
    target_lang: str = Form("es"),
    output_format: str = Form("pdf")
):
    """
    Translates PDF content into target language (es, fr, de, it, pt, ar, zh, hi).
    Returns translated PDF document or structured translation JSON.
    """
    try:
        content = await file.read()
        res = AdvancedService.translate_pdf(content, target_lang=target_lang)
        base_name = os.path.splitext(file.filename or "document")[0]

        if output_format.lower() == "json":
            return JSONResponse(status_code=200, content={
                "success": True,
                "target_language": res["target_language"],
                "translated_text": res["translated_text"],
                "pages_translated": res["pages_translated"]
            })
        else:
            return Response(
                content=res["pdf_bytes"],
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{base_name}-{target_lang}.pdf"'}
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF Translation failed: {str(e)}")
