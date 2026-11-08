-- Migration: 003_aidc_studio.sql
-- Module: AIDC Studio (Automatic Identification & Data Capture)
-- Compatibility: SQLite 3.35+ / PostgreSQL 14+

CREATE TABLE IF NOT EXISTS aidc_prefix_registry (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    gs1_company_prefix TEXT NOT NULL, -- e.g. '0950110'
    prefix_length INTEGER NOT NULL DEFAULT 7,
    next_item_reference INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aidc_projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_symbology TEXT NOT NULL DEFAULT 'code128',
    settings_override TEXT DEFAULT '{}',
    is_archived BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aidc_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    user_id TEXT NOT NULL DEFAULT 'anonymous',
    symbology TEXT NOT NULL,
    raw_payload TEXT NOT NULL,
    formatted_payload TEXT,
    check_digit TEXT,
    title TEXT,
    sku TEXT,
    visual_config TEXT NOT NULL DEFAULT '{}',
    is_favorite BOOLEAN NOT NULL DEFAULT 0,
    asset_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aidc_assets_ws ON aidc_assets(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aidc_assets_symbology ON aidc_assets(symbology);
CREATE INDEX IF NOT EXISTS idx_aidc_assets_sku ON aidc_assets(sku);

CREATE TABLE IF NOT EXISTS aidc_exports (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    user_id TEXT NOT NULL,
    export_format TEXT NOT NULL, -- 'pdf', 'png_zip', 'svg_zip', 'docx', 'xlsx', 'json'
    status TEXT NOT NULL DEFAULT 'completed',
    total_records INTEGER NOT NULL DEFAULT 1,
    success_count INTEGER NOT NULL DEFAULT 1,
    file_storage_key TEXT,
    file_size_bytes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aidc_templates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT, -- NULL denotes global preset
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'Retail', 'Healthcare', 'Manufacturing', 'Logistics', 'Marketing'
    symbology TEXT NOT NULL,
    description TEXT,
    payload_pattern TEXT,
    default_config TEXT NOT NULL,
    is_system_preset BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aidc_generation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT DEFAULT 'default',
    user_id TEXT DEFAULT 'anonymous',
    symbology TEXT NOT NULL,
    payload_length INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'success', 'invalid', 'error'
    error_code TEXT,
    execution_time_ms INTEGER NOT NULL,
    client_ip_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

