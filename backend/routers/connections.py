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
    creds = request.creds
    conn_type = request.type
    
    # Generic check for required fields based on type
    # This acts as a secondary check to frontend validation
    required_map = {
        'postgres': ['host', 'port', 'user', 'dbname'],
        'mysql': ['host', 'port', 'user', 'dbname'],
        'mongodb': ['connection_string', 'dbname'],
        'dynamodb': ['region_name', 'aws_access_key_id', 'aws_secret_access_key'],
        'salesforce': ['username', 'password', 'security_token'],
        'googlesheets': ['spreadsheet_link', 'service_account_json'],
        's3': ['bucket_name', 'aws_access_key_id', 'aws_secret_access_key'],
        'api': ['url', 'method'],
        'webhook': [] # No strict requirements for webhook test potentially
    }

    if conn_type in required_map:
        missing = [f for f in required_map[conn_type] if f not in creds or not str(creds[f]).strip()]
        if missing:
             raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    try:
        if conn_type == 'postgres':
            # Real connection test for Postgres
            conn = psycopg2.connect(
                host=creds.get('host'),
                port=creds.get('port'),
                user=creds.get('user'),
                password=creds.get('password'),
                dbname=creds.get('dbname'),
                connect_timeout=3
            )
            conn.close()
            return {"status": "success", "message": "Connection successful"}
            
        elif conn_type == 'googlesheets':
            # Structural validation for Google Sheets
            import json
            
            # Validate Link
            link = creds.get('spreadsheet_link', '')
            if not link.startswith('https://docs.google.com/spreadsheets/'):
                raise ValueError("Invalid Spreadsheet Link. Must start with https://docs.google.com/spreadsheets/")
                
            # Validate JSON
            service_account = creds.get('service_account_json', '')
            try:
                json_data = json.loads(service_account)
                if json_data.get('type') != 'service_account':
                    raise ValueError("JSON does not look like a service account key (missing 'type': 'service_account')")
            except json.JSONDecodeError:
                raise ValueError("Service Account JSON is not valid JSON")
                
            return {"status": "success", "message": "Configuration valid (Structurally verified)"}

        elif conn_type == 'mongodb':
            uri = creds.get('connection_string', '')
            if not (uri.startswith('mongodb://') or uri.startswith('mongodb+srv://')):
                raise ValueError("Connection string must start with mongodb:// or mongodb+srv://")
            return {"status": "success", "message": "Configuration valid (Structurally verified)"}
            
        elif conn_type == 'api':
             url = creds.get('url', '')
             if not (url.startswith('http://') or url.startswith('https://')):
                 raise ValueError("URL must start with http:// or https://")
             return {"status": "success", "message": "Configuration valid (Structurally verified)"}

        else:
             # Fallback for others: satisfied by the Generic required_map check above
             return {"status": "success", "message": f"Configuration valid for {conn_type} (Structurally verified)"}

    except psycopg2.Error as e:
        error_msg = str(e).strip()
        raise HTTPException(status_code=400, detail=f"Connection failed: {error_msg}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
