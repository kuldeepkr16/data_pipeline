# Pipeline Config Queries
GET_ALL_CONFIGS = "SELECT * FROM pipeline_config"
GET_CONFIG_BY_TABLE = "SELECT * FROM pipeline_config WHERE source_tablename = ?"
CHECK_TABLE_EXISTS = "SELECT source_tablename FROM pipeline_config WHERE source_tablename = ? limit 1"

# Logs Queries
GET_ALL_LOGS_BASE = """
    SELECT * FROM pipeline_run_stage_logs
    WHERE 1=1
"""

GET_LOGS_BY_TABLE = """
    SELECT * FROM pipeline_run_stage_logs 
    WHERE source_tablename = ? 
    ORDER BY started_at DESC
"""

# Stats Queries
GET_LOADED_RECORDS_STATS = """
    SELECT 
        source_tablename,
        SUM(COALESCE(rows_processed, 0)) as total_loaded
    FROM pipeline_run_stage_logs 
    WHERE pipeline_type = 'loader_dl_to_sink'
    AND status = 'success'
    AND started_at >= ?
    GROUP BY source_tablename
"""

GET_STATUS_DISTRIBUTION = """
    SELECT status, COUNT(*) as count 
    FROM pipeline_run_stage_logs 
    GROUP BY status
"""

GET_PIPELINE_TYPE_DISTRIBUTION = """
    SELECT pipeline_type, COUNT(*) as count 
    FROM pipeline_run_stage_logs 
    GROUP BY pipeline_type
"""

GET_RUNS_PER_TABLE = """
    SELECT source_tablename, 
           COUNT(*) as total_runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
           SUM(COALESCE(rows_processed, 0)) as total_rows
    FROM pipeline_run_stage_logs 
    GROUP BY source_tablename
"""

GET_DAILY_RUNS = """
    SELECT DATE(started_at) as run_date, 
           COUNT(*) as runs,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM pipeline_run_stage_logs 
    WHERE started_at >= DATE('now', '-7 days')
    GROUP BY DATE(started_at)
    ORDER BY run_date
"""

GET_TOTAL_STATS = """
    SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(COALESCE(rows_processed, 0)) as total_rows_processed
    FROM pipeline_run_stage_logs
"""

# Stages Queries
GET_ALL_STAGES = """
    SELECT * FROM pipeline_stages 
    WHERE is_active = 1
    ORDER BY pipeline_name, stage_order
"""

GET_STAGES_BY_PIPELINE = """
    SELECT * FROM pipeline_stages 
    WHERE pipeline_name = ? AND is_active = 1
    ORDER BY stage_order
"""

CREATE_STAGE = """
    INSERT INTO pipeline_stages (id, pipeline_name, stage_order, stage_name, stage_type, driver_container)
    VALUES (?, ?, ?, ?, ?, ?)
"""

# Runs Queries
GET_ALL_RUNS_MASTER = """
    SELECT m.* 
    FROM pipeline_runs_master m
    JOIN (
        SELECT source_tablename, MAX(started_at) as max_started_at
        FROM pipeline_runs_master
        GROUP BY source_tablename
    ) latest ON m.source_tablename = latest.source_tablename 
    AND m.started_at = latest.max_started_at
    ORDER BY m.started_at DESC
"""

GET_STAGE_LOGS_BY_RUN_ID = """
    SELECT * FROM pipeline_run_stage_logs 
    WHERE pipeline_run_id = ?
    ORDER BY stage_order
"""

GET_RUN_MASTER_BY_ID = "SELECT * FROM pipeline_runs_master WHERE id = ?"

GET_RUNS_MASTER_BY_TABLE = """
    SELECT * FROM pipeline_runs_master 
    WHERE source_tablename = ?
    ORDER BY started_at DESC
    LIMIT 50
"""

