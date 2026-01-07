import os
import random
import logging
import pandas as pd
import io
from minio import Minio
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# MinIO Config
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'minio_server:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
MINIO_BUCKET = os.getenv('MINIO_BUCKET', 'datalake')
MINIO_USE_SSL = os.getenv('MINIO_USE_SSL', 'false').lower() == 'true'

def get_minio_client():
    """Create MinIO client"""
    import socket
    # Remove http:// or https:// prefix if present
    endpoint = MINIO_ENDPOINT.replace('http://', '').replace('https://', '')
    
    # Resolve hostname to IP to force IP-based addressing (avoids Invalid Hostname issues with virtual host style)
    try:
        if ":" in endpoint:
            host, port = endpoint.split(":")
            ip = socket.gethostbyname(host)
            endpoint = f"{ip}:{port}"
            logger.info(f"Resolved MinIO endpoint {host} to {ip}")
        else:
            # No port
            ip = socket.gethostbyname(endpoint)
            endpoint = ip
            logger.info(f"Resolved MinIO endpoint to {ip}")
    except Exception as e:
        logger.warning(f"Could not resolve MinIO hostname: {e}")

    logger.info(f"Connecting to MinIO at {endpoint} secure={MINIO_USE_SSL}")
    
    return Minio(
        endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_USE_SSL
    )

def infer_source_schema(source_tablename: str, sample_size: int = 10) -> Optional[List[Dict[str, str]]]:
    """
    Infers schema from random Parquet files in the data lake using MinIO SDK.
    Returns a list of columns with their types: [{'name': 'col1', 'type': 'int64'}, ...]
    """
    try:
        client = get_minio_client()
        
        # Path pattern: postgres_to_dl/dl_{tablename}/...
        prefix = f"postgres_to_dl/dl_{source_tablename}"
        
        # List objects recursive
        objects = list(client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True))
        
        # Filter for parquet files
        parquet_files = [obj for obj in objects if obj.object_name.endswith('.parquet')]
        
        if not parquet_files:
            logger.warning(f"No parquet files found for table {source_tablename} in bucket {MINIO_BUCKET} prefix {prefix}")
            return []

        # Randomly sample files
        selected_files = random.sample(parquet_files, min(len(parquet_files), sample_size))
        logger.info(f"Inferring schema from {len(selected_files)} files")

        for obj in selected_files:
            try:
                # Get object content
                response = client.get_object(MINIO_BUCKET, obj.object_name)
                # Read into bytes buffer
                data = response.read()
                response.close()
                response.release_conn()
                
                buffer = io.BytesIO(data)
                
                # Read parquet from buffer
                df = pd.read_parquet(buffer)
                
                columns = []
                for col_name, dtype in df.dtypes.items():
                    columns.append({
                        "name": col_name,
                        "type": str(dtype)
                    })
                return columns
            except Exception as e:
                logger.warning(f"Failed to read file {obj.object_name}: {e}")
                continue
        
        return []

    except Exception as e:
        logger.error(f"Error inferring source schema: {e}")
        return None
