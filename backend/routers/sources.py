from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import json
import uuid6
from db.connection import get_db_connection
from schemas.models import SourceConfig
from utils.encryption import encrypt, decrypt

router = APIRouter(
    prefix="/sources",
    tags=["sources"]
)

@router.get("", response_model=List[SourceConfig])
def get_sources():
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sources_config")
        rows = cursor.fetchall()
        
        sources = []
        for row in rows:
            data = dict(row)
            if data["source_creds"]:
                data["source_creds"] = decrypt(data["source_creds"])
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
        cursor.execute("SELECT id FROM sources_config WHERE source_name = ?", (source.source_name,))
        if cursor.fetchone() is not None:
             conn.close()
             raise HTTPException(status_code=400, detail="Source with this name already exists")
        
        new_id = str(uuid6.uuid7()) # using uuid7 for time-sorted IDs
        creds_json = encrypt(source.source_creds) if source.source_creds else None

        query = """
            INSERT INTO sources_config (
                id, source_name, source_type, source_creds
            ) VALUES (?, ?, ?, ?)
        """
        
        cursor.execute(query, (
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
        
        cursor.execute("SELECT id FROM sources_config WHERE source_name = ?", (source_name,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Source not found")
            
        cursor.execute("DELETE FROM sources_config WHERE source_name = ?", (source_name,))
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
        cursor.execute("SELECT id FROM sources_config WHERE source_name = ?", (source_name,))
        row = cursor.fetchone()
        if row is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Source not found")
        
        current_id = row[0]
        
        # Encrypt creds if present
        creds_json = encrypt(source.source_creds) if source.source_creds else None
        
        query = """
            UPDATE sources_config 
            SET source_type = ?, source_creds = ?
            WHERE source_name = ?
        """
        
        cursor.execute(query, (
            source.source_type, creds_json, source_name
        ))
        
        conn.commit()
        conn.close()
        
        source.id = current_id
        return source
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
