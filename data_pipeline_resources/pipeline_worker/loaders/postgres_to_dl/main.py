#!/usr/bin/env python3
"""
Postgres to Datalake Loader

This script:
1. Reads data from PostgreSQL source database
2. Handles full and incremental loads
3. Writes data to MinIO (S3-compatible) object storage
4. Outputs last_incremental_value for incremental loads
5. Writes execution status to config database
"""

import os
import sys
import logging
import sqlite3
import time
import random
from datetime import datetime, timezone, timedelta

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))
from typing import Optional
import psycopg2  # type: ignore
import pandas as pd  # type: ignore
from minio import Minio  # type: ignore
from minio.error import S3Error  # type: ignore
import io

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from cryptography.fernet import Fernet
import json

def decrypt(token: str) -> Optional[dict]:
    """Decrypts a Fernet token string back to a dictionary."""
    if not token:
        return None  
    try:
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            logger.warning("No ENCRYPTION_KEY found.")
            return None
        f = Fernet(key.encode() if isinstance(key, str) else key)
        # Check if legacy JSON
        if token.strip().startswith('{') and token.strip().endswith('}'):
             return json.loads(token)
        json_bytes = f.decrypt(token.encode('utf-8'))
        return json.loads(json_bytes.decode('utf-8'))
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return None

# Configuration from environment variables
SOURCE_TABLENAME = os.getenv('SOURCE_TABLENAME')
LOAD_TYPE = os.getenv('LOAD_TYPE', 'full')
SOURCE_TYPE = os.getenv('SOURCE_TYPE', 'postgres')
INCREMENTAL_KEY = os.getenv('INCREMENTAL_KEY')
LAST_INCREMENTAL_VALUE = os.getenv('LAST_INCREMENTAL_VALUE', '')

# Database connections
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'source_pg_db')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'source_db')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'read_user')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'read_password')

# MinIO configuration
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'minio_server:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
MINIO_BUCKET = os.getenv('MINIO_BUCKET', 'datalake')
MINIO_USE_SSL = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'
# Try to resolve hostname to IP to avoid DNS issues
try:
    import socket
    if ':' in MINIO_ENDPOINT:
        host, port = MINIO_ENDPOINT.split(':')
        try:
            ip = socket.gethostbyname(host)
            MINIO_ENDPOINT = f"{ip}:{port}"
        except:
            pass  # Use original if resolution fails
except:
    pass

# Config database
CONFIG_DB_PATH = os.getenv('CONFIG_DB_PATH', '/data/config.db')


def get_postgres_connection():
    """Get PostgreSQL database connection"""
    try:
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD
        )
        return conn
    except psycopg2.Error as e:
        logger.error(f"Error connecting to PostgreSQL: {e}")
        raise


def get_minio_client():
    """Get MinIO client"""
    try:
        # Remove http:// or https:// prefix if present
        endpoint = MINIO_ENDPOINT.replace('http://', '').replace('https://', '')
        
        client = Minio(
            endpoint,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_USE_SSL
        )
        return client
    except Exception as e:
        logger.error(f"Error creating MinIO client: {e}")
        raise


def ensure_minio_bucket(client: Minio, bucket_name: str):
    """Ensure MinIO bucket exists, create if it doesn't"""
    try:
        # Try to create bucket, ignore error if it already exists
        try:
            client.make_bucket(bucket_name)
            logger.info(f"Created bucket: {bucket_name}")
        except S3Error as e:
            error_code = getattr(e, 'code', '')
            if error_code in ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists']:
                logger.info(f"Bucket {bucket_name} already exists")
            else:
                # If bucket creation fails, assume it exists and try to use it
                logger.warning(f"Could not create bucket {bucket_name}, assuming it exists: {e}")
    except Exception as e:
        logger.warning(f"Error ensuring bucket exists, will try to proceed: {e}")


