#!/usr/bin/env python3
"""
Driver Script for Datalake to Sink Loaders
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DB_PATH = os.getenv("CONFIG_DB_PATH", "/data/config.db")

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logger.error(f"Error connecting to database: {e}")
        raise

def get_sink_configs(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Get active sink configurations from table_config"""
    cursor = conn.cursor()
    # Select configs where sink_type is active (not null/empty) and table is active
    query = """
        SELECT table_name, schedule_in_mins, last_sink_run_timestamp, load_type, sink_type
        FROM table_config
        WHERE is_active = 1 AND sink_type IS NOT NULL AND sink_type != ''
    """
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]

def should_run_now(config: Dict[str, Any]) -> bool:
    table_name = config['table_name']
    schedule_mins = config['schedule_in_mins']
    last_run_str = config['last_sink_run_timestamp']

    if not last_run_str:
        logger.info(f"Table {table_name} has never been run (sink), scheduling now")
        return True

    last_run = datetime.fromisoformat(last_run_str)
    next_run = last_run + timedelta(minutes=schedule_mins)
    if datetime.now() >= next_run:
        logger.info(f"Table {table_name} is due to run (sink)")
        return True
    
    return False

def trigger_loader(config: Dict[str, Any]) -> bool:
    table_name = config['table_name']
    # Loader path: /loaders/datalake_to_postgres/main.py
    # In docker, we will mount ./data_pipeline_resources/datalake_to_sink:/loaders
    loader_script = Path("/loaders/datalake_to_postgres/main.py")
    
    if not loader_script.exists():
        logger.error(f"Loader script not found: {loader_script}")
        return False

    env = os.environ.copy()
    env['TABLE_NAME'] = table_name
    env['LOAD_TYPE'] = config['load_type'] 
    
    try:
        result = subprocess.run(
            [sys.executable, str(loader_script)],
            env=env,
            capture_output=True,
            text=True,
            timeout=3600
        )
        if result.returncode == 0:
            logger.info(f"Successfully loaded {table_name} to sink")
            logger.info(result.stdout)
            return True
        else:
            logger.error(f"Loader failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Error executing loader: {e}")
        return False

def update_status(conn: sqlite3.Connection, table_name: str, success: bool):
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    status = "success" if success else "failed"
    cursor.execute("""
        UPDATE table_config 
        SET last_sink_run_timestamp = ?, last_sink_status = ?
        WHERE table_name = ?
    """, (now, status, table_name))
    conn.commit()

def main():
    logger.info("Starting Datalake to Sink Driver")
    try:
        conn = get_db_connection()
        configs = get_sink_configs(conn)
        
        for config in configs:
            if should_run_now(config):
                success = trigger_loader(config)
                update_status(conn, config['table_name'], success)
        
        conn.close()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
