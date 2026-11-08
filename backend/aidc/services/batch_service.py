"""
AIDC Batch Processing Service
High-throughput CSV and Excel ingestion, parallel validation, and ZIP package generation.
"""
import io
import csv
import zipfile
import base64
from typing import Dict, Any, List, Optional
import openpyxl

from .validation_service import ValidationService
from .render_service import RenderService
from ..schemas import BarcodeExportItem

class BatchService:
    @classmethod
    def parse_tabular_file(cls, content_bytes: bytes, filename: str) -> List[Dict[str, str]]:
        """
        Parses CSV or Excel (.xlsx) file into normalized row dictionaries.
        """
        rows: List[Dict[str, str]] = []
        lower_name = filename.lower()

        if lower_name.endswith('.csv') or lower_name.endswith('.txt'):
            text = content_bytes.decode('utf-8', errors='replace')
            reader = csv.reader(io.StringIO(text))
            raw_rows = [r for r in reader if any(field.strip() for field in r)]
            if not raw_rows:
                return []
            headers = [h.strip().lower() for h in raw_rows[0]]
            for r in raw_rows[1:]:
                row_dict = {}
                for idx, h in enumerate(headers):
                    row_dict[h] = r[idx].strip() if idx < len(r) else ""
                rows.append(row_dict)

        elif lower_name.endswith('.xlsx'):
            wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
            sheet = wb.active
            all_vals = list(sheet.iter_rows(values_only=True))
            if not all_vals:
                return []
            headers = [str(h).strip().lower() if h is not None else f"col_{i}" for i, h in enumerate(all_vals[0])]
            for r in all_vals[1:]:
                if not any(cell is not None and str(cell).strip() for cell in r):
                    continue
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = r[idx] if idx < len(r) else ""
                    row_dict[h] = str(val).strip() if val is not None else ""
                rows.append(row_dict)

        return rows

    @classmethod
    def process_batch(
        cls,
        rows: List[Dict[str, str]],
        default_symbology: str = "code128",
        column_mapping: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Validates and processes a batch of rows.
        column_mapping can map:
        - payload: col_name
        - title: col_name
        - sku: col_name
        - symbology: col_name
        """
        mapping = column_mapping or {}
        payload_col = mapping.get("payload")
        title_col = mapping.get("title")
        sku_col = mapping.get("sku")
        sym_col = mapping.get("symbology")

        processed_items: List[Dict[str, Any]] = []
        valid_count = 0
        invalid_count = 0
        warning_count = 0

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            manifest_rows = [["Row", "Product Name", "SKU", "Symbology", "Payload", "Status", "Messages"]]

            for idx, r in enumerate(rows, start=1):
                # Resolve values based on mapping or fallback search
                if payload_col and payload_col in r:
                    payload = r[payload_col]
                else:
                    payload = r.get("gtin") or r.get("payload") or r.get("url") or r.get("data") or list(r.values())[0] if r else ""

                title = r.get(title_col, "") if title_col else (r.get("product name") or r.get("name") or r.get("title") or "")
                sku = r.get(sku_col, "") if sku_col else (r.get("sku") or r.get("part") or r.get("item") or "")
                symbology = r.get(sym_col, default_symbology) if sym_col else default_symbology

                # Validate
                v_res = ValidationService.validate(symbology, payload)
                status = v_res.status
                msg_list = v_res.errors + v_res.warnings
                msg_str = "; ".join(msg_list)

                if status == "valid":
                    valid_count += 1
                elif status == "warning":
                    warning_count += 1
                else:
                    invalid_count += 1

                # Generate SVG asset for ZIP
                svg_data = ""
                try:
                    svg_data = RenderService.render_svg(symbology, payload)
                    safe_sku = (sku or f"row_{idx}").replace(" ", "_").replace("/", "-")
                    filename = f"barcodes/{idx:04d}_{safe_sku}_{symbology}.svg"
                    zf.writestr(filename, svg_data)
                except Exception:
                    pass

                manifest_rows.append([
                    str(idx), title, sku, symbology, payload, status.upper(), msg_str
                ])

                processed_items.append({
                    "row": idx,
                    "title": title,
                    "sku": sku,
                    "symbology": symbology,
                    "payload": payload,
                    "status": status,
                    "errors": v_res.errors,
                    "warnings": v_res.warnings
                })

            # Write manifest.csv into the zip
            csv_buf = io.StringIO()
            writer = csv.writer(csv_buf)
            writer.writerows(manifest_rows)
            zf.writestr("audit_manifest.csv", csv_buf.getvalue())

        zip_b64 = base64.b64encode(zip_buf.getvalue()).decode('utf-8')

        return {
            "total_records": len(rows),
            "valid_count": valid_count,
            "warning_count": warning_count,
            "invalid_count": invalid_count,
            "items": processed_items[:200], # return first 200 items for preview table
            "zip_base64": zip_b64
        }

