from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime, timedelta, timezone
import sqlite3
from db.connection import get_db_connection
from db import queries

# IST timezone
IST = timezone(timedelta(hours=5, minutes=30))

router = APIRouter(
    prefix="/stats",
    tags=["stats"]
)

@router.get("/records-loaded")
def get_loaded_records_stats(hours: float = 24.0):
    """Get total records loaded for each table within the last N hours"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate cutoff time
        cutoff_time = datetime.now(IST) - timedelta(hours=hours)
        
        cursor.execute(queries.GET_LOADED_RECORDS_STATS, (cutoff_time.isoformat(),))
        
        rows = cursor.fetchall()
        conn.close()
        
        # Convert to dict {table_name: count}
        return {row['source_tablename']: row['total_loaded'] for row in rows}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
