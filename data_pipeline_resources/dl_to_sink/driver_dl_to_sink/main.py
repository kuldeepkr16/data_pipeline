import sqlite3
import os
import time
import logging
import subprocess
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

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
        if datetime.now() >= next_run:
            logger.info(f"Table {source_tablename} is due to run (sink)")
            return True
    except ValueError:
        logger.warning(f"Invalid timestamp format for {source_tablename}, scheduling now")
        return True
    
    return False

def trigger_loader(config: Dict[str, Any]) -> bool:
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
        logger.error(f"Loader script not found for sink type {sink_type}: {loader_script}")
        return False

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
            return True
        else:
            logger.error(f"Loader failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        logger.error(f"Loader timed out for {source_table_name}")
        return False
    except Exception as e:
        logger.error(f"Error executing loader: {e}")
        return False

def update_status(conn: sqlite3.Connection, source_tablename: str, success: bool):
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    status = "success" if success else "failed"
    cursor.execute("""
        UPDATE pipeline_config 
        SET dl_to_sink_last_loader_run_timestamp = ?, dl_to_sink_last_loader_run_status = ?
        WHERE source_tablename = ?
    """, (now, status, source_tablename))
    conn.commit()

def main():
    logger.info("Starting DL to Sink Driver")
    try:
        conn = get_db_connection()
        configs = get_sink_configs(conn)
        
        logger.info(f"Found {len(configs)} active sink configurations")
        
        for config in configs:
            if should_run_now(config):
                success = trigger_loader(config)
                update_status(conn, config['source_tablename'], success)
        
        conn.close()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
