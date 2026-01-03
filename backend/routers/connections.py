from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import psycopg2

router = APIRouter(
    prefix="/connections",
    tags=["connections"]
)

class ConnectionTestRequest(BaseModel):
    type: str = 'postgres'
    creds: Dict[str, Any]

@router.post("/test")
def test_connection(request: ConnectionTestRequest):
    if request.type != 'postgres':
        raise HTTPException(status_code=400, detail=f"Unsupported connection type: {request.type}")
    
    creds = request.creds
    required_fields = ['host', 'port', 'user', 'dbname']
    # Password can be empty string, so just check existence of key if needed, or rely on connect failing
    
    missing = [f for f in required_fields if f not in creds]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    try:
        # Attempt connection
        conn = psycopg2.connect(
            host=creds.get('host'),
            port=creds.get('port'),
            user=creds.get('user'),
            password=creds.get('password'),
            dbname=creds.get('dbname'),
            connect_timeout=3 # 3 seconds timeout
        )
        conn.close()
        return {"status": "success", "message": "Connection successful"}
    except psycopg2.Error as e:
        # Return error detail but safe
        error_msg = str(e).strip()
        raise HTTPException(status_code=400, detail=f"Connection failed: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
