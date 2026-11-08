"""
AIDC Storage Service
SQLite relational persistence for assets, templates, prefix settings, and analytics.
"""
import sqlite3
import os
import json
import uuid
import datetime
from typing import Dict, Any, List, Optional
from ..schemas import TemplateItem, AssetItem, PrefixSettings
from .validation_service import ValidationService

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "pixnivo_aidc.db")
MIGRATION_PATH = os.path.join(BACKEND_DIR, "migrations", "003_aidc_studio.sql")

class StorageService:
    @classmethod
    def get_connection(cls) -> sqlite3.Connection:
        os.makedirs(DATA_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    def init_database(cls):
        """
        Initializes schema and seeds default system templates.
        """
        conn = cls.get_connection()
        try:
            if os.path.exists(MIGRATION_PATH):
                with open(MIGRATION_PATH, "r", encoding="utf-8") as f:
                    script = f.read()
                conn.executescript(script)

            # Seed default templates if empty
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as count FROM aidc_templates")
            count = cur.fetchone()["count"]
            if count == 0:
                cls._seed_default_templates(conn)

            # Seed default GS1 Prefix Registry if empty
            cur.execute("SELECT COUNT(*) as count FROM aidc_prefix_registry")
            p_count = cur.fetchone()["count"]
            if p_count == 0:
                cur.execute("""
                    INSERT INTO aidc_prefix_registry (id, workspace_id, company_name, gs1_company_prefix, prefix_length, next_item_reference, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    "default",
                    "Pixnivo Enterprise Partner",
                    "0950110",
                    7,
                    101,
                    1
                ))
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def _seed_default_templates(cls, conn: sqlite3.Connection):
        templates = [
            (
                "tpl_retail_upca", "Retail: UPC-A (North America)", "Retail", "upca",
                "Standard 12-digit point-of-sale barcode for retail distribution in the US and Canada.",
                "036000291452", json.dumps({"scale": 4, "height_mm": 18, "show_text": True, "margin": 10})
            ),
            (
                "tpl_retail_ean13", "Retail: EAN-13 (Global POS)", "Retail", "ean13",
                "Standard 13-digit retail barcode recognized at point-of-sale systems worldwide.",
                "4006381333931", json.dumps({"scale": 4, "height_mm": 18, "show_text": True, "margin": 10})
            ),
            (
                "tpl_health_datamatrix", "Healthcare: GS1 DataMatrix (FDA UDI)", "Healthcare", "gs1datamatrix",
                "High-density 2D matrix compliant with FDA UDI & EU MDR medical device serialization.",
                "(01)09501101530008(17)261231(10)LOT789(21)SN1001", json.dumps({"scale": 5, "height_mm": 15, "ecc_level": "ECC200", "margin": 8})
            ),
            (
                "tpl_mfg_code128", "Manufacturing: Code 128 (Work-In-Progress)", "Manufacturing", "code128",
                "Alphanumeric tracking barcode for WIP assembly, serial tags, and carton labeling.",
                "WIP-PRO-2026-00124", json.dumps({"scale": 4, "height_mm": 15, "show_text": True, "margin": 10})
            ),
            (
                "tpl_logistics_gs1128", "Logistics: GS1-128 Shipping Label", "Logistics", "gs1-128",
                "Standard logistics shipping container barcode carrying SSCC, GTIN, and destination.",
                "(00)300123456789012345", json.dumps({"scale": 4, "height_mm": 25, "show_text": True, "margin": 12})
            ),
            (
                "tpl_logistics_pdf417", "Logistics: PDF417 Transport Manifest", "Logistics", "pdf417",
                "Stacked 2D barcode for air waybills, customs documents, and multi-line parcel manifests.",
                "WAYBILL: 8912-4412-US / CARRIER: PIXNIVO / PIECES: 4", json.dumps({"scale": 4, "height_mm": 16, "ecc_level": "M", "margin": 8})
            ),
            (
                "tpl_mktg_qr", "Marketing: Branded Dynamic QR Code", "Marketing", "qrcode",
                "Mobile-scannable QR code formatted for product landing pages and GS1 Digital Links.",
                "https://pixnivo.app/id/01/09501101530008", json.dumps({"scale": 5, "height_mm": 20, "ecc_level": "H", "margin": 10, "foreground": "#CF4A0C", "background": "#FFFFFF"})
            ),
        ]

        cur = conn.cursor()
        for t in templates:
            cur.execute("""
                INSERT OR IGNORE INTO aidc_templates (id, name, category, symbology, description, payload_pattern, default_config, is_system_preset)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, t)

    @classmethod
    def get_templates(cls, workspace_id: Optional[str] = None) -> List[TemplateItem]:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, name, category, symbology, description, payload_pattern, default_config, is_system_preset
                FROM aidc_templates
                ORDER BY is_system_preset DESC, category ASC, name ASC
            """)
            rows = cur.fetchall()
            result = []
            for r in rows:
                cfg = json.loads(r["default_config"]) if r["default_config"] else {}
                result.append(TemplateItem(
                    id=r["id"],
                    name=r["name"],
                    category=r["category"],
                    symbology=r["symbology"],
                    description=r["description"] or "",
                    payload_pattern=r["payload_pattern"],
                    default_config=cfg,
                    is_system_preset=bool(r["is_system_preset"])
                ))
            return result
        finally:
            conn.close()

    @classmethod
    def save_asset(cls, asset: Dict[str, Any]) -> str:
        conn = cls.get_connection()
        try:
            asset_id = asset.get("id") or str(uuid.uuid4())
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO aidc_assets (
                    id, project_id, workspace_id, user_id, symbology, raw_payload,
                    formatted_payload, check_digit, title, sku, visual_config, is_favorite, asset_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                asset_id,
                asset.get("project_id"),
                asset.get("workspace_id", "default"),
                asset.get("user_id", "anonymous"),
                asset.get("symbology", "code128"),
                asset.get("raw_payload", ""),
                asset.get("formatted_payload", asset.get("raw_payload", "")),
                asset.get("check_digit"),
                asset.get("title", ""),
                asset.get("sku", ""),
                json.dumps(asset.get("visual_config", {})),
                1 if asset.get("is_favorite") else 0,
                asset.get("asset_hash", str(uuid.uuid4())[:16])
            ))
            conn.commit()
            return asset_id
        finally:
            conn.close()

    @classmethod
    def list_assets(
        cls,
        workspace_id: str = "default",
        search: Optional[str] = None,
        symbology: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[AssetItem]:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            query = "SELECT * FROM aidc_assets WHERE 1=1"
            params: List[Any] = []

            if symbology:
                query += " AND symbology = ?"
                params.append(symbology.lower())

            if is_favorite is not None:
                query += " AND is_favorite = ?"
                params.append(1 if is_favorite else 0)

            if search:
                query += " AND (raw_payload LIKE ? OR title LIKE ? OR sku LIKE ?)"
                term = f"%{search}%"
                params.extend([term, term, term])

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()
            items = []
            for r in rows:
                vcfg = json.loads(r["visual_config"]) if r["visual_config"] else {}
                items.append(AssetItem(
                    id=r["id"],
                    symbology=r["symbology"],
                    raw_payload=r["raw_payload"],
                    formatted_payload=r["formatted_payload"],
                    check_digit=r["check_digit"],
                    title=r["title"],
                    sku=r["sku"],
                    visual_config=vcfg,
                    is_favorite=bool(r["is_favorite"]),
                    created_at=r["created_at"]
                ))
            return items
        finally:
            conn.close()

    @classmethod
    def toggle_favorite(cls, asset_id: str) -> bool:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT is_favorite FROM aidc_assets WHERE id = ?", (asset_id,))
            row = cur.fetchone()
            if not row:
                return False
            new_val = 0 if row["is_favorite"] else 1
            cur.execute("UPDATE aidc_assets SET is_favorite = ? WHERE id = ?", (new_val, asset_id))
            conn.commit()
            return bool(new_val)
        finally:
            conn.close()

    @classmethod
    def delete_asset(cls, asset_id: str) -> bool:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM aidc_assets WHERE id = ?", (asset_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    @classmethod
    def get_prefix_settings(cls, workspace_id: str = "default") -> PrefixSettings:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM aidc_prefix_registry WHERE workspace_id = ? AND is_active = 1 LIMIT 1", (workspace_id,))
            row = cur.fetchone()
            if row:
                return PrefixSettings(
                    company_name=row["company_name"],
                    gs1_company_prefix=row["gs1_company_prefix"],
                    next_item_reference=row["next_item_reference"],
                    is_active=bool(row["is_active"])
                )
            return PrefixSettings(
                company_name="Pixnivo Enterprise Workspace",
                gs1_company_prefix="0950110",
                next_item_reference=101,
                is_active=True
            )
        finally:
            conn.close()

    @classmethod
    def save_prefix_settings(cls, workspace_id: str, settings: PrefixSettings):
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id FROM aidc_prefix_registry WHERE workspace_id = ?", (workspace_id,))
            row = cur.fetchone()
            if row:
                cur.execute("""
                    UPDATE aidc_prefix_registry
                    SET company_name = ?, gs1_company_prefix = ?, next_item_reference = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE workspace_id = ?
                """, (settings.company_name, settings.gs1_company_prefix, settings.next_item_reference, 1 if settings.is_active else 0, workspace_id))
            else:
                cur.execute("""
                    INSERT INTO aidc_prefix_registry (id, workspace_id, company_name, gs1_company_prefix, next_item_reference, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), workspace_id, settings.company_name, settings.gs1_company_prefix, settings.next_item_reference, 1 if settings.is_active else 0))
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def log_generation(cls, symbology: str, payload_len: int, status: str, exec_time_ms: int, ip_hash: Optional[str] = None):
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO aidc_generation_logs (symbology, payload_length, status, execution_time_ms, client_ip_hash)
                VALUES (?, ?, ?, ?, ?)
            """, (symbology, payload_len, status, exec_time_ms, ip_hash or "anonymous"))
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

    @classmethod
    def get_analytics(cls) -> Dict[str, Any]:
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            # Total counts
            cur.execute("SELECT COUNT(*) as total FROM aidc_assets")
            total_assets = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) as total FROM aidc_generation_logs")
            total_generations = cur.fetchone()["total"]

            # Symbology breakdown
            cur.execute("""
                SELECT symbology, COUNT(*) as count
                FROM aidc_generation_logs
                GROUP BY symbology
                ORDER BY count DESC
                LIMIT 6
            """)
            top_symbologies = [{"symbology": r["symbology"], "count": r["count"]} for r in cur.fetchall()]

            # Status breakdown
            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM aidc_generation_logs
                GROUP BY status
            """)
            status_dist = {r["status"]: r["count"] for r in cur.fetchall()}

            return {
                "total_assets": total_assets,
                "total_generations": total_generations,
                "top_symbologies": top_symbologies,
                "status_distribution": status_dist,
                "storage_usage_kb": round(total_assets * 1.8, 1) # Estimated storage
            }
        finally:
            conn.close()

# Initialize DB on module load
StorageService.init_database()

