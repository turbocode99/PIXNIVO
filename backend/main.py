import os
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_enable_pir_in_executor'] = '0'
import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import base64
from io import BytesIO
from fastapi.responses import Response, JSONResponse
import hashlib
import hmac
import secrets
import time
import json
import re
try:
    from docx import Document
    from docx.shared import Inches
except ImportError:
    Document = None
    Inches = None

try:
    import openpyxl
    from openpyxl.drawing.image import Image as OpenpyxlImage
except ImportError:
    openpyxl = None
    OpenpyxlImage = None

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
except ImportError:
    canvas = None
    letter = None

class BarcodeImage(BaseModel):
    text: str
    base64_data: str

class ExportRequest(BaseModel):
    format: str
    images: List[BarcodeImage]

try:
    from paddleocr import PaddleOCR
    from pdf2image import convert_from_path
    from PIL import Image, ImageOps, ImageEnhance
    import pillow_heif
    pillow_heif.register_heif_opener()
    print('Initializing PaddleOCR...')
    ocr_engine = PaddleOCR(use_angle_cls=True, use_gpu=False, lang='en')
    print('PaddleOCR ready!')
except Exception as e:
    ocr_engine = None
    from PIL import Image, ImageOps, ImageEnhance
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except Exception:
        pass
    print(f'Note: PaddleOCR deferred or unavailable ({e}). OCR endpoint will notify if invoked.')

app = FastAPI(title="PIXNIVO API & Admin Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get('/api/health')
def health_check():
    return {'status': 'ok'}

@app.post('/api/ocr')
async def process_ocr(file: UploadFile = File(...), enhance: str = Form('none')):
    if not file:
        raise HTTPException(status_code=400, detail='No file provided')
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail='PaddleOCR engine is not available in current environment')
        
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


