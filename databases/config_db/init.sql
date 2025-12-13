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
    last_loader_run_status TEXT
);

-- Insert dummy data
-- customers: full load (dimension table), no incremental fields needed
-- orders: incremental load using order_date as the incremental key
INSERT OR IGNORE INTO table_config (table_name, schedule_in_mins, load_type, is_active, source_type, incremental_key, last_incremental_value) VALUES
('customers', 60, 'full', 1, 'postgres', NULL, NULL),
('orders', 30, 'incremental', 1, 'postgres', 'order_date', NULL);