def build_query(source_tablename: str, load_type: str, incremental_key: Optional[str], 
                last_incremental_value: Optional[str]) -> tuple[str, Optional[tuple]]:
    """Build SQL query based on load type
    
    Returns:
        Tuple of (query: str, params: Optional[tuple])
    """
    if load_type == 'full':
        query = f'SELECT * FROM "{source_tablename}"'
        return query, None
    
    elif load_type == 'incremental':
        if not incremental_key:
            raise ValueError("incremental_key is required for incremental loads")
        
        if last_incremental_value:
            # Query records where incremental_key > last_incremental_value
            # Using parameterized query for safety
            query = f'SELECT * FROM "{source_tablename}" WHERE "{incremental_key}" > %s ORDER BY "{incremental_key}"'
            return query, (last_incremental_value,)
        else:
            # First incremental load - get all records
            query = f'SELECT * FROM "{source_tablename}" ORDER BY "{incremental_key}"'
            return query, None
    
    else:
        raise ValueError(f"Unknown load_type: {load_type}")


def get_max_incremental_value(df: pd.DataFrame, incremental_key: str) -> Optional[str]:
    """Get the maximum value of incremental_key from the dataframe"""
    if df.empty or incremental_key not in df.columns:
        return None
    
    max_value = df[incremental_key].max()
    if pd.isna(max_value):
        return None
    
    # Convert to ISO format string if it's a datetime
    if isinstance(max_value, pd.Timestamp):
        return max_value.isoformat()
    elif isinstance(max_value, datetime):
        return max_value.isoformat()
    else:
        return str(max_value)


