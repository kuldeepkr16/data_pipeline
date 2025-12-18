from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import subprocess
import threading
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# IST timezone
IST = timezone(timedelta(hours=5, minutes=30))

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


# ============ Pipeline Stages Endpoints ============

@app.get("/stages", response_model=List[Dict[str, Any]])
def get_pipeline_stages():
    """Get all pipeline stage definitions"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_stages 
            WHERE is_active = 1
            ORDER BY pipeline_name, stage_order
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/stages/{pipeline_name}", response_model=List[Dict[str, Any]])
def get_stages_by_pipeline(pipeline_name: str):
    """Get stages for a specific pipeline"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_stages 
            WHERE pipeline_name = ? AND is_active = 1
            ORDER BY stage_order
        """, (pipeline_name,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


class StageCreate(BaseModel):
    pipeline_name: str
    stage_order: int
    stage_name: str
    stage_type: str
    driver_container: str


@app.post("/stages")
def create_stage(stage: StageCreate):
    """Add a new stage to a pipeline"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pipeline_stages (pipeline_name, stage_order, stage_name, stage_type, driver_container)
            VALUES (?, ?, ?, ?, ?)
        """, (stage.pipeline_name, stage.stage_order, stage.stage_name, stage.stage_type, stage.driver_container))
        conn.commit()
        stage_id = cursor.lastrowid
        conn.close()
        return {"message": "Stage created", "id": stage_id}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


# ============ Pipeline Runs Endpoints ============

@app.get("/runs", response_model=List[Dict[str, Any]])
def get_pipeline_runs():
    """Get all pipeline runs with their stage statuses"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_runs 
            ORDER BY started_at DESC 
            LIMIT 50
        """)
        runs = [dict(row) for row in cursor.fetchall()]
        
        # Get stage logs for each run
        for run in runs:
            cursor.execute("""
                SELECT * FROM pipeline_run_logs 
                WHERE pipeline_run_id = ?
                ORDER BY stage_order
            """, (run['id'],))
            run['stages'] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return runs
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/runs/{run_id}")
def get_pipeline_run(run_id: int):
    """Get a specific pipeline run with all stage details"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM pipeline_runs WHERE id = ?", (run_id,))
        run = cursor.fetchone()
        if not run:
            raise HTTPException(status_code=404, detail="Pipeline run not found")
        
        run_dict = dict(run)
        
        # Get stage logs
        cursor.execute("""
            SELECT * FROM pipeline_run_logs 
            WHERE pipeline_run_id = ?
            ORDER BY stage_order
        """, (run_id,))
        run_dict['stages'] = [dict(row) for row in cursor.fetchall()]
        
        # Get stage definitions
        cursor.execute("""
            SELECT * FROM pipeline_stages 
            WHERE pipeline_name = ? AND is_active = 1
            ORDER BY stage_order
        """, (run_dict['pipeline_name'],))
        run_dict['stage_definitions'] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return run_dict
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/runs/table/{source_tablename}")
def get_runs_by_table(source_tablename: str):
    """Get pipeline runs for a specific table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM pipeline_runs 
            WHERE source_tablename = ?
            ORDER BY started_at DESC
            LIMIT 20
        """, (source_tablename,))
        runs = [dict(row) for row in cursor.fetchall()]
        
        for run in runs:
            cursor.execute("""
                SELECT * FROM pipeline_run_logs 
                WHERE pipeline_run_id = ?
                ORDER BY stage_order
            """, (run['id'],))
            run['stages'] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return runs
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


# ============ Pipeline Trigger Endpoints ============

