from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import json
import uuid
from db.connection import get_db_connection
from schemas.models import DestinationConfig

router = APIRouter(
    prefix="/destinations",
    tags=["destinations"]
)

@router.get("", response_model=List[DestinationConfig])
def get_destinations():
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM destinations_config")
        rows = cursor.fetchall()

        dests = []
        for row in rows:
            data = dict(row)
            if data["destination_creds"]:
                data["destination_creds"] = json.loads(data["destination_creds"])
            dests.append(data)
            
        conn.close()
        return dests
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.post("", status_code=201)
def create_destination(destination: DestinationConfig):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check exists
        cursor.execute("SELECT id FROM destinations_config WHERE destination_name = ?", (destination.destination_name,))
        if cursor.fetchone() is not None:
             conn.close()
             raise HTTPException(status_code=400, detail="Destination with this name already exists")

        new_id = str(uuid.uuid4())
        creds_json = json.dumps(destination.destination_creds) if destination.destination_creds else None

        query = """
            INSERT INTO destinations_config (
                id, destination_name, destination_type, destination_creds
            ) VALUES (?, ?, ?, ?)
        """
        
        cursor.execute(query, (
            new_id, destination.destination_name, destination.destination_type,
            creds_json
        ))
        
        conn.commit()
        conn.close()
        
        destination.id = new_id
        return destination
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
