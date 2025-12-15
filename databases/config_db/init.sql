-- Create the configuration table
CREATE TABLE IF NOT EXISTS table_config (
    table_name TEXT PRIMARY KEY,
    schedule_in_mins INTEGER NOT NULL,
    load_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    source_type TEXT DEFAULT 'postgres',
    incremental_key TEXT,
    last_incremental_value TIMESTAMP,
    last_loader_run_timestamp TIMESTAMP,
    last_loader_run_status TEXT,
    sink_type TEXT DEFAULT 'postgres',
    last_sink_run_timestamp TIMESTAMP,
    last_sink_status TEXT
);

-- Insert dummy data
INSERT OR IGNORE INTO table_config (table_name, schedule_in_mins, load_type, is_active, source_type, incremental_key, last_incremental_value, sink_type) VALUES
('customers', 60, 'full', 1, 'postgres', NULL, NULL, 'postgres'),
('orders', 30, 'incremental', 1, 'postgres', 'order_date', NULL, 'postgres');
