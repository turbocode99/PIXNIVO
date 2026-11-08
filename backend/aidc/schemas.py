"""
Pydantic v2 schemas for AIDC Studio API contracts.
"""
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

# ==================== Validation Models ====================
class ValidationRequest(BaseModel):
    symbology: str = Field(..., description="Symbology identifier (e.g., ean13, upca, code128, gs1-128, qrcode)")
    payload: str = Field(..., description="Raw data payload to validate")
    strict_mode: bool = Field(True, description="Enforce strict length, character set, and checksum validation")

class GS1Element(BaseModel):
    ai: str
    description: str
    value: str
    valid: bool
    check_digit_valid: Optional[bool] = None
    interpretation: Optional[str] = None

class ValidationResponse(BaseModel):
    status: str = Field(..., description="'valid', 'warning', or 'invalid'")
    symbology: str
    sanitized_payload: str
    is_gs1_compliant: bool = False
    check_digit: Optional[str] = None
    expected_check_digit: Optional[str] = None
    elements: Optional[List[GS1Element]] = None
    warnings: List[str] = []
    errors: List[str] = []
    auto_fix_available: bool = False
    suggested_payload: Optional[str] = None

# ==================== Identifier Models ====================
class IdentifierGenRequest(BaseModel):
    type: str = Field(..., description="gtin8, gtin12, gtin13, gtin14, uuidv4, uuidv7, guid, gs1_digital_link")
    country_or_company_prefix: Optional[str] = None
    item_reference: Optional[str] = None
    quantity: int = Field(1, ge=1, le=500, description="Number of identifiers to generate")
    domain: Optional[str] = "https://id.gs1.org"
    # For GS1 Digital Link extra attributes:
    lot: Optional[str] = None
    expiry: Optional[str] = None
    serial: Optional[str] = None

class IdentifierItem(BaseModel):
    payload: str
    check_digit: Optional[str] = None
    formatted: Optional[str] = None
    digital_link_url: Optional[str] = None
    type: str

class IdentifierGenResponse(BaseModel):
    type: str
    count: int
    identifiers: List[IdentifierItem]

# ==================== Rendering Models ====================
class RenderVisualConfig(BaseModel):
    scale: int = Field(4, ge=1, le=10)
    height_mm: int = Field(15, ge=5, le=50)
    show_text: bool = True
    foreground: str = "#000000"
    background: str = "#FFFFFF"
    margin: int = Field(10, ge=0, le=50)
    ecc_level: str = Field("M", description="L, M, Q, H for 2D codes")

class RenderRequest(BaseModel):
    symbology: str
    payload: str
    format: str = Field("svg", description="svg, png, or base64")
    config: Optional[RenderVisualConfig] = None
    title: Optional[str] = None
    sku: Optional[str] = None

class RenderResponse(BaseModel):
    status: str
    symbology: str
    payload: str
    format: str
    data: str # SVG XML string or Base64 data URI
    width: Optional[int] = None
    height: Optional[int] = None

# ==================== Export Models ====================
class BarcodeExportItem(BaseModel):
    text: str
    symbology: Optional[str] = "code128"
    sku: Optional[str] = ""
    title: Optional[str] = ""
    base64_data: Optional[str] = None # Optional client-rendered canvas image

class ExportRequest(BaseModel):
    format: str = Field("pdf", description="pdf, docx, xlsx, or zip")
    layout: Optional[str] = "catalog" # 'catalog' or 'labels_avery5160'
    images: List[BarcodeExportItem]
    dpi: Optional[int] = 300

# ==================== Templates & History ====================
class TemplateItem(BaseModel):
    id: str
    name: str
    category: str
    symbology: str
    description: str
    payload_pattern: Optional[str] = None
    default_config: Dict[str, Any]
    is_system_preset: bool = True

class AssetItem(BaseModel):
    id: str
    symbology: str
    raw_payload: str
    formatted_payload: Optional[str] = None
    check_digit: Optional[str] = None
    title: Optional[str] = None
    sku: Optional[str] = None
    visual_config: Optional[Dict[str, Any]] = None
    is_favorite: bool = False
    created_at: str

class PrefixSettings(BaseModel):
    company_name: str
    gs1_company_prefix: str
    next_item_reference: int = 1
    is_active: bool = True

