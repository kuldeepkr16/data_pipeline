from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from typing import List, Dict, Any, Optional

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

DB_PATH = "/data/config.db"

class ConfigUpdate(BaseModel):
    source_to_dl_schedule: Optional[int] = None
    source_to_dl_load_type: Optional[str] = None
    source_to_dl_is_active: Optional[int] = None
    dl_to_sink_schedule: Optional[int] = None
    dl_to_sink_load_type: Optional[str] = None
    dl_to_sink_is_active: Optional[int] = None

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/")
def read_root():
    return {"message": "Data Pipeline Config API"}

@app.get("/config", response_model=List[Dict[str, Any]])
def get_config():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_config")
        rows = cursor.fetchall()
        conn.close()
        
        # Convert rows to list of dicts
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config/{source_tablename}")
def get_table_config(source_tablename: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_config WHERE source_tablename = ?", (source_tablename,))
        row = cursor.fetchone()
        conn.close()
        
        if row is None:
            raise HTTPException(status_code=404, detail="Table config not found")
            
        return dict(row)
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.put("/config/{source_tablename}")
def update_table_config(source_tablename: str, config: ConfigUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT source_tablename FROM pipeline_config WHERE source_tablename = ?", (source_tablename,))
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


# ============ Pipeline Run Logs Endpoints ============

@app.get("/logs", response_model=List[Dict[str, Any]])
def get_all_logs():
    """Get all pipeline run logs ordered by most recent first"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_run_logs 
            ORDER BY started_at DESC 
            LIMIT 100
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/logs/{source_tablename}", response_model=List[Dict[str, Any]])
def get_logs_by_table(source_tablename: str):
    """Get pipeline run logs for a specific table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_run_logs 
            WHERE source_tablename = ? 
            ORDER BY started_at DESC
        """, (source_tablename,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/logs/stats/summary")
def get_logs_summary():
    """Get summary statistics for dashboard charts"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Status distribution (for pie chart)
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM pipeline_run_logs 
            GROUP BY status
        """)
        status_dist = [{"name": row["status"], "value": row["count"]} for row in cursor.fetchall()]
        
        # Pipeline type distribution (for pie chart)
        cursor.execute("""
            SELECT pipeline_type, COUNT(*) as count 
            FROM pipeline_run_logs 
            GROUP BY pipeline_type
        """)
        type_dist = [{"name": row["pipeline_type"], "value": row["count"]} for row in cursor.fetchall()]
        
        # Runs per table (for bar chart)
        cursor.execute("""
            SELECT source_tablename, 
                   COUNT(*) as total_runs,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                   SUM(COALESCE(rows_processed, 0)) as total_rows
            FROM pipeline_run_logs 
            GROUP BY source_tablename
        """)
        runs_per_table = [dict(row) for row in cursor.fetchall()]
        
        # Recent runs by day (for bar chart - last 7 days)
        cursor.execute("""
            SELECT DATE(started_at) as run_date, 
                   COUNT(*) as runs,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM pipeline_run_logs 
            WHERE started_at >= DATE('now', '-7 days')
            GROUP BY DATE(started_at)
            ORDER BY run_date
        """)
        daily_runs = [dict(row) for row in cursor.fetchall()]
        
        # Total stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total_runs,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
                SUM(COALESCE(rows_processed, 0)) as total_rows_processed
            FROM pipeline_run_logs
        """)
        totals = dict(cursor.fetchone())
        
        conn.close()
        
        return {
            "status_distribution": status_dist,
            "pipeline_type_distribution": type_dist,
            "runs_per_table": runs_per_table,
            "daily_runs": daily_runs,
            "totals": totals
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