def execute_pipeline_stage(run_id: int, stage: Dict, source_tablename: str):
    """Execute a single pipeline stage"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    started_at = datetime.now(IST)
    
    # Insert stage log as running
    cursor.execute("""
        INSERT INTO pipeline_run_logs 
        (source_tablename, pipeline_type, status, started_at, pipeline_run_id, stage_order)
        VALUES (?, ?, 'running', ?, ?, ?)
    """, (source_tablename, stage['stage_type'], started_at.isoformat(), run_id, stage['stage_order']))
    log_id = cursor.lastrowid
    conn.commit()
    
    # Update pipeline run current stage
    cursor.execute("""
        UPDATE pipeline_runs SET current_stage = ?, status = 'running'
        WHERE id = ?
    """, (stage['stage_order'], run_id))
    conn.commit()
    
    try:
        # Execute the driver container command
        container = stage['driver_container']
        result = subprocess.run(
            ['docker', 'exec', container, 'python', '/app/main.py', '--table', source_tablename],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        completed_at = datetime.now(IST)
        time_taken = str(completed_at - started_at)
        
        if result.returncode == 0:
            # Parse output for rows processed and file paths
            rows_processed = 0
            file_paths = []
            for line in result.stdout.split('\n'):
                if line.startswith('ROWS_PROCESSED:'):
                    rows_processed = int(line.split(':')[1])
                elif line.startswith('FILE_PATH:'):
                    file_paths.append(line.split(':', 1)[1])
            
            cursor.execute("""
                UPDATE pipeline_run_logs 
                SET status = 'success', completed_at = ?, time_taken = ?, 
                    rows_processed = ?, file_paths = ?
                WHERE id = ?
            """, (completed_at.isoformat(), time_taken, rows_processed, 
                  ','.join(file_paths) if file_paths else None, log_id))
            conn.commit()
            conn.close()
            return True, None
        else:
            error_msg = result.stderr[:500] if result.stderr else "Unknown error"
            cursor.execute("""
                UPDATE pipeline_run_logs 
                SET status = 'failed', completed_at = ?, time_taken = ?, error_message = ?
                WHERE id = ?
            """, (completed_at.isoformat(), time_taken, error_msg, log_id))
            conn.commit()
            conn.close()
            return False, error_msg
            
    except subprocess.TimeoutExpired:
        cursor.execute("""
            UPDATE pipeline_run_logs 
            SET status = 'failed', completed_at = ?, error_message = 'Stage timeout after 5 minutes'
            WHERE id = ?
        """, (datetime.now(IST).isoformat(), log_id))
        conn.commit()
        conn.close()
        return False, "Stage timeout"
    except Exception as e:
        cursor.execute("""
            UPDATE pipeline_run_logs 
            SET status = 'failed', completed_at = ?, error_message = ?
            WHERE id = ?
        """, (datetime.now(IST).isoformat(), str(e)[:500], log_id))
        conn.commit()
        conn.close()
        return False, str(e)


def run_pipeline_async(run_id: int, stages: List[Dict], source_tablename: str):
    """Run all pipeline stages sequentially in background"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    all_success = True
    error_message = None
    
    for stage in stages:
        success, error = execute_pipeline_stage(run_id, stage, source_tablename)
        if not success:
            all_success = False
            error_message = error
            break
    
    # Update pipeline run status
    completed_at = datetime.now(IST)
    final_status = 'success' if all_success else 'failed'
    
    cursor.execute("""
        UPDATE pipeline_runs 
        SET status = ?, completed_at = ?, error_message = ?
        WHERE id = ?
    """, (final_status, completed_at.isoformat(), error_message, run_id))
    conn.commit()
    conn.close()


class TriggerRequest(BaseModel):
    pipeline_name: str = "default"
    triggered_by: str = "manual"


@app.post("/trigger/{source_tablename}")
def trigger_pipeline(source_tablename: str, request: TriggerRequest, background_tasks: BackgroundTasks):
    """Trigger a pipeline run for a specific table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify table exists
        cursor.execute("SELECT * FROM pipeline_config WHERE source_tablename = ?", (source_tablename,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Table not found in config")
        
        # Get pipeline stages
        cursor.execute("""
            SELECT * FROM pipeline_stages 
            WHERE pipeline_name = ? AND is_active = 1
            ORDER BY stage_order
        """, (request.pipeline_name,))
        stages = [dict(row) for row in cursor.fetchall()]
        
        if not stages:
            raise HTTPException(status_code=404, detail=f"Pipeline '{request.pipeline_name}' not found or has no stages")
        
        # Create pipeline run
        started_at = datetime.now(IST)
        cursor.execute("""
            INSERT INTO pipeline_runs 
            (source_tablename, pipeline_name, status, total_stages, triggered_by, started_at)
            VALUES (?, ?, 'pending', ?, ?, ?)
        """, (source_tablename, request.pipeline_name, len(stages), request.triggered_by, started_at.isoformat()))
        run_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Start pipeline execution in background
        thread = threading.Thread(target=run_pipeline_async, args=(run_id, stages, source_tablename))
        thread.start()
        
        return {
            "message": "Pipeline triggered",
            "run_id": run_id,
            "source_tablename": source_tablename,
            "pipeline_name": request.pipeline_name,
            "total_stages": len(stages)
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
