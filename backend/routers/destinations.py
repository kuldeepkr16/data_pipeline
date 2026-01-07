from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import json
import uuid6
from db.connection import get_db_connection
from schemas.models import DestinationConfig
from schemas.models import DestinationConfig
from utils.encryption import encrypt, decrypt, mask_credentials
from db.queries import (
    GET_ALL_DESTINATIONS,
    GET_DESTINATION_BY_ID,
    CHECK_DESTINATION_EXISTS_BY_NAME,
    INSERT_DESTINATION,
    DELETE_DESTINATION_BY_NAME,
    UPDATE_DESTINATION_BY_NAME
)

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
        cursor.execute(GET_ALL_DESTINATIONS)
        rows = cursor.fetchall()

        dests = []
        for row in rows:
            data = dict(row)
            if data["destination_creds"]:
                data["destination_creds"] = decrypt(data["destination_creds"])
                data["destination_creds"] = mask_credentials(data["destination_creds"])
            dests.append(data)
            
        conn.close()
        return dests
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.get("/summary")
def get_destinations_summary():
    """
    Returns a lightweight list of destinations with masked/minimal credentials.
    Suitable for listing pages.
    """
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(GET_ALL_DESTINATIONS)
        rows = cursor.fetchall()

        dests = []
        safe_keys = ['host', 'port', 'dbname', 'user', 'region_name', 'bucket_name', 'url', 'spreadsheet_link', 'username']

        for row in rows:
            data = dict(row)
            if data["destination_creds"]:
                try:
                    full_creds = decrypt(data["destination_creds"])
                    # Filter only safe keys
                    safe_creds = {k: v for k, v in full_creds.items() if k in safe_keys} if full_creds else {}
                    data["destination_creds"] = safe_creds
                except:
                    data["destination_creds"] = {} # Fail safe
            else:
                 data["destination_creds"] = {}
                 
            dests.append(data)
            
        conn.close()
        return dests
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.get("/{destination_id}", response_model=DestinationConfig)
def get_destination_by_id(destination_id: str):
    """
    Fetch full destination details by ID.
    Credentials are masked (********) but present.
    """
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Try finding by UUID first
        cursor.execute(GET_DESTINATION_BY_ID, (destination_id,))
        row = cursor.fetchone()
        
        if not row:
            # If not found by ID, allow falling through to next route handler logic if it was intended as a name?
            # But in FastAPI, strict ordering means we catch it here.
            # To support legacy names if UUID fails:
            conn.close()
            # If standard UUID length (36), likely not a name like "dest1".
            # Raising 404 here might block the /{name} route if we aren't careful.
            # However, /{destination_name} is DELETE and PUT. 
            # Oh wait! We don't have a GET /{destination_name} in previous code!
            # So this is the ONLY GET /{} route. Safe to 404.
            raise HTTPException(status_code=404, detail="Destination not found")
        
        conn.close()    
        data = dict(row)
        if data["destination_creds"]:
            data["destination_creds"] = decrypt(data["destination_creds"])
            data["destination_creds"] = mask_credentials(data["destination_creds"])
            
        return data
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.post("", status_code=201)
def create_destination(destination: DestinationConfig):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check exists
        cursor.execute(CHECK_DESTINATION_EXISTS_BY_NAME, (destination.destination_name,))
        if cursor.fetchone() is not None:
             conn.close()
             raise HTTPException(status_code=400, detail="Destination with this name already exists")

        new_id = str(uuid6.uuid7())
        creds_json = encrypt(destination.destination_creds) if destination.destination_creds else None
        
        cursor.execute(INSERT_DESTINATION, (
            new_id, destination.destination_name, destination.destination_type,
            creds_json
        ))
        
        conn.commit()
        conn.close()
        
        destination.id = new_id
        return destination
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.delete("/{destination_name}", status_code=204)
def delete_destination(destination_name: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(CHECK_DESTINATION_EXISTS_BY_NAME, (destination_name,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Destination not found")
            
        cursor.execute(DELETE_DESTINATION_BY_NAME, (destination_name,))
        conn.commit()
        conn.close()
        return None
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@router.put("/{destination_name}")
def update_destination(destination_name: str, destination: DestinationConfig):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exists
        cursor.execute(CHECK_DESTINATION_EXISTS_BY_NAME, (destination_name,))
        row = cursor.fetchone()
        if row is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Destination not found")
        
        current_id = row[0]
        
        # Encrypt creds if present
        creds_json = encrypt(destination.destination_creds) if destination.destination_creds else None
        
        cursor.execute(UPDATE_DESTINATION_BY_NAME, (
            destination.destination_type, creds_json, destination_name
        ))
        
        conn.commit()
        conn.close()
        
        destination.id = current_id
        return destination
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
