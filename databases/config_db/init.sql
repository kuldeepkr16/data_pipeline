-- Create the standardized pipeline configuration table
CREATE TABLE IF NOT EXISTS pipeline_config (
    -- Shared Identity
    source_tablename TEXT PRIMARY KEY,
    sink_tablename TEXT,

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

-- Insert dummy data
INSERT OR IGNORE INTO pipeline_config (
    source_tablename, sink_tablename, 
    source_to_dl_schedule, source_to_dl_load_type, source_to_dl_is_active, source_type, source_to_dl_incremental_key,
    dl_to_sink_schedule, dl_to_sink_load_type, dl_to_sink_is_active, sink_type
) VALUES
('customers', 'customers', 60, 'full', 1, 'postgres', NULL, 60, 'full', 1, 'postgres'),
('orders', 'orders', 30, 'incremental', 1, 'postgres', 'order_date', 30, 'incremental', 1, 'postgres');
