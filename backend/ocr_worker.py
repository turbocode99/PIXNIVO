"""PaddleOCR in its own process, one job at a time.

PaddleOCR's CPU inference keeps several GB after a single page (4.2 GB measured on
the server) and grows with each new image size. Running it inside the web server
made every other API request wait during a job and let that memory pile up until
the VM could run out. Here it lives in a child process that:
  - handles one job at a time (each job already uses every CPU core),
  - is replaced after every job, returning its memory to the system; the next
    process loads PaddleOCR (~3 s on the server) while the server is idle,
  - is killed and replaced if a job exceeds JOB_TIMEOUT or the process dies
    (for example killed for using too much memory), without affecting the API.
PDFs are rendered one page at a time, capped at MAX_PDF_PAGES pages and
PDF_TIME_BUDGET seconds. QUEUE_TIMEOUT + JOB_TIMEOUT stays under nginx's 300 s
proxy_read_timeout for /api/, so users get a message rather than a 504.
"""
import multiprocessing
import os
import threading
import time

MAX_SIDE = 2400           # longest image edge sent to OCR
MAX_PDF_PAGES = 20
PDF_DPI = 200
PDF_TIME_BUDGET = 150     # seconds: no new PDF page is started after this
JOBS_PER_PROCESS = 1
JOB_TIMEOUT = 230         # seconds for one file, then the process is killed
QUEUE_TIMEOUT = 60        # seconds a request waits for the previous job to finish


class OcrBusy(Exception):
    pass


class OcrBadInput(Exception):
    pass


class OcrFailed(Exception):
    pass


# ---------------------------------------------------------------- child process

def _prepare(img, enhance, work_dir):
    from PIL import Image, ImageEnhance, ImageOps
    img = ImageOps.exif_transpose(img)  # phone photos: honour the EXIF rotation
    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    if enhance == 'auto':
        img = ImageEnhance.Contrast(img).enhance(1.4)
    path = os.path.join(work_dir, 'page.jpg')
    img.convert('RGB').save(path, 'JPEG', quality=95)
    return path


def _read_lines(engine, path):
    lines = []
    for res in engine.ocr(path, cls=True) or []:
        for line in res or []:
            lines.append(line[1][0])
    return '\n'.join(lines) + ('\n' if lines else '')


def _ocr_file(engine, path, enhance, work_dir):
    from PIL import Image
    with open(path, 'rb') as f:
        is_pdf = f.read(5).startswith(b'%PDF-')
    if not is_pdf:
        try:
            img = Image.open(path)
            img.load()
        except Exception:
            raise OcrBadInput('This file isn’t an image or PDF that can be read. Try JPG, PNG, WEBP, HEIC or PDF.')
        return _read_lines(engine, _prepare(img, enhance, work_dir))

    from pdf2image import convert_from_path, pdfinfo_from_path
    try:
        pages = int(pdfinfo_from_path(path)['Pages'])
    except Exception:
        raise OcrBadInput('This PDF couldn’t be opened. It may be damaged or password-protected.')
    start, read, text = time.monotonic(), 0, ''
    for page in range(1, min(pages, MAX_PDF_PAGES) + 1):  # one page in memory at a time
        if read and time.monotonic() - start > PDF_TIME_BUDGET:
            break
        img = convert_from_path(path, dpi=PDF_DPI, first_page=page, last_page=page)[0]
        text += _read_lines(engine, _prepare(img, enhance, work_dir)) + '\n--- Page Break ---\n\n'
        read = page
    if read < pages:
        text += f'--- Only the first {read} of {pages} pages were read. Split the PDF to read the rest. ---\n'
    return text


def _warm_up(engine):
    """The first recognition in a new process is ~3 s slower (one-time setup inside
    Paddle). Run it on a small sample while the server is idle so jobs don't wait."""
    try:
        import numpy as np
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (960, 720), 'white')
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.load_default(size=28)
        except TypeError:  # Pillow < 10.1
            font = ImageFont.load_default()
        for i in range(6):
            draw.text((40, 30 + i * 40), 'Warm-up line: the quick brown fox 0123456789', fill='black', font=font)
        engine.ocr(np.asarray(img)[:, :, ::-1].copy(), cls=True)  # PaddleOCR expects BGR
    except Exception:
        pass


def _serve(conn):
    """Child process: load PaddleOCR once, then OCR the files sent over the pipe."""
    os.environ.setdefault('FLAGS_enable_pir_api', '0')
    os.environ.setdefault('FLAGS_enable_pir_in_executor', '0')
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except Exception:
        pass
    from paddleocr import PaddleOCR
    engine = PaddleOCR(use_angle_cls=True, use_gpu=False, lang='en', show_log=False)
    _warm_up(engine)
    while True:
        job = conn.recv()
        if job is None:
            return
        try:
            conn.send(('ok', _ocr_file(engine, *job)))
        except OcrBadInput as e:
            conn.send(('bad_input', str(e)))
        except Exception as e:
            conn.send(('error', str(e)))


# ---------------------------------------------------------------- parent side

class OcrWorker:
    def __init__(self):
        self._lock = threading.Lock()
        self._proc = None
        self._conn = None
        self._jobs = 0

    def start(self):
        """Start (and warm up) the child process if it isn't running."""
        if self._proc is not None and self._proc.is_alive():
            return
        self._stop()
        ctx = multiprocessing.get_context('spawn')  # never fork the web server
        parent_conn, child_conn = ctx.Pipe()
        self._proc = ctx.Process(target=_serve, args=(child_conn,), daemon=True, name='pixnivo-ocr-worker')
        self._proc.start()
        child_conn.close()
        self._conn = parent_conn
        self._jobs = 0

    def stop(self):
        self._stop()  # shutdown: a job still running just fails

    def _stop(self):
        if self._proc is not None:
            self._proc.kill()
            self._proc.join(5)
        if self._conn is not None:
            self._conn.close()
        self._proc = self._conn = None

    def run(self, path, enhance, work_dir):
        """OCR one file and return its text. Blocking: call from a worker thread."""
        if not self._lock.acquire(timeout=QUEUE_TIMEOUT):
            raise OcrBusy()
        try:
            self.start()
            try:
                self._conn.send((path, enhance, work_dir))
                if not self._conn.poll(JOB_TIMEOUT):
                    self._stop()
                    raise OcrFailed('Text recognition took too long and was stopped. Try a smaller or clearer file.')
                status, value = self._conn.recv()
            except (EOFError, BrokenPipeError, ConnectionResetError, OSError):
                # The child died mid-job, usually killed for using too much memory
                self._stop()
                raise OcrFailed('This file was too large or complex to read. Try fewer pages or a smaller image.')
            self._jobs += 1
            if self._jobs >= JOBS_PER_PROCESS:
                self._stop()
                self.start()  # warm a fresh process for the next job
            if status == 'bad_input':
                raise OcrBadInput(value)
            if status == 'error':
                raise OcrFailed(value)
            return value
        finally:
            self._lock.release()


worker = OcrWorker()
