import sqlite3
import os
import time
import logging
import subprocess
import sys
from datetime import datetime, timedelta, timezone

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))
from typing import List, Dict, Any, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Config
DB_PATH = os.getenv('CONFIG_DB_PATH', '/data/config.db')

def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Config database not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_active_configs(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    query = """
    SELECT 
        source_tablename, 
        source_to_dl_schedule, 
        source_to_dl_load_type, 
        source_type, 
        source_to_dl_last_loader_run_timestamp,
        source_to_dl_incremental_key,
        source_to_dl_last_incremental_value
    FROM pipeline_config 
    WHERE source_to_dl_is_active = 1
    """
    cursor.execute(query)
    configs = [dict(row) for row in cursor.fetchall()]
    return configs

def should_run_now(config: Dict[str, Any]) -> bool:
    source_tablename = config['source_tablename']
    schedule_mins = config['source_to_dl_schedule']
    last_run_str = config['source_to_dl_last_loader_run_timestamp']

    if not last_run_str:
        logger.info(f"Table {source_tablename} has never been run, scheduling now")
        return True

    try:
        last_run = datetime.fromisoformat(last_run_str)
        next_run = last_run + timedelta(minutes=schedule_mins)
        if datetime.now(IST) >= next_run:
            logger.info(f"Table {source_tablename} is due to run (last run: {last_run}, schedule: {schedule_mins}m)")
            return True
    except ValueError:
        logger.warning(f"Invalid timestamp format for {source_tablename}, scheduling now")
        return True
    
    return False

def trigger_loader(config: Dict[str, Any]) -> tuple:
    """
    Triggers the appropriate loader script based on source_type.
    Returns: (status, new_incremental_value, error_message, rows_processed, file_path)
    """
    source_tablename = config['source_tablename']
    source_type = config['source_type']
    load_type = config['source_to_dl_load_type']
    
    logger.info(f"Triggering loader for table: {source_tablename}, source: {source_type}, load_type: {load_type}")

    # Determine loader script path based on source_type
    # Example: postgres -> /loaders/postgres_to_dl/main.py
    loader_script_map = {
        'postgres': '/loaders/postgres_to_dl/main.py'
    }

    script_path = loader_script_map.get(source_type)
    if not script_path or not os.path.exists(script_path):
        error_msg = f"Loader script not found for source type: {source_type} at {script_path}"
        logger.error(error_msg)
        return 'failed', None, error_msg, None, None

    # Prepare environment variables for the loader
    env = os.environ.copy()
    env['SOURCE_TABLENAME'] = source_tablename
    env['LOAD_TYPE'] = load_type
    env['SOURCE_TYPE'] = source_type
    
    # Pass incremental config if needed
    if config['source_to_dl_incremental_key']:
         env['INCREMENTAL_KEY'] = config['source_to_dl_incremental_key']
    
    if config['source_to_dl_last_incremental_value']:
         env['LAST_INCREMENTAL_VALUE'] = str(config['source_to_dl_last_incremental_value'])

    try:
        # Run the loader as a subprocess
        result = subprocess.run(
            [sys.executable, script_path],
            env=env,
            capture_output=True,
            text=True,
            timeout=3600 # 1 hour timeout
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully loaded table: {source_tablename}")
            
            # Parse output for metadata
            lines = result.stdout.strip().split('\n')
            new_incremental_value = None
            rows_processed = None
            file_paths = []
            
            for line in lines:
                if "LAST_INCREMENTAL_VALUE:" in line:
                    new_incremental_value = line.split("LAST_INCREMENTAL_VALUE:")[1].strip()
                    logger.info(f"Loader returned last_incremental_value: {new_incremental_value}")
                if "ROWS_PROCESSED:" in line:
                    try:
                        rows_processed = int(line.split("ROWS_PROCESSED:")[1].strip())
                    except ValueError:
                        pass
                if "FILE_PATH:" in line:
                    file_paths.append(line.split("FILE_PATH:")[1].strip())
            
            # Join file paths with comma separator
            file_paths_str = ",".join(file_paths) if file_paths else None
            return 'success', new_incremental_value, None, rows_processed, file_paths_str
        else:
            error_msg = result.stderr[:500] if result.stderr else "Unknown error"
            logger.error(f"Loader failed for {source_tablename}. Stderr: {error_msg}")
            return 'failed', None, error_msg, None, None

    except subprocess.TimeoutExpired:
        error_msg = f"Loader timed out after 1 hour"
        logger.error(f"Loader timed out for {source_tablename}")
        return 'failed', None, error_msg, None, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error triggering loader: {e}")
        return 'failed', None, error_msg, None, None

def calculate_time_taken(started_at: datetime, completed_at: datetime) -> str:
    """Calculate time taken in HH:MM:SS format"""
    delta = completed_at - started_at
    total_seconds = int(delta.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def log_pipeline_run(conn: sqlite3.Connection, source_tablename: str, pipeline_type: str, 
                     status: str, error_message: Optional[str] = None, 
                     rows_processed: Optional[int] = None, file_paths: Optional[str] = None,
                     started_at: Optional[datetime] = None):
    """Insert a record into pipeline_run_logs table"""
    cursor = conn.cursor()
    completed_at = datetime.now(IST)
    completed_at_str = completed_at.isoformat() if status in ['success', 'failed'] else None
    started_at_str = started_at.isoformat() if started_at else None
    
    # Calculate time taken in HH:MM:SS format
    time_taken = None
    if started_at and status in ['success', 'failed']:
        time_taken = calculate_time_taken(started_at, completed_at)
    
    cursor.execute("""
        INSERT INTO pipeline_run_logs 
        (source_tablename, pipeline_type, status, error_message, rows_processed, file_paths, started_at, completed_at, time_taken)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (source_tablename, pipeline_type, status, error_message, rows_processed, file_paths, started_at_str, completed_at_str, time_taken))
    conn.commit()
    logger.info(f"Logged pipeline run for {source_tablename}: {status} (time: {time_taken})")

def update_execution_status(conn: sqlite3.Connection, source_tablename: str, status: str, 
                           new_inc_val: Optional[str] = None, error_message: Optional[str] = None,
                           rows_processed: Optional[int] = None, file_paths: Optional[str] = None,
                           started_at: Optional[datetime] = None):
    cursor = conn.cursor()
    now = datetime.now(IST).isoformat()
    
    query = """
    UPDATE pipeline_config
    SET source_to_dl_last_loader_run_timestamp = ?, 
        source_to_dl_last_loader_run_status = ?
    WHERE source_tablename = ?
    """
    params = [now, status, source_tablename]
    cursor.execute(query, params)
    
    if new_inc_val:
        cursor.execute("UPDATE pipeline_config SET source_to_dl_last_incremental_value = ? WHERE source_tablename = ?", (new_inc_val, source_tablename))
        logger.info(f"Updated source_to_dl_last_incremental_value for {source_tablename}: {new_inc_val}")
        
    conn.commit()
    logger.info(f"Updated loader run status for {source_tablename}: {status} at {now}")
    
    # Log to pipeline_run_logs table
    log_pipeline_run(conn, source_tablename, 'source_to_dl', status, error_message, rows_processed, file_paths, started_at)

def main():
    logger.info("Starting driver script for source to dl loaders")
    try:
        conn = get_db_connection()
        configs = get_active_configs(conn)
        
        logger.info(f"Found {len(configs)} active configurations")
        
        for config in configs:
            if should_run_now(config):
                started_at = datetime.now(IST)
                status, new_inc_val, error_msg, rows_processed, file_paths = trigger_loader(config)
                update_execution_status(
                    conn, 
                    config['source_tablename'], 
                    status, 
                    new_inc_val, 
                    error_msg, 
                    rows_processed, 
                    file_paths,
                    started_at
                )
        
        conn.close()
        logger.info("Driver script completed.")
        
    except Exception as e:
        logger.error(f"Driver execution failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
