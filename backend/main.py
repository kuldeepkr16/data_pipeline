from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from typing import List, Dict, Any

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
    schedule_in_mins: int
    load_type: str
    is_active: int

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
        cursor.execute("SELECT * FROM table_config")
        rows = cursor.fetchall()
        conn.close()
        
        # Convert rows to list of dicts
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config/{table_name}")
def get_table_config(table_name: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM table_config WHERE table_name = ?", (table_name,))
        row = cursor.fetchone()
        conn.close()
        
        if row is None:
            raise HTTPException(status_code=404, detail="Table config not found")
            
        return dict(row)
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.put("/config/{table_name}")
def update_table_config(table_name: str, config: ConfigUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT table_name FROM table_config WHERE table_name = ?", (table_name,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Table config not found")
            
        # Update config
        cursor.execute("""
            UPDATE table_config 
            SET schedule_in_mins = ?, load_type = ?, is_active = ?
            WHERE table_name = ?
        """, (config.schedule_in_mins, config.load_type, config.is_active, table_name))
        
        conn.commit()
        conn.close()
        
        return {"message": "Config updated successfully", "table_name": table_name, **config.dict()}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
