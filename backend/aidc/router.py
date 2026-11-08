"""
AIDC Studio FastAPI Router
RESTful API endpoints under /api/v1/aidc
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Response, Request
from typing import List, Optional, Dict, Any
import time

from .schemas import (
    ValidationRequest, ValidationResponse,
    IdentifierGenRequest, IdentifierGenResponse,
    RenderRequest, RenderResponse,
    ExportRequest, TemplateItem, AssetItem, PrefixSettings
)
from .services.validation_service import ValidationService
from .services.identifier_service import IdentifierService
from .services.render_service import RenderService
from .services.export_service import ExportService
from .services.batch_service import BatchService
from .services.storage_service import StorageService

router = APIRouter()

@router.post("/validate", response_model=ValidationResponse)
async def validate_barcode(req: ValidationRequest, request: Request):
    t0 = time.time()
    res = ValidationService.validate(req.symbology, req.payload, req.strict_mode)
    exec_ms = int((time.time() - t0) * 1000)
    
    # Telemetry logging
    client_ip = request.client.host if request.client else "unknown"
    StorageService.log_generation(req.symbology, len(req.payload), res.status, exec_ms, client_ip)
    return res

@router.post("/identifiers/generate", response_model=IdentifierGenResponse)
async def generate_identifiers(req: IdentifierGenRequest):
    # If company prefix not provided, check workspace prefix registry
    prefix = req.country_or_company_prefix
    if not prefix and req.type in ["gtin8", "gtin12", "gtin13", "gtin14", "gs1_digital_link"]:
        settings = StorageService.get_prefix_settings("default")
        if settings.is_active and settings.gs1_company_prefix:
            prefix = settings.gs1_company_prefix

    res = IdentifierService.generate_identifiers(
        id_type=req.type,
        prefix=prefix,
        item_ref=req.item_reference,
        quantity=req.quantity,
        domain=req.domain or "https://id.gs1.org",
        lot=req.lot,
        expiry=req.expiry,
        serial=req.serial
    )
    return res

@router.post("/render", response_model=RenderResponse)
async def render_barcode(req: RenderRequest):
    sym = req.symbology.lower().strip()
    fmt = req.format.lower().strip()

    if fmt == "svg":
        try:
            svg_data = RenderService.render_svg(sym, req.payload, req.config)
            return RenderResponse(
                status="success",
                symbology=sym,
                payload=req.payload,
                format="svg",
                data=svg_data
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"SVG vector rendering error: {str(e)}")

    elif fmt == "pdf":
        try:
            pdf_bytes = RenderService.render_pdf_bytes(sym, req.payload, req.config)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename={sym}_{req.payload[:10]}.pdf"}
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF vector rendering error: {str(e)}")

    else:
        # Fallback to SVG
        svg_data = RenderService.render_svg(sym, req.payload, req.config)
        return RenderResponse(
            status="success",
            symbology=sym,
            payload=req.payload,
            format="svg",
            data=svg_data
        )

@router.post("/export")
async def export_barcodes_document(req: ExportRequest):
    if not req.images:
        raise HTTPException(status_code=400, detail="No barcode images provided for export.")

    fmt = req.format.lower().strip()

    if fmt == "pdf":
        pdf_bytes = ExportService.export_pdf_catalog(req.images, title="AIDC Studio Catalog")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=aidc_catalog.pdf"}
        )

    elif fmt == "docx":
        docx_bytes = ExportService.export_docx(req.images)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=aidc_barcodes.docx"}
        )

    elif fmt == "xlsx":
        xlsx_bytes = ExportService.export_xlsx(req.images)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=aidc_barcodes.xlsx"}
        )

    elif fmt == "zip":
        zip_bytes = ExportService.export_zip(req.images)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=aidc_barcodes.zip"}
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{fmt}'. Choose pdf, docx, xlsx, or zip.")

@router.post("/batch/process")
async def process_batch_file(
    file: UploadFile = File(...),
    default_symbology: str = Form("code128")
):
    if not file:
        raise HTTPException(status_code=400, detail="No batch file uploaded.")

    content = await file.read()
    rows = BatchService.parse_tabular_file(content, file.filename)
    if not rows:
        raise HTTPException(status_code=400, detail="File could not be parsed or contains no data rows.")

    batch_res = BatchService.process_batch(rows, default_symbology=default_symbology)
    return batch_res

@router.get("/templates", response_model=List[TemplateItem])
async def list_templates():
    return StorageService.get_templates()

@router.get("/history", response_model=List[AssetItem])
async def list_history(
    search: Optional[str] = Query(None),
    symbology: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0)
):
    return StorageService.list_assets(
        workspace_id="default",
        search=search,
        symbology=symbology,
        is_favorite=is_favorite,
        limit=limit,
        offset=offset
    )

@router.post("/history")
async def save_history_item(asset: Dict[str, Any]):
    asset_id = StorageService.save_asset(asset)
    return {"status": "success", "id": asset_id}

@router.post("/history/{asset_id}/favorite")
async def toggle_favorite(asset_id: str):
    new_fav = StorageService.toggle_favorite(asset_id)
    return {"status": "success", "id": asset_id, "is_favorite": new_fav}

@router.delete("/history/{asset_id}")
async def delete_history_item(asset_id: str):
    ok = StorageService.delete_asset(asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return {"status": "success", "id": asset_id}

@router.get("/settings/prefix", response_model=PrefixSettings)
async def get_prefix_settings():
    return StorageService.get_prefix_settings("default")

@router.post("/settings/prefix")
async def save_prefix_settings(settings: PrefixSettings):
    StorageService.save_prefix_settings("default", settings)
    return {"status": "success", "settings": settings}

@router.get("/analytics")
async def get_analytics():
    return StorageService.get_analytics()

