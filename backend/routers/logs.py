from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import sqlite3
from db.connection import get_db_connection
from db import queries

router = APIRouter(
    prefix="/logs",
    tags=["logs"]
)

@router.get("", response_model=List[Dict[str, Any]])
def get_all_logs(
    page: int = 1,
    limit: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    source_tablename: Optional[str] = None
):
    """Get all pipeline run logs with pagination and filtering"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = queries.GET_ALL_LOGS_BASE
        params = []
        
        if start_date:
            query += " AND started_at >= ?"
            params.append(start_date)
            
        if end_date:
            query += " AND started_at <= ?"
            params.append(end_date)

        if source_tablename:
            query += " AND source_tablename = ?"
            params.append(source_tablename)
            
        # Add sorting and pagination
        offset = (page - 1) * limit
        query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.get("/stats/summary")
def get_logs_summary():
    """Get summary statistics for dashboard charts"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(queries.GET_STATUS_DISTRIBUTION)
        status_dist = [{"name": row["status"], "value": row["count"]} for row in cursor.fetchall()]
        
        cursor.execute(queries.GET_PIPELINE_TYPE_DISTRIBUTION)
        type_dist = [{"name": row["pipeline_type"], "value": row["count"]} for row in cursor.fetchall()]
        
        cursor.execute(queries.GET_RUNS_PER_TABLE)
        runs_per_table = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute(queries.GET_DAILY_RUNS)
        daily_runs = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute(queries.GET_TOTAL_STATS)
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

@router.get("/{source_tablename}", response_model=List[Dict[str, Any]])
def get_logs_by_table(source_tablename: str):
    """Get pipeline run logs for a specific table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_LOGS_BY_TABLE, (source_tablename,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