# Execution & Trigger Queries
INSERT_STAGE_LOG_RUNNING = """
    INSERT INTO pipeline_run_stage_logs 
    (id, source_tablename, pipeline_type, status, started_at, pipeline_run_id, stage_order)
    VALUES (?, ?, ?, 'running', ?, ?, ?)
"""

UPDATE_RUN_MASTER_STAGE = """
    UPDATE pipeline_runs_master SET current_stage = ?, status = 'running'
    WHERE id = ?
"""

UPDATE_STAGE_LOG_SUCCESS = """
    UPDATE pipeline_run_stage_logs 
    SET status = 'success', completed_at = ?, time_taken = ?, 
        rows_processed = ?, file_paths = ?
    WHERE id = ?
"""

UPDATE_STAGE_LOG_FAILED = """
    UPDATE pipeline_run_stage_logs 
    SET status = 'failed', completed_at = ?, time_taken = ?, error_message = ?
    WHERE id = ?
"""

UPDATE_STAGE_LOG_TIMEOUT = """
    UPDATE pipeline_run_stage_logs 
    SET status = 'failed', completed_at = ?, error_message = 'Stage timeout after 5 minutes'
    WHERE id = ?
"""

UPDATE_STAGE_LOG_ERROR = """
    UPDATE pipeline_run_stage_logs 
    SET status = 'failed', completed_at = ?, error_message = ?
    WHERE id = ?
"""

UPDATE_RUN_MASTER_STATUS = """
    UPDATE pipeline_runs_master 
    SET status = ?, completed_at = ?, error_message = ?
    WHERE id = ?
"""

INSERT_RUN_MASTER_PENDING = """
    INSERT INTO pipeline_runs_master 
    (id, source_tablename, pipeline_name, status, total_stages, triggered_by, started_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
"""

# Sources Queries
GET_SOURCE_BY_NAME = "SELECT * FROM sources_config WHERE source_name = ?"
GET_SOURCE_BY_ID = "SELECT * FROM sources_config WHERE id = ?"
GET_ALL_SOURCES = "SELECT * FROM sources_config"
CHECK_SOURCE_EXISTS_BY_NAME = "SELECT id FROM sources_config WHERE source_name = ?"
INSERT_SOURCE = """
    INSERT INTO sources_config (
        id, source_name, source_type, source_creds
    ) VALUES (?, ?, ?, ?)
"""
DELETE_SOURCE_BY_NAME = "DELETE FROM sources_config WHERE source_name = ?"
UPDATE_SOURCE_BY_NAME = """
    UPDATE sources_config 
    SET source_type = ?, source_creds = ?
    WHERE source_name = ?
"""

# External Database Queries
GET_PUBLIC_TABLES = """
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
"""

# Destination Queries
GET_DESTINATION_BY_NAME = "SELECT * FROM destinations_config WHERE destination_name = ?"
GET_DESTINATION_BY_ID = "SELECT * FROM destinations_config WHERE id = ?"
GET_ALL_DESTINATIONS = "SELECT * FROM destinations_config"
CHECK_DESTINATION_EXISTS_BY_NAME = "SELECT id FROM destinations_config WHERE destination_name = ?"
INSERT_DESTINATION = """
    INSERT INTO destinations_config (
        id, destination_name, destination_type, destination_creds
    ) VALUES (?, ?, ?, ?)
"""
DELETE_DESTINATION_BY_NAME = "DELETE FROM destinations_config WHERE destination_name = ?"
UPDATE_DESTINATION_BY_NAME = """
    UPDATE destinations_config 
    SET destination_type = ?, destination_creds = ?
    WHERE destination_name = ?
"""

# Missing Pipeline Config Queries
INSERT_PIPELINE_CONFIG = """
    INSERT INTO pipeline_config (
        source_tablename, sink_tablename, source_name, destination_name, source_type, sink_type,
        source_to_dl_schedule, source_to_dl_load_type,
        dl_to_sink_schedule, dl_to_sink_load_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
DELETE_PIPELINE_CONFIG = "DELETE FROM pipeline_config WHERE source_tablename = ?"
