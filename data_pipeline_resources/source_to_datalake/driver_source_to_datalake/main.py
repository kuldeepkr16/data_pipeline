#!/usr/bin/env python3
"""
Driver Script for Source to Datalake Loaders

This script:
1. Reads configurations from SQLite config database
2. Selects which tables need to be loaded based on schedule and is_active status
3. Triggers the appropriate loader based on source type
4. Tracks execution status and last run times
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DB_PATH = os.getenv("CONFIG_DB_PATH", "/data/config.db")

def get_loader_base_path() -> Path:
    """Get the base path for loaders, checking Docker mount first"""
    # Check if loaders are mounted at /loaders (Docker) or use relative path (local)
    if Path("/loaders").exists() and Path("/loaders/postgres_to_datalake").exists():
        return Path("/loaders")
    else:
        return Path(__file__).parent.parent

LOADER_BASE_PATH = get_loader_base_path()

# Source type to loader mapping
SOURCE_LOADER_MAP = {
    "postgres": "postgres_to_datalake",
    "dynamo": "dynamo_to_datalake",
    "sheets": "sheets_to_datalake",
    "api": "api_to_datalake",
    "apis": "api_to_datalake",
}


def get_db_connection(db_path: str = DB_PATH):
    """Get SQLite database connection"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logger.error(f"Error connecting to database: {e}")
        raise


def ensure_execution_tracking_table(conn: sqlite3.Connection):
    """Create execution_tracking table if it doesn't exist"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_tracking (
            table_name TEXT PRIMARY KEY,
            last_run_time TIMESTAMP,
            last_status TEXT,
            last_error TEXT,
            FOREIGN KEY (table_name) REFERENCES table_config(table_name)
        )
    """)
    conn.commit()


