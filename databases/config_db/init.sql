-- Create the standardized pipeline configuration table
-- DEPRECATED: Splitting into sources_config and destinations_config
CREATE TABLE IF NOT EXISTS pipeline_config (
    -- Shared Identity
    source_tablename TEXT PRIMARY KEY,
    sink_tablename TEXT,
    source_name TEXT,
    destination_name TEXT,

    -- Source to Data Lake Config
    source_to_dl_schedule INTEGER,
    source_to_dl_load_type TEXT,
    source_to_dl_is_active BOOLEAN DEFAULT 1,
    source_type TEXT DEFAULT 'postgres',
    source_to_dl_incremental_key TEXT,
    source_to_dl_last_incremental_value TIMESTAMP,
    source_to_dl_last_loader_run_timestamp TIMESTAMP,
    source_to_dl_last_loader_run_status TEXT,

    -- Data Lake to Sink Config
    dl_to_sink_schedule INTEGER,
    dl_to_sink_load_type TEXT,
    dl_to_sink_is_active BOOLEAN DEFAULT 1,
    sink_type TEXT DEFAULT 'postgres',
    dl_to_sink_incremental_key TEXT,
    dl_to_sink_last_incremental_value TIMESTAMP,
    dl_to_sink_last_loader_run_timestamp TIMESTAMP,
    dl_to_sink_last_loader_run_status TEXT
);

-- NEW: Sources Configuration (Connections)
CREATE TABLE IF NOT EXISTS sources_config (
    id TEXT PRIMARY KEY, -- UUID
    source_name TEXT UNIQUE NOT NULL,
    source_type TEXT DEFAULT 'postgres',
    source_creds TEXT, -- JSON: {host, port, user, password, dbname}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NEW: Destinations Configuration (Connections)
CREATE TABLE IF NOT EXISTS destinations_config (
    id TEXT PRIMARY KEY, -- UUID
    destination_name TEXT UNIQUE NOT NULL,
    destination_type TEXT DEFAULT 'postgres',
    destination_creds TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the pipeline run logs table for tracking execution history
CREATE TABLE IF NOT EXISTS pipeline_run_stage_logs (
    id TEXT PRIMARY KEY,
    source_tablename TEXT NOT NULL,
    pipeline_type TEXT NOT NULL,  -- 'source_to_dl' or 'dl_to_sink'
    status TEXT NOT NULL,         -- 'success', 'failed', 'running'
    error_message TEXT,
    rows_processed INTEGER,
    file_paths TEXT,              -- Comma-separated MinIO/S3 paths for files processed
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    time_taken TEXT,              -- Duration in HH:MM:SS format
    pipeline_run_id TEXT,      -- Links to pipeline_runs_master for grouped execution
    stage_order INTEGER,          -- Order of this stage in the pipeline run
    FOREIGN KEY (source_tablename) REFERENCES pipeline_config(source_tablename),
    FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs_master(id)
);

-- Pipeline stage definitions (config-driven pipeline structure)
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    pipeline_name TEXT NOT NULL,      -- e.g., 'default', 'full_sync', 'incremental'
    stage_order INTEGER NOT NULL,     -- 1, 2, 3... execution order
    stage_name TEXT NOT NULL,         -- Display name: 'Extract from Source', 'Load to Data Lake'
    stage_type TEXT NOT NULL,         -- 'source_to_dl' or 'dl_to_sink'
    driver_container TEXT NOT NULL,   -- Container to execute: 'driver_source_to_dl'
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pipeline_name, stage_order)
);

-- Pipeline runs (tracks full pipeline execution across all stages)
CREATE TABLE IF NOT EXISTS pipeline_runs_master (
    id TEXT PRIMARY KEY,
    source_tablename TEXT NOT NULL,
    pipeline_name TEXT NOT NULL,      -- Which pipeline definition to use
    status TEXT NOT NULL,             -- 'pending', 'running', 'success', 'failed', 'partial'
    current_stage INTEGER DEFAULT 0,  -- Current stage being executed
    total_stages INTEGER,             -- Total stages in this pipeline
    triggered_by TEXT DEFAULT 'manual', -- 'manual', 'schedule', 'api'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (source_tablename) REFERENCES pipeline_config(source_tablename)
);

-- Insert default pipeline stages (5 granular stages)
INSERT OR IGNORE INTO pipeline_stages (pipeline_name, stage_order, stage_name, stage_type, driver_container) VALUES
('default', 1, 'Driver: Source to DL', 'driver_source_to_dl', 'driver_source_to_dl'),
('default', 2, 'Loader: Source to DL', 'loader_source_to_dl', 'driver_source_to_dl'),
('default', 3, 'Verify MinIO File', 'verify_minio', 'backend'),
('default', 4, 'Driver: DL to Sink', 'driver_dl_to_sink', 'driver_dl_to_sink'),
('default', 5, 'Loader: DL to Sink', 'loader_dl_to_sink', 'driver_dl_to_sink');


