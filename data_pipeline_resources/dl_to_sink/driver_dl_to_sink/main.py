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

def get_sink_configs(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Get active sink configurations from pipeline_config"""
    cursor = conn.cursor()
    # Select configs where sink_type is active (not null/empty) and pipeline is active for sink (dl_to_sink_isactive)
    query = """
        SELECT 
            source_tablename, 
            sink_tablename,
            dl_to_sink_schedule, 
            dl_to_sink_last_loader_run_timestamp, 
            dl_to_sink_load_type, 
            sink_type
        FROM pipeline_config
        WHERE dl_to_sink_is_active = 1 AND sink_type IS NOT NULL AND sink_type != ''
    """
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]

def should_run_now(config: Dict[str, Any]) -> bool:
    source_tablename = config['source_tablename'] # Use source name for logging, or sink name? Using source for consistency.
    schedule_mins = config['dl_to_sink_schedule']
    last_run_str = config['dl_to_sink_last_loader_run_timestamp']

    if not last_run_str:
        logger.info(f"Table {source_tablename} has never been run (sink), scheduling now")
        return True

    try:
        last_run = datetime.fromisoformat(last_run_str)
        next_run = last_run + timedelta(minutes=schedule_mins)
        if datetime.now(IST) >= next_run:
            logger.info(f"Table {source_tablename} is due to run (sink)")
            return True
    except ValueError:
        logger.warning(f"Invalid timestamp format for {source_tablename}, scheduling now")
        return True
    
    return False

def trigger_loader(config: Dict[str, Any]) -> tuple:
    """
    Triggers the appropriate loader script based on sink_type.
    Returns: (status, error_message, rows_processed, file_path)
    """
    source_table_name = config['source_tablename']
    sink_table_name = config['sink_tablename']
    sink_type = config['sink_type']
    
    # Determine loader based on sink_type (e.g. postgres)
    # Loader path: /loaders/dl_to_postgres/main.py
    # In docker, we will mount ./data_pipeline_resources/dl_to_sink:/loaders
    
    loader_script_map = {
        'postgres': '/loaders/dl_to_postgres/main.py'
    }
    
    loader_script = loader_script_map.get(sink_type)
    
    if not loader_script or not os.path.exists(loader_script):
        error_msg = f"Loader script not found for sink type {sink_type}: {loader_script}"
        logger.error(error_msg)
        return 'failed', error_msg, None, None

    env = os.environ.copy()
    env['SOURCE_TABLE_NAME'] = source_table_name
    env['SINK_TABLENAME'] = sink_table_name
    env['LOAD_TYPE'] = config['dl_to_sink_load_type']
    env['SOURCE_TYPE'] = config.get('source_type', 'postgres') # Default for safety, but DB should have it
    
    try:
        result = subprocess.run(
            [sys.executable, str(loader_script)],
            env=env,
            capture_output=True,
            text=True,
            timeout=3600
        )
        if result.returncode == 0:
            logger.info(f"Successfully loaded {source_table_name} to sink table {sink_table_name}")
            logger.info(result.stdout)
            
            # Parse output for metadata
            lines = result.stdout.strip().split('\n')
            rows_processed = None
            file_paths = []
            
            for line in lines:
                if "ROWS_PROCESSED:" in line:
                    try:
                        rows_processed = int(line.split("ROWS_PROCESSED:")[1].strip())
                    except ValueError:
                        pass
                if "FILE_PATH:" in line:
                    file_paths.append(line.split("FILE_PATH:")[1].strip())
            
            # Join file paths with comma separator
            file_paths_str = ",".join(file_paths) if file_paths else None
            return 'success', None, rows_processed, file_paths_str
        else:
            error_msg = result.stderr[:500] if result.stderr else "Unknown error"
            logger.error(f"Loader failed: {error_msg}")
            return 'failed', error_msg, None, None
    except subprocess.TimeoutExpired:
        error_msg = "Loader timed out after 1 hour"
        logger.error(f"Loader timed out for {source_table_name}")
        return 'failed', error_msg, None, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error executing loader: {e}")
        return 'failed', error_msg, None, None

def calculate_time_taken(started_at: datetime, completed_at: datetime) -> str:
    """Calculate time taken in HH:MM:SS.mmm format (includes milliseconds)"""
    delta = completed_at - started_at
    total_seconds = delta.total_seconds()
    hours, remainder = divmod(int(total_seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = int((total_seconds - int(total_seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

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

def update_status(conn: sqlite3.Connection, source_tablename: str, status: str,
                  error_message: Optional[str] = None, rows_processed: Optional[int] = None,
                  file_paths: Optional[str] = None, started_at: Optional[datetime] = None):
    cursor = conn.cursor()
    now = datetime.now(IST).isoformat()
    cursor.execute("""
        UPDATE pipeline_config 
        SET dl_to_sink_last_loader_run_timestamp = ?, dl_to_sink_last_loader_run_status = ?
        WHERE source_tablename = ?
    """, (now, status, source_tablename))
    conn.commit()
    
    # Log to pipeline_run_logs table
    log_pipeline_run(conn, source_tablename, 'dl_to_sink', status, error_message, rows_processed, file_paths, started_at)

def main():
    logger.info("Starting DL to Sink Driver")
    try:
        conn = get_db_connection()
        configs = get_sink_configs(conn)
        
        logger.info(f"Found {len(configs)} active sink configurations")
        
        for config in configs:
            if should_run_now(config):
                started_at = datetime.now(IST)
                status, error_msg, rows_processed, file_paths = trigger_loader(config)
                update_status(
                    conn, 
                    config['source_tablename'], 
                    status,
                    error_msg,
                    rows_processed,
                    file_paths,
                    started_at
                )
        
        conn.close()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
