from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import uuid6
from db.connection import get_db_connection
from db import queries
from schemas.models import StageCreate

router = APIRouter(
    prefix="/stages",
    tags=["stages"]
)

@router.get("", response_model=List[Dict[str, Any]])
def get_pipeline_stages():
    """Get all pipeline stage definitions"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_ALL_STAGES)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.get("/{pipeline_name}", response_model=List[Dict[str, Any]])
def get_stages_by_pipeline(pipeline_name: str):
    """Get stages for a specific pipeline"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(queries.GET_STAGES_BY_PIPELINE, (pipeline_name,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.post("")
def create_stage(stage: StageCreate):
    """Add a new stage to a pipeline"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        stage_id = str(uuid6.uuid7())
        cursor.execute(queries.CREATE_STAGE, (stage_id, stage.pipeline_name, stage.stage_order, stage.stage_name, stage.stage_type, stage.driver_container))
        conn.commit()
        conn.close()
        return {"message": "Stage created", "id": stage_id}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
