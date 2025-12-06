-- Create the configuration table
CREATE TABLE IF NOT EXISTS table_config (
    table_name TEXT PRIMARY KEY,
    schedule_in_mins INTEGER NOT NULL,
    load_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1
);

-- Insert dummy data
INSERT OR IGNORE INTO table_config (table_name, schedule_in_mins, load_type, is_active) VALUES
('customers', 60, 'full', 1),
('orders', 30, 'incremental', 1);