def load_data_to_minio(source_tablename: str, load_type: str, 
                       incremental_key: Optional[str], 
                       last_incremental_value: Optional[str]) -> tuple[bool, Optional[str], Optional[str], Optional[str], Optional[int]]:
    """Load data from Postgres to MinIO
    
    Returns:
        Tuple of (success: bool, error: Optional[str], max_incremental_value: Optional[str], file_path: Optional[str], rows_processed: Optional[int])
    """
    pg_conn = None
    try:
        # Connect to PostgreSQL
        logger.info(f"Connecting to PostgreSQL: {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
        pg_conn = get_postgres_connection()
        
        # Build query
        query, query_params = build_query(source_tablename, load_type, incremental_key, last_incremental_value)
        logger.info(f"Executing query: {query}")
        if query_params:
            logger.info(f"Query parameters: {query_params}")
        
        # Execute query and fetch data
        df = pd.read_sql_query(query, pg_conn, params=query_params)
        logger.info(f"Fetched {len(df)} rows from {source_tablename}")
        
        if df.empty:
            logger.warning(f"No data found for {source_tablename}")
            # Still return success, but no incremental value to update
            return True, None, None, None, 0
        
        # Get max incremental value for incremental loads
        max_incremental_value = None
        if load_type == 'incremental' and incremental_key:
            max_incremental_value = get_max_incremental_value(df, incremental_key)
            logger.info(f"Max incremental value: {max_incremental_value}")
        
        # Connect to MinIO
        logger.info(f"Connecting to MinIO: {MINIO_ENDPOINT}")
        minio_client = get_minio_client()
        
        # Ensure bucket exists
        ensure_minio_bucket(minio_client, MINIO_BUCKET)
        
        # Define object path
        # Standard: source_to_dl/dl_tablename/yyyy/mm/dd/hh/tablename_yyyymmdd_hhmmss.parquet
        # Use IST timezone for consistency
        now = datetime.now(IST)
        timestamp = now.strftime('%Y%m%d_%H%M%S')
        year = now.strftime('%Y')
        month = now.strftime('%m')
        day = now.strftime('%d')
        hour = now.strftime('%H')
        
        object_name = f"{SOURCE_TYPE}_to_dl/dl_{source_tablename}/{year}/{month}/{day}/{hour}/{source_tablename}_{timestamp}.parquet"
        rows_count = len(df)
        
        # Convert DataFrame to Parquet format in memory
        parquet_buffer = io.BytesIO()
        df.to_parquet(parquet_buffer, index=False, engine='pyarrow')
        parquet_buffer.seek(0)
        
        # Upload to MinIO
        logger.info(f"Uploading to MinIO: {MINIO_BUCKET}/{object_name}")
        minio_client.put_object(
            MINIO_BUCKET,
            object_name,
            parquet_buffer,
            length=parquet_buffer.getbuffer().nbytes,
            content_type='application/parquet'
        )
        
        logger.info(f"Successfully uploaded {rows_count} rows to {object_name}")
        
        # Close PostgreSQL connection
        pg_conn.close()
        
        # Return full MinIO path
        full_path = f"{MINIO_BUCKET}/{object_name}"
        return True, None, max_incremental_value, full_path, rows_count
        
    except Exception as e:
        error_msg = f"Error loading data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        if pg_conn:
            pg_conn.close()
        return False, error_msg, None, None, None


def write_status_to_config(success: bool, error: Optional[str] = None):
    """Write execution status to config database"""
    try:
        conn = sqlite3.connect(CONFIG_DB_PATH)
        cursor = conn.cursor()
        
        # Check if execution_tracking table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='execution_tracking'
        """)
        
        if cursor.fetchone():
            now = datetime.now().isoformat()
            status = "success" if success else "failed"
            
            cursor.execute("""
                INSERT OR REPLACE INTO execution_tracking 
                (table_name, last_run_time, last_status, last_error)
                VALUES (?, ?, ?, ?)
            """, (SOURCE_TABLENAME, now, status, error))
            
            conn.commit()
            logger.info(f"Wrote status to config: {status}")
        else:
            logger.warning("execution_tracking table does not exist, skipping status write")
        
        conn.close()
        
    except Exception as e:
        logger.warning(f"Failed to write status to config: {e}")


def main():
    """Main function"""
    if not SOURCE_TABLENAME:
        logger.error("SOURCE_TABLENAME environment variable is required")
        sys.exit(1)
    
    # Simulate processing time (3-8 seconds)
    sleep_time = random.uniform(3, 8)
    logger.info(f"Processing... (simulated delay: {sleep_time:.1f}s)")
    time.sleep(sleep_time)
    
    logger.info(f"Starting Postgres to Datalake loader for table: {SOURCE_TABLENAME}")
    logger.info(f"Load type: {LOAD_TYPE}")
    
    if LOAD_TYPE == 'incremental':
        logger.info(f"Incremental key: {INCREMENTAL_KEY}")
        logger.info(f"Last incremental value: {LAST_INCREMENTAL_VALUE or 'None (first run)'}")
    
    # Load data
    success, error, max_incremental_value, file_path, rows_processed = load_data_to_minio(
        SOURCE_TABLENAME,
        LOAD_TYPE,
        INCREMENTAL_KEY if INCREMENTAL_KEY else None,
        LAST_INCREMENTAL_VALUE if LAST_INCREMENTAL_VALUE else None
    )
    
    # Write status to config
    write_status_to_config(success, error)
    
    # Output metadata for driver to capture
    if success:
        if file_path:
            print(f"FILE_PATH:{file_path}", file=sys.stdout)
            logger.info(f"Output file_path: {file_path}")
        if rows_processed is not None:
            print(f"ROWS_PROCESSED:{rows_processed}", file=sys.stdout)
            logger.info(f"Output rows_processed: {rows_processed}")
        if LOAD_TYPE == 'incremental' and max_incremental_value:
            print(f"LAST_INCREMENTAL_VALUE:{max_incremental_value}", file=sys.stdout)
            logger.info(f"Output last_incremental_value: {max_incremental_value}")
    
    if not success:
        logger.error(f"Load failed: {error}")
        sys.exit(1)
    
    logger.info("Load completed successfully")


if __name__ == "__main__":
    main()
