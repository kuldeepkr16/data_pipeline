from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
from db.connection import get_db_connection
from db import queries
from schemas.models import ConfigUpdate

router = APIRouter(
    prefix="/config",
    tags=["config"]
)

@router.get("", response_model=List[Dict[str, Any]])
def get_config():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_ALL_CONFIGS)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{source_tablename}")
def get_table_config(source_tablename: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_CONFIG_BY_TABLE, (source_tablename,))
        row = cursor.fetchone()
        conn.close()
        
        if row is None:
            raise HTTPException(status_code=404, detail="Table config not found")
            
        return dict(row)
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.put("/{source_tablename}")
def update_table_config(source_tablename: str, config: ConfigUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute(queries.CHECK_TABLE_EXISTS, (source_tablename,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Table config not found")
            
        # Update config dynamically based on what's provided
        update_fields = []
        params = []
        
        if config.source_to_dl_schedule is not None:
            update_fields.append("source_to_dl_schedule = ?")
            params.append(config.source_to_dl_schedule)
        if config.source_to_dl_load_type is not None:
            update_fields.append("source_to_dl_load_type = ?")
            params.append(config.source_to_dl_load_type)
        if config.source_to_dl_is_active is not None:
            update_fields.append("source_to_dl_is_active = ?")
            params.append(config.source_to_dl_is_active)
            
        if config.dl_to_sink_schedule is not None:
            update_fields.append("dl_to_sink_schedule = ?")
            params.append(config.dl_to_sink_schedule)
        if config.dl_to_sink_load_type is not None:
            update_fields.append("dl_to_sink_load_type = ?")
            params.append(config.dl_to_sink_load_type)
        if config.dl_to_sink_is_active is not None:
            update_fields.append("dl_to_sink_is_active = ?")
            params.append(config.dl_to_sink_is_active)

        if not update_fields:
             conn.close()
             return {"message": "No changes provided"}

        params.append(source_tablename)
        query = f"UPDATE pipeline_config SET {', '.join(update_fields)} WHERE source_tablename = ?"
        
        cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        
        return {"message": "Config updated successfully", "source_tablename": source_tablename, **config.dict(exclude_unset=True)}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
