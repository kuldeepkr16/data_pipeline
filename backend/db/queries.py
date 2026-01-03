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
    SELECT * FROM pipeline_runs_master 
    ORDER BY started_at DESC 
    LIMIT 50
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
