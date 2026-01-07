from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
from db.connection import get_db_connection
from db import queries
from schemas.models import ConfigUpdate, ConfigCreate

router = APIRouter(
    prefix="/pipelines",
    tags=["pipelines"]
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

@router.post("", status_code=201)
def create_config(config: ConfigCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table already exists
        cursor.execute(queries.GET_CONFIG_BY_TABLE, (config.source_tablename,))
        if cursor.fetchone() is not None:
             conn.close()
             raise HTTPException(status_code=400, detail="Configuration for this source table already exists")

        # Insert new config
        # Using default active status (1) for new configs
        cursor.execute(queries.INSERT_PIPELINE_CONFIG, (
            config.source_tablename, config.sink_tablename, 
            config.source_name, config.destination_name,
            config.source_type, config.sink_type,
            config.source_to_dl_schedule, config.source_to_dl_load_type,
            config.dl_to_sink_schedule, config.dl_to_sink_load_type
        ))
        
        conn.commit()
        conn.close()
        
        return {"message": "Config created successfully", "config": config}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.delete("/{source_tablename}", status_code=204)
def delete_config(source_tablename: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check exists
        cursor.execute(queries.CHECK_TABLE_EXISTS, (source_tablename,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Table config not found")
            
        cursor.execute(queries.DELETE_PIPELINE_CONFIG, (source_tablename,))
        conn.commit()
        conn.close()
        return None
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
        if config.source_to_dl_incremental_key is not None:
            update_fields.append("source_to_dl_incremental_key = ?")
            params.append(config.source_to_dl_incremental_key)
            
        if config.dl_to_sink_schedule is not None:
            update_fields.append("dl_to_sink_schedule = ?")
            params.append(config.dl_to_sink_schedule)
        if config.dl_to_sink_load_type is not None:
            update_fields.append("dl_to_sink_load_type = ?")
            params.append(config.dl_to_sink_load_type)
        if config.dl_to_sink_is_active is not None:
            update_fields.append("dl_to_sink_is_active = ?")
            params.append(config.dl_to_sink_is_active)
        if config.dl_to_sink_incremental_key is not None:
            update_fields.append("dl_to_sink_incremental_key = ?")
            params.append(config.dl_to_sink_incremental_key)

        if config.source_name is not None:
            update_fields.append("source_name = ?")
            params.append(config.source_name)
        if config.destination_name is not None:
            update_fields.append("destination_name = ?")
            params.append(config.destination_name)
        if config.sink_tablename is not None:
            update_fields.append("sink_tablename = ?")
            params.append(config.sink_tablename)

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

@router.post("/{source_tablename}/refresh-schema", response_model=Any)
def refresh_schema(source_tablename: str):
    try:
        # 1. Get Pipeline Config to find Sink Table Name
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_CONFIG_BY_TABLE, (source_tablename,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Pipeline config not found")
        
        config = dict(row)
        sink_tablename = config.get("sink_tablename")
        
        # 2. Infer Source Schema from Data Lake
        from utils.schema_inference import infer_source_schema
        import json
        
        source_cols = infer_source_schema(source_tablename)
        
        # 3. Get Destination Schema from Sink DB
        dest_cols = []
        if sink_tablename:
            try:
                import psycopg2
                import os
                
                # Using env vars for Sink DB (default sink_pg_db)
                sink_conn = psycopg2.connect(
                    host=os.getenv('SINK_POSTGRES_HOST', 'sink_pg_db'),
                    port=os.getenv('SINK_POSTGRES_PORT', '5432'),
                    dbname=os.getenv('SINK_POSTGRES_DB', 'sink_db'),
                    user=os.getenv('SINK_POSTGRES_USER', 'postgres'),
                    password=os.getenv('SINK_POSTGRES_PASSWORD', 'postgres')
                )
                sink_cursor = sink_conn.cursor()
                # Query information_schema
                sink_cursor.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = %s
                """, (sink_tablename,))
                
                rows = sink_cursor.fetchall()
                for r in rows:
                    dest_cols.append({"name": r[0], "type": r[1]})
                
                sink_conn.close()
            except Exception as e:
                print(f"Error fetching sink schema: {e}")
                # Continue even if sink schema fails, just leave it empty
        
        # 4. Save to Config DB
        import datetime
        now = datetime.datetime.now().isoformat()
        
        source_json = json.dumps(source_cols) if source_cols else None
        dest_json = json.dumps(dest_cols) if dest_cols else None
        
        cursor.execute("""
            INSERT OR REPLACE INTO source_and_destination_table_schema 
            (source_tablename, destination_tablename, source_schema, destination_schema, last_updated)
            VALUES (?, ?, ?, ?, ?)
        """, (source_tablename, sink_tablename, source_json, dest_json, now))
        
        conn.commit()
        conn.close()
        
        return {
            "source_tablename": source_tablename,
            "destination_tablename": sink_tablename,
            "source_schema": source_cols,
            "destination_schema": dest_cols,
            "last_updated": now
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{source_tablename}/schema", response_model=Any)
def get_schema(source_tablename: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT source_tablename, destination_tablename, source_schema, destination_schema, last_updated
            FROM source_and_destination_table_schema
            WHERE source_tablename = ?
        """, (source_tablename,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            import json
            data = dict(row)
            # Parse JSON strings back to objects
            if data['source_schema']:
                data['source_schema'] = json.loads(data['source_schema'])
            if data['destination_schema']:
                data['destination_schema'] = json.loads(data['destination_schema'])
            return data
        else:
            # Return empty structure if not found
            return {
                "source_tablename": source_tablename,
                "destination_tablename": None,
                "source_schema": None,
                "destination_schema": None,
                "last_updated": None
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