# ==============================================================================
# PIXNIVO ADMIN AUTHENTICATION & BLOG MANAGEMENT SYSTEM
# ==============================================================================

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DATA_DIR = os.path.join(BACKEND_DIR, "data")
AUTH_FILE = os.path.join(DATA_DIR, "auth.json")
BLOGS_FILE = os.path.join(DATA_DIR, "blogs.json")
UPLOADS_DIR = os.path.join(PROJECT_ROOT, "assets", "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Mount /assets/uploads for direct browser access
if os.path.exists(UPLOADS_DIR):
    app.mount("/assets/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Security settings
SECRET_KEY = os.environ.get("ADMIN_SECRET_KEY", "pixnivo_super_secret_jwt_hmac_key_2026_x7a8b9")
DEFAULT_USERNAME = os.environ.get("ADMIN_USERNAME", "admin@pixnivo.app")
DEFAULT_SALT = "7069786e69766f5f7365635f32303236"
DEFAULT_HASH = "c450b48ffcb2ae6f8ee1e81e43ff37bf5d81787d0f797b9711cb0515f972503f"  # PixnivoSecure#2026!

# Brute force protection tracker: key -> {"count": int, "locked_until": float}
FAILED_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 300  # 5 minutes

def get_auth_credentials() -> Dict[str, str]:
    """Retrieve stored admin credentials or create default if not present."""
    if os.path.exists(AUTH_FILE):
        try:
            with open(AUTH_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    creds = {
        "username": DEFAULT_USERNAME,
        "salt": DEFAULT_SALT,
        "hash": DEFAULT_HASH,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    try:
        with open(AUTH_FILE, "w", encoding="utf-8") as f:
            json.dump(creds, f, indent=2)
    except Exception:
        pass
    return creds

def save_auth_credentials(creds: Dict[str, str]):
    with open(AUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2)

def hash_password_pbkdf2(password: str, salt: bytes = None) -> (str, str):
    if salt is None:
        salt = secrets.token_bytes(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
    return salt.hex(), pwd_hash.hex()

def verify_password_pbkdf2(password: str, salt_hex: str, hash_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        actual_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
        return hmac.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False

def generate_session_token(username: str, role: str = "super_admin", expires_in_seconds: int = 86400) -> str:
    """Generate tamper-proof HMAC-SHA256 session token."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    now = int(time.time())
    payload_data = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + expires_in_seconds
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    sig_input = f"{header}.{payload}".encode("utf-8")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), sig_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{header}.{payload}.{sig_b64}"

def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify session token and check expiration."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        sig_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), sig_input, hashlib.sha256).digest()

        rem_s = len(sig_b64) % 4
        padded_sig = sig_b64 + ("=" * (4 - rem_s) if rem_s else "")
        actual_sig = base64.urlsafe_b64decode(padded_sig)
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None

        rem_p = len(payload_b64) % 4
        padded_payload = payload_b64 + ("=" * (4 - rem_p) if rem_p else "")
        payload = json.loads(base64.urlsafe_b64decode(padded_payload).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def check_rate_limit(key: str) -> Optional[int]:
    """Check if key is locked out. Returns seconds remaining if locked, None otherwise."""
    record = FAILED_ATTEMPTS.get(key)
    if not record:
        return None
    locked_until = record.get("locked_until", 0)
    now = time.time()
    if locked_until > now:
        return int(locked_until - now)
    if locked_until != 0 and locked_until <= now:
        FAILED_ATTEMPTS.pop(key, None)
    return None

def record_failed_attempt(key: str) -> (int, Optional[int]):
    """Record a failed login attempt. Returns (attempts_so_far, lockout_seconds_if_locked)."""
    now = time.time()
    record = FAILED_ATTEMPTS.setdefault(key, {"count": 0, "locked_until": 0})
    record["count"] += 1
    if record["count"] >= MAX_LOGIN_ATTEMPTS:
        record["locked_until"] = now + LOCKOUT_SECONDS
        return record["count"], LOCKOUT_SECONDS
    return record["count"], None

def reset_failed_attempts(key: str):
    FAILED_ATTEMPTS.pop(key, None)

def get_current_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency to validate admin token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required: Bearer token missing")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return payload

# Pydantic Schemas
class AdminLoginRequest(BaseModel):
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class BlogPostModel(BaseModel):
    id: Optional[str] = None
    slug: str
    title: str
    category: Optional[str] = "Guides"
    date: Optional[str] = None
    displayDate: Optional[str] = None
    readTime: Optional[str] = "5 min read"
    author: Optional[str] = "PIXNIVO Team"
    coverImage: Optional[str] = ""
    excerpt: Optional[str] = ""
    content: Optional[str] = ""
    status: Optional[str] = "published"
    tags: Optional[List[str]] = []
    url: Optional[str] = None
    isStatic: Optional[bool] = False
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

# Blog Storage Helpers
def read_blogs() -> List[Dict[str, Any]]:
    if not os.path.exists(BLOGS_FILE):
        return []
    try:
        with open(BLOGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading blogs: {e}")
        return []

def write_blogs(blogs: List[Dict[str, Any]]) -> bool:
    try:
        temp_file = BLOGS_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(blogs, f, indent=2, ensure_ascii=False)
        if os.path.exists(BLOGS_FILE):
            backup_file = BLOGS_FILE + ".bak"
            shutil.copyfile(BLOGS_FILE, backup_file)
        os.replace(temp_file, BLOGS_FILE)
        return True
    except Exception as e:
        print(f"Error writing blogs: {e}")
        return False

# ----------------- Auth Endpoints -----------------

@app.post("/api/auth/login")
async def admin_login(req: AdminLoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    lockout_key = f"{client_ip}:{req.username.strip().lower()}"
    
    remaining_lockout = check_rate_limit(lockout_key)
    if remaining_lockout:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Account temporarily locked. Try again in {remaining_lockout} seconds."
        )

    creds = get_auth_credentials()
    clean_user = req.username.strip().lower()
    expected_user = creds.get("username", "").strip().lower()
    
    # Also accept "admin" alias for admin@pixnivo.app
    user_match = (clean_user == expected_user) or (clean_user == "admin" and "admin" in expected_user)

    if not user_match or not verify_password_pbkdf2(req.password, creds["salt"], creds["hash"]):
        attempts, lockout = record_failed_attempt(lockout_key)
        if lockout:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Security lockout initiated for {lockout} seconds."
            )
        left = MAX_LOGIN_ATTEMPTS - attempts
        raise HTTPException(
            status_code=401,
            detail=f"Invalid admin credentials. {left} attempt{'s' if left != 1 else ''} remaining before temporary lockout."
        )

    # Success: reset rate limit counter
    reset_failed_attempts(lockout_key)
    token = generate_session_token(creds.get("username", req.username))
    return {
        "status": "success",
        "token": token,
        "tokenType": "Bearer",
        "expiresIn": 86400,
        "user": {
            "username": creds.get("username", req.username),
            "role": "Super Admin"
        }
    }

@app.get("/api/auth/verify")
async def admin_verify_session(admin: Dict[str, Any] = Depends(get_current_admin)):
    return {
        "status": "authenticated",
        "user": admin.get("sub"),
        "role": admin.get("role"),
        "expiresAt": admin.get("exp")
    }

@app.post("/api/auth/logout")
async def admin_logout():
    return {"status": "ok", "message": "Successfully logged out"}

@app.post("/api/auth/change-password")
async def admin_change_password(req: PasswordChangeRequest, admin: Dict[str, Any] = Depends(get_current_admin)):
    creds = get_auth_credentials()
    if not verify_password_pbkdf2(req.current_password, creds["salt"], creds["hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    if len(req.new_password) < 10:
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters long")
    
    # Enforce strong password complexity
    if not (re.search(r"[A-Z]", req.new_password) and re.search(r"[a-z]", req.new_password) and re.search(r"[0-9]", req.new_password)):
        raise HTTPException(status_code=400, detail="Password must contain uppercase, lowercase, and numeric characters")

    new_salt, new_hash = hash_password_pbkdf2(req.new_password)
    creds["salt"] = new_salt
    creds["hash"] = new_hash
    creds["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_auth_credentials(creds)

    return {"status": "success", "message": "Admin password successfully updated"}

# ----------------- Public Blog Endpoints -----------------

@app.get("/api/blogs")
async def list_published_blogs(category: Optional[str] = None, search: Optional[str] = None):
    blogs = read_blogs()
    published = [b for b in blogs if b.get("status", "published") == "published"]
    
    if category and category.lower() != "all":
        published = [b for b in published if b.get("category", "").lower() == category.lower()]
        
    if search:
        s = search.lower()
        published = [
            b for b in published
            if s in b.get("title", "").lower() or s in b.get("excerpt", "").lower() or s in b.get("category", "").lower()
        ]
        
    # Sort newest first
    published.sort(key=lambda x: x.get("date", "") or x.get("createdAt", ""), reverse=True)
    return published

@app.get("/api/blogs/{slug}")
async def get_single_blog(slug: str):
    blogs = read_blogs()
    for b in blogs:
        if b.get("slug") == slug:
            return b
    raise HTTPException(status_code=404, detail=f"Blog article '{slug}' not found")

# ----------------- Admin Blog Endpoints -----------------

@app.get("/api/admin/blogs")
async def admin_list_all_blogs(admin: Dict[str, Any] = Depends(get_current_admin)):
    blogs = read_blogs()
    blogs.sort(key=lambda x: x.get("date", "") or x.get("createdAt", ""), reverse=True)
    return blogs

@app.post("/api/admin/blogs")
async def admin_create_blog(post: BlogPostModel, admin: Dict[str, Any] = Depends(get_current_admin)):
    blogs = read_blogs()
    
    # Ensure slug format
    clean_slug = re.sub(r"[^a-z0-9\-]+", "-", post.slug.strip().lower()).strip("-")
    if not clean_slug:
        clean_slug = re.sub(r"[^a-z0-9\-]+", "-", post.title.strip().lower()).strip("-")
        
    # Check uniqueness
    for b in blogs:
        if b.get("slug") == clean_slug:
            raise HTTPException(status_code=400, detail=f"A blog article with slug '{clean_slug}' already exists")

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    now_date = time.strftime("%Y-%m-%d", time.gmtime())
    
    # Calculate read time based on word count if default or empty
    words = len(re.findall(r"\w+", post.content or ""))
    calculated_mins = max(1, round(words / 200)) if words > 0 else 3
    read_time = post.readTime or f"{calculated_mins} min read"

    blog_dict = post.dict()
    blog_dict["id"] = f"post-{int(time.time() * 1000)}"
    blog_dict["slug"] = clean_slug
    blog_dict["date"] = post.date or now_date
    blog_dict["displayDate"] = post.displayDate or time.strftime("%d %B %Y", time.gmtime())
    blog_dict["readTime"] = read_time
    blog_dict["url"] = f"/post/{clean_slug}"
    blog_dict["isStatic"] = False
    blog_dict["createdAt"] = now_iso
    blog_dict["updatedAt"] = now_iso

    blogs.insert(0, blog_dict)
    if not write_blogs(blogs):
        raise HTTPException(status_code=500, detail="Failed to save blog post to storage")

    return blog_dict

@app.put("/api/admin/blogs/{slug}")
async def admin_update_blog(slug: str, post: BlogPostModel, admin: Dict[str, Any] = Depends(get_current_admin)):
    blogs = read_blogs()
    found_idx = -1
    for idx, b in enumerate(blogs):
        if b.get("slug") == slug:
            found_idx = idx
            break
            
    if found_idx == -1:
        raise HTTPException(status_code=404, detail=f"Blog article '{slug}' not found")

    existing = blogs[found_idx]
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # If slug changed, verify new slug uniqueness
    new_slug = re.sub(r"[^a-z0-9\-]+", "-", post.slug.strip().lower()).strip("-")
    if new_slug != slug:
        for b in blogs:
            if b.get("slug") == new_slug:
                raise HTTPException(status_code=400, detail=f"Slug '{new_slug}' is already in use by another article")

    words = len(re.findall(r"\w+", post.content or ""))
    calculated_mins = max(1, round(words / 200)) if words > 0 else 3
    read_time = post.readTime or f"{calculated_mins} min read"

    updated = post.dict()
    updated["id"] = existing.get("id") or f"post-{int(time.time() * 1000)}"
    updated["slug"] = new_slug
    updated["url"] = existing.get("url") if existing.get("isStatic") else f"/post/{new_slug}"
    updated["isStatic"] = existing.get("isStatic", False)
    updated["createdAt"] = existing.get("createdAt", now_iso)
    updated["updatedAt"] = now_iso
    updated["readTime"] = read_time

    blogs[found_idx] = updated
    if not write_blogs(blogs):
        raise HTTPException(status_code=500, detail="Failed to save updated blog to storage")

    return updated

@app.delete("/api/admin/blogs/{slug}")
async def admin_delete_blog(slug: str, admin: Dict[str, Any] = Depends(get_current_admin)):
    blogs = read_blogs()
    new_blogs = [b for b in blogs if b.get("slug") != slug]
    if len(new_blogs) == len(blogs):
        raise HTTPException(status_code=404, detail=f"Blog article '{slug}' not found")
        
    if not write_blogs(new_blogs):
        raise HTTPException(status_code=500, detail="Failed to delete blog from storage")
        
    return {"status": "success", "message": f"Article '{slug}' deleted successfully", "deletedSlug": slug}

@app.post("/api/admin/upload")
async def admin_upload_media(file: UploadFile = File(...), admin: Dict[str, Any] = Depends(get_current_admin)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    filename = file.filename or "upload"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    allowed_exts = ["jpg", "jpeg", "png", "webp", "gif", "svg", "pdf", "txt", "md"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File extension '.{ext}' is not supported. Allowed: {', '.join(allowed_exts)}")

    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", filename)
    timestamp = int(time.time() * 1000)
    final_filename = f"{timestamp}_{safe_name}"
    save_path = os.path.join(UPLOADS_DIR, final_filename)

    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    return {
        "status": "success",
        "url": f"/assets/uploads/{final_filename}",
        "filename": final_filename,
        "sizeBytes": len(contents),
        "mimeType": file.content_type
    }

# ==============================================================================
# AGENTROUTER AI LOGO GENERATION ENDPOINTS
# ==============================================================================

class LogoGenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    theme_id: Optional[str] = "3d-glass-bubble"
    aspect_ratio: Optional[str] = "1:1"
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    guidance_scale: Optional[float] = 7.5
    steps: Optional[int] = 30
    model: Optional[str] = "agentrouter/sdxl-turbo"
    api_key: Optional[str] = None

@app.post("/api/agentrouter/generate-logo")
async def generate_agentrouter_logo(req: LogoGenerateRequest):
    """
    Secure backend proxy for AgentRouter image generation.
    Supports live API dispatch or sandbox/testing synthesis with 1024x1024 1:1 format.
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    api_key = req.api_key or os.environ.get("AGENTROUTER_API_KEY", "")
    agentrouter_endpoint = os.environ.get("AGENTROUTER_ENDPOINT", "https://api.agentrouter.ai/v1/images/generations")

    # If API key is present, attempt live dispatch
    if api_key:
        try:
            import requests
            payload = {
                "model": req.model,
                "prompt": req.prompt,
                "negative_prompt": req.negative_prompt,
                "aspect_ratio": req.aspect_ratio or "1:1",
                "width": req.width or 1024,
                "height": req.height or 1024,
                "guidance_scale": req.guidance_scale or 7.5,
                "steps": req.steps or 30,
                "n": 1,
                "response_format": "b64_json"
            }
            resp = requests.post(
                agentrouter_endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "X-Client": "Pixnivo-Backend/1.0"
                },
                json=payload,
                timeout=45
            )
            if resp.status_code == 200:
                data = resp.json()
                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    b64 = item.get("b64_json")
                    img_url = item.get("url")
                    return {
                        "status": "success",
                        "engine": "agentrouter",
                        "b64_json": b64,
                        "url": img_url or (f"data:image/png;base64,{b64}" if b64 else None),
                        "width": req.width or 1024,
                        "height": req.height or 1024,
                        "theme_id": req.theme_id
                    }
        except Exception as e:
            print(f"[AgentRouter Backend Proxy Error]: {e}. Falling back to sandbox synthesis.")

    # High-quality sandbox/fallback synthesis if no API key or external dispatch failed
    try:
        from PIL import Image, ImageDraw, ImageFont
        w = req.width or 1024
        h = req.height or 1024
        img = Image.new("RGB", (w, h), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Palette accents by theme
        accent = (255, 122, 26) # default Pixnivo orange
        if req.theme_id == "3d-glass-bubble":
            accent = (6, 182, 212)
        elif req.theme_id == "architectural-brutalist":
            accent = (249, 115, 22)
        elif req.theme_id == "3d-claymorphism":
            accent = (236, 72, 153)
        elif req.theme_id == "minimalist-flat-vector":
            accent = (16, 185, 129)
        elif req.theme_id == "cyberpunk-neon-glyph":
            accent = (168, 85, 247)
            # dark background for cyberpunk
            draw.rectangle([0, 0, w, h], fill=(10, 8, 20))

        center_x = w // 2
        center_y = h // 2
        radius = 240

        # Draw smooth concentric emblem
        for r_offset in range(40, 0, -8):
            alpha_val = int(255 * (1 - r_offset / 45))
            draw.ellipse(
                [center_x - radius - r_offset, center_y - radius - r_offset,
                 center_x + radius + r_offset, center_y + radius + r_offset],
                outline=accent,
                width=4
            )

        draw.ellipse(
            [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
            fill=accent
        )

        # Inner highlight
        draw.ellipse(
            [center_x - radius // 2, center_y - radius // 2,
             center_x + radius // 2, center_y + radius // 2],
            fill=(255, 255, 255)
        )

        # Output to base64
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "status": "success",
            "engine": "sandbox_synthesis",
            "b64_json": b64_str,
            "url": f"data:image/png;base64,{b64_str}",
            "width": w,
            "height": h,
            "theme_id": req.theme_id,
            "note": "Synthesized sandbox asset ready for background removal pipeline."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