def get_active_configs(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Get all active configurations from table_config"""
    cursor = conn.cursor()
    
    # Check which columns exist
    cursor.execute("PRAGMA table_info(table_config)")
    columns = [col[1] for col in cursor.fetchall()]
    has_source_type = 'source_type' in columns
    has_incremental_fields = 'incremental_key' in columns and 'last_incremental_value' in columns
    
    # Build SELECT query based on available columns
    select_fields = ['table_name', 'schedule_in_mins', 'load_type', 'is_active']
    
    if has_source_type:
        select_fields.append("COALESCE(source_type, 'postgres') as source_type")
    else:
        select_fields.append("'postgres' as source_type")
    
    if has_incremental_fields:
        select_fields.extend(['incremental_key', 'last_incremental_value'])
    
    query = f"""
        SELECT {', '.join(select_fields)}
        FROM table_config 
        WHERE is_active = 1
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    configs = [dict(row) for row in rows]
    
    # Add defaults for missing fields
    for config in configs:
        if 'source_type' not in config:
            config['source_type'] = 'postgres'
        if 'incremental_key' not in config:
            config['incremental_key'] = None
        if 'last_incremental_value' not in config:
            config['last_incremental_value'] = None
    
    return configs


def should_run_now(config: Dict[str, Any], conn: sqlite3.Connection) -> bool:
    """Check if a config should run now based on schedule and last run time"""
    table_name = config['table_name']
    schedule_mins = config['schedule_in_mins']
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT last_run_time FROM execution_tracking 
        WHERE table_name = ?
    """, (table_name,))
    
    result = cursor.fetchone()
    
    if result is None or result[0] is None:
        # Never run before, should run now
        logger.info(f"Table {table_name} has never been run, scheduling now")
        return True
    
    last_run = datetime.fromisoformat(result[0])
    next_run = last_run + timedelta(minutes=schedule_mins)
    now = datetime.now()
    
    if now >= next_run:
        logger.info(f"Table {table_name} is due to run (last: {last_run}, next: {next_run}, now: {now})")
        return True
    
    logger.debug(f"Table {table_name} not due yet (next run: {next_run})")
    return False


def get_loader_module_path(source_type: str) -> Optional[Path]:
    """Get the path to the loader module for a given source type"""
    loader_dir = SOURCE_LOADER_MAP.get(source_type.lower())
    if not loader_dir:
        logger.warning(f"No loader mapping found for source_type: {source_type}")
        return None
    
    loader_path = LOADER_BASE_PATH / loader_dir / "main.py"
    
    if not loader_path.exists():
        logger.warning(f"Loader not found at: {loader_path}")
        return None
    
    return loader_path




def trigger_loader(config: Dict[str, Any], loader_path: Path) -> Tuple[bool, Optional[str], Optional[str]]:
    """Trigger a loader script for a given configuration
    
    Returns:
        Tuple of (success: bool, error: Optional[str], last_incremental_value: Optional[str])
        last_incremental_value is the max timestamp processed, only set on success for incremental loads
    """
    table_name = config['table_name']
    load_type = config['load_type']
    source_type = config['source_type']
    incremental_key = config.get('incremental_key')
    last_incremental_value = config.get('last_incremental_value')
    
    logger.info(f"Triggering loader for table: {table_name}, source: {source_type}, load_type: {load_type}")
    if load_type == 'incremental' and incremental_key:
        logger.info(f"Incremental load: key={incremental_key}, last_value={last_incremental_value}")
    
    try:
        # Run loader directly as subprocess
        # Loader code is mounted as volume, dependencies installed in driver container
        env = os.environ.copy()
        env['TABLE_NAME'] = table_name
        env['LOAD_TYPE'] = load_type
        env['SOURCE_TYPE'] = source_type
        
        # Pass incremental load parameters if applicable
        if load_type == 'incremental' and incremental_key:
            env['INCREMENTAL_KEY'] = incremental_key
            if last_incremental_value:
                env['LAST_INCREMENTAL_VALUE'] = last_incremental_value
            else:
                env['LAST_INCREMENTAL_VALUE'] = ''  # Empty string means start from beginning
        
        result = subprocess.run(
            [sys.executable, str(loader_path)],
            env=env,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully loaded table: {table_name}")
            # For incremental loads, the loader should output the max timestamp processed
            # This will be in stdout as the last line in format: LAST_INCREMENTAL_VALUE=<timestamp>
            last_incremental_value = None
            if load_type == 'incremental' and incremental_key:
                # Parse stdout for LAST_INCREMENTAL_VALUE
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('LAST_INCREMENTAL_VALUE='):
                        last_incremental_value = line.split('=', 1)[1]
                        logger.info(f"Loader returned last_incremental_value: {last_incremental_value}")
                        break
            
            return True, None, last_incremental_value
        else:
            error_msg = f"Loader failed with return code {result.returncode}: {result.stderr}"
            logger.error(error_msg)
            return False, error_msg, None
            
    except subprocess.TimeoutExpired:
        error_msg = f"Loader timed out after 1 hour for table: {table_name}"
        logger.error(error_msg)
        return False, error_msg, None
    except Exception as e:
        error_msg = f"Error triggering loader: {str(e)}"
        logger.error(error_msg)
        return False, error_msg, None


def update_execution_tracking(conn: sqlite3.Connection, table_name: str, 
                             success: bool, error: Optional[str] = None):
    """Update execution tracking table with run results"""
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    status = "success" if success else "failed"
    
    cursor.execute("""
        INSERT OR REPLACE INTO execution_tracking 
        (table_name, last_run_time, last_status, last_error)
        VALUES (?, ?, ?, ?)
    """, (table_name, now, status, error))
    
    conn.commit()
    logger.info(f"Updated execution tracking for {table_name}: {status}")


def update_last_incremental_value(conn: sqlite3.Connection, table_name: str, 
                                  last_incremental_value: str):
    """Update last_incremental_value in table_config only on successful load"""
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(table_config)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'last_incremental_value' not in columns:
        logger.warning(f"last_incremental_value column does not exist in table_config, skipping update")
        return
    
    cursor.execute("""
        UPDATE table_config 
        SET last_incremental_value = ?
        WHERE table_name = ?
    """, (last_incremental_value, table_name))
    
    conn.commit()
    logger.info(f"Updated last_incremental_value for {table_name}: {last_incremental_value}")


def update_loader_run_status(conn: sqlite3.Connection, table_name: str, 
                             success: bool):
    """Update last_loader_run_timestamp and last_loader_run_status in table_config"""
    cursor = conn.cursor()
    
    # Check if columns exist
    cursor.execute("PRAGMA table_info(table_config)")
    columns = [col[1] for col in cursor.fetchall()]
    
    has_timestamp = 'last_loader_run_timestamp' in columns
    has_status = 'last_loader_run_status' in columns
    
    if not has_timestamp and not has_status:
        logger.warning(f"Loader run status columns do not exist in table_config, skipping update")
        return
    
    now = datetime.now().isoformat()
    status = "success" if success else "failed"
    
    # Build update query based on available columns
    updates = []
    params = []
    
    if has_timestamp:
        updates.append("last_loader_run_timestamp = ?")
        params.append(now)
    
    if has_status:
        updates.append("last_loader_run_status = ?")
        params.append(status)
    
    if updates:
        params.append(table_name)
        query = f"""
            UPDATE table_config 
            SET {', '.join(updates)}
            WHERE table_name = ?
        """
        cursor.execute(query, params)
        conn.commit()
        logger.info(f"Updated loader run status for {table_name}: {status} at {now}")


def main():
    """Main driver function"""
    logger.info("Starting driver script for source to datalake loaders")
    
    try:
        # Connect to config database
        conn = get_db_connection()
        
        # Ensure execution tracking table exists
        ensure_execution_tracking_table(conn)
        
        # Get active configurations
        configs = get_active_configs(conn)
        logger.info(f"Found {len(configs)} active configurations")
        
        if not configs:
            logger.info("No active configurations found. Exiting.")
            conn.close()
            return
        
        # Process each configuration
        triggered_count = 0
        for config in configs:
            table_name = config['table_name']
            source_type = config['source_type']
            
            # Check if should run now
            if not should_run_now(config, conn):
                continue
            
            # Get loader path
            loader_path = get_loader_module_path(source_type)
            if not loader_path:
                logger.error(f"Skipping {table_name}: loader not found for source_type {source_type}")
                update_execution_tracking(conn, table_name, False, 
                                        f"Loader not found for source_type: {source_type}")
                continue
            
            # Trigger loader
            success, error, last_incremental_value = trigger_loader(config, loader_path)
            
            # Update execution tracking
            update_execution_tracking(conn, table_name, success, error)
            
            # Update loader run status in table_config
            update_loader_run_status(conn, table_name, success)
            
            # Update last_incremental_value ONLY on successful load for incremental tables
            if success and config['load_type'] == 'incremental' and last_incremental_value:
                update_last_incremental_value(conn, table_name, last_incremental_value)
            
            if success:
                triggered_count += 1
        
        logger.info(f"Driver script completed. Triggered {triggered_count} loaders.")
        conn.close()
        
    except Exception as e:
        logger.error(f"Fatal error in driver script: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
