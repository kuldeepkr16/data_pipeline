#!/usr/bin/env python3
"""
Loader: Datalake (MinIO) to Sink (Postgres)
"""

import os
import sys
import logging
import pandas as pd
from minio import Minio
from sqlalchemy import create_engine
import io
from datetime import datetime

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configs
TABLE_NAME = os.getenv('TABLE_NAME')
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'minio_server:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
MINIO_BUCKET = os.getenv('MINIO_BUCKET', 'datalake')
MINIO_USE_SSL = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'

# Sink DB Config
POSTGRES_HOST = os.getenv('SINK_POSTGRES_HOST', 'sink_pg_db')
POSTGRES_PORT = os.getenv('SINK_POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('SINK_POSTGRES_DB', 'sink_db')
POSTGRES_USER = os.getenv('SINK_POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('SINK_POSTGRES_PASSWORD', 'postgres')

# Workaround for minio_server hostname with underscore
try:
    import socket
    if ':' in MINIO_ENDPOINT:
        host, port = MINIO_ENDPOINT.split(':')
        try:
            ip = socket.gethostbyname(host)
            MINIO_ENDPOINT = f"{ip}:{port}"
        except:
            pass
except:
    pass

def get_minio_client():
    endpoint = MINIO_ENDPOINT.replace('http://', '').replace('https://', '')
    return Minio(
        endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_USE_SSL
    )

def get_latest_parquet_file(client, bucket, table_name):
    # List objects recursively with prefix table_name/
    objects = client.list_objects(bucket, prefix=f"{table_name}/", recursive=True)
    
    # Sort by last match (most recent) - assuming filename or last_modified
    # Filename format: table_name/YYYY/MM/DD/HH/table_name_YYYYMMDD_HHMMSS.parquet
    # We can just use last_modified from MinIO object
    parquet_files = [obj for obj in objects if obj.object_name.endswith('.parquet')]
    
    if not parquet_files:
        return None
        
    # Sort by last modified time, descending
    parquet_files.sort(key=lambda x: x.last_modified, reverse=True)
    return parquet_files[0]

def load_to_sink(df, table_name):
    # Connect to Sink DB using SQLAlchemy
    db_url = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    engine = create_engine(db_url)
    
    # Write to DB (Replace for now, or Append based on requirements)
    # Simple strategy: If Active, Replace? Or Append?
    # Source-to-lake does full or incremental snapshots.
    # Here we are just loading the *latest* snapshot we took.
    # If source was full load -> Data Lake has full snapshot -> Sink should Replace.
    # If source was incremental -> Data Lake has delta -> Sink should Append.
    
    # Check load_type passed from env?
    load_type = os.getenv('LOAD_TYPE', 'full')
    
    if_exists = 'replace' if load_type == 'full' else 'append'
    
    logger.info(f"Writing to Postgres table {table_name} (if_exists={if_exists})")
    df.to_sql(table_name, engine, if_exists=if_exists, index=False)
    logger.info("Write complete")

def main():
    if not TABLE_NAME:
        logger.error("TABLE_NAME env var missing")
        sys.exit(1)
        
    logger.info(f"Starting generic loader for {TABLE_NAME}")
    
    try:
        client = get_minio_client()
        
        # 1. Find latest file
        latest_file = get_latest_parquet_file(client, MINIO_BUCKET, TABLE_NAME)
        if not latest_file:
            logger.warning(f"No parquet files found for {TABLE_NAME} in MinIO")
            # If no data, maybe it's not an error but just nothing to do? 
            # But driver triggered us, so maybe warn.
            sys.exit(0)
            
        logger.info(f"Reading latest file: {latest_file.object_name}")
        
        # 2. Read content
        response = client.get_object(MINIO_BUCKET, latest_file.object_name)
        data = response.read()
        df = pd.read_parquet(io.BytesIO(data))
        logger.info(f"Read {len(df)} rows")
        
        # 3. Write to Sink
        load_to_sink(df, TABLE_NAME)
        
    except Exception as e:
        logger.error(f"Loader failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
