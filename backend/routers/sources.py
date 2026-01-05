from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import json
import uuid6
from db.connection import get_db_connection
from schemas.models import SourceConfig
from schemas.models import SourceConfig
from utils.encryption import encrypt, decrypt, mask_credentials
from db.queries import (
    GET_SOURCE_BY_NAME,
    GET_SOURCE_BY_ID,
    GET_ALL_SOURCES, 
    CHECK_SOURCE_EXISTS_BY_NAME,
    INSERT_SOURCE, 
    DELETE_SOURCE_BY_NAME, 
    UPDATE_SOURCE_BY_NAME,
    GET_PUBLIC_TABLES
)

router = APIRouter(
    prefix="/sources",
    tags=["sources"]
)

@router.get("/{source_name}/tables", response_model=List[str])
def get_source_tables(source_name: str):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get source config
        cursor.execute(GET_SOURCE_BY_NAME, (source_name,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Source not found")
            
        data = dict(row)
        if not data["source_creds"]:
            raise HTTPException(status_code=400, detail="Source credentials not found")
            
        # Decrypt creds
        creds = decrypt(data["source_creds"])
        
        # Connect to source DB
        # Note: This assumes postgres source type. 
        # In a generic system, we'd switch based on data['source_type']
        import psycopg2
        
        try:
            source_conn = psycopg2.connect(
                host=creds.get("host"),
                port=creds.get("port"),
                user=creds.get("user"),
                password=creds.get("password"),
                dbname=creds.get("dbname")
            )
            
            source_cursor = source_conn.cursor()
            source_cursor.execute(GET_PUBLIC_TABLES)
            
            tables = [r[0] for r in source_cursor.fetchall()]
            
            source_conn.close()
            return tables
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect to source database: {e}")
            
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.get("/summary")
def get_sources_summary():
    """
    Returns a lightweight list of sources with masked/minimal credentials.
    Suitable for listing pages.
    """
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(GET_ALL_SOURCES)
        rows = cursor.fetchall()
        
        sources = []
        safe_keys = ['host', 'port', 'dbname', 'user', 'region_name', 'bucket_name', 'url', 'spreadsheet_link', 'username']

        for row in rows:
            data = dict(row)
            if data["source_creds"]:
                try:
                    full_creds = decrypt(data["source_creds"])
                    # Filter only safe keys
                    safe_creds = {k: v for k, v in full_creds.items() if k in safe_keys} if full_creds else {}
                    data["source_creds"] = safe_creds
                except:
                    data["source_creds"] = {} # Fail safe
            else:
                 data["source_creds"] = {}
                 
            sources.append(data)
            
        conn.close()
        return sources
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.get("/{source_id}", response_model=SourceConfig)
def get_source_by_id(source_id: str):
    """
    Fetch full source details by ID.
    Credentials are masked (********) but present.
    """
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(GET_SOURCE_BY_ID, (source_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
             # Fallback check: maybe it's a name? (Legacy support if needed, but risky with UUIDs)
             # But router order matters. If we strictly assume UUID, we fail.
             raise HTTPException(status_code=404, detail="Source not found")
            
        data = dict(row)
        if data["source_creds"]:
            data["source_creds"] = decrypt(data["source_creds"])
            data["source_creds"] = mask_credentials(data["source_creds"])
            
        return data
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")



@router.get("", response_model=List[SourceConfig])
def get_sources():
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(GET_ALL_SOURCES)
        rows = cursor.fetchall()
        
        sources = []
        for row in rows:
            data = dict(row)
            if data["source_creds"]:
                data["source_creds"] = decrypt(data["source_creds"])
                data["source_creds"] = mask_credentials(data["source_creds"])
            sources.append(data)
            
        conn.close()
        return sources
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.post("", status_code=201)
def create_source(source: SourceConfig):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check exists
        cursor.execute(CHECK_SOURCE_EXISTS_BY_NAME, (source.source_name,))
        if cursor.fetchone() is not None:
             conn.close()
             raise HTTPException(status_code=400, detail="Source with this name already exists")
        
        new_id = str(uuid6.uuid7()) # using uuid7 for time-sorted IDs
        creds_json = encrypt(source.source_creds) if source.source_creds else None

        cursor.execute(INSERT_SOURCE, (
            new_id, source.source_name, source.source_type, creds_json
        ))
        
        conn.commit()
        conn.close()
        
        source.id = new_id
        return source
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.delete("/{source_name}", status_code=204)
def delete_source(source_name: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(CHECK_SOURCE_EXISTS_BY_NAME, (source_name,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Source not found")
            
        cursor.execute(DELETE_SOURCE_BY_NAME, (source_name,))
        conn.commit()
        conn.close()
        return None
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.put("/{source_name}")
def update_source(source_name: str, source: SourceConfig):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exists
        cursor.execute(CHECK_SOURCE_EXISTS_BY_NAME, (source_name,))
        row = cursor.fetchone()
        if row is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Source not found")
        
        current_id = row[0]
        
        # Encrypt creds if present
        creds_json = encrypt(source.source_creds) if source.source_creds else None
        
        cursor.execute(UPDATE_SOURCE_BY_NAME, (
            source.source_type, creds_json, source_name
        ))
        
        conn.commit()
        conn.close()
        
        source.id = current_id
        return source
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
