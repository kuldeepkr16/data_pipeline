from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class ConfigUpdate(BaseModel):
    source_to_dl_schedule: Optional[int] = None
    source_to_dl_load_type: Optional[str] = None
    source_to_dl_is_active: Optional[int] = None
    source_to_dl_incremental_key: Optional[str] = None
    dl_to_sink_schedule: Optional[int] = None
    dl_to_sink_load_type: Optional[str] = None
    dl_to_sink_is_active: Optional[int] = None
    dl_to_sink_incremental_key: Optional[str] = None
    source_name: Optional[str] = None
    destination_name: Optional[str] = None
    sink_tablename: Optional[str] = None

class ConfigCreate(BaseModel):
    source_tablename: str
    sink_tablename: str
    source_name: str
    destination_name: str
    source_type: Optional[str] = 'postgres'
    sink_type: Optional[str] = 'postgres'
    source_to_dl_schedule: int = 60
    source_to_dl_load_type: str = 'full'
    dl_to_sink_schedule: int = 60
    dl_to_sink_load_type: str = 'full'

# New Models: Connections (Sources/Destinations)
class SourceConfig(BaseModel):
    id: Optional[str] = None
    source_name: str
    source_type: Optional[str] = 'postgres'
    source_creds: Optional[Dict[str, Any]] = None # JSON stored as string in DB
    created_at: Optional[str] = None

class DestinationConfig(BaseModel):
    id: Optional[str] = None
    destination_name: str
    destination_type: Optional[str] = 'postgres'
    destination_creds: Optional[Dict[str, Any]] = None # JSON stored as string in DB
    created_at: Optional[str] = None

class StageCreate(BaseModel):
    pipeline_name: str
    stage_order: int
    stage_name: str
    stage_type: str
    driver_container: str

class TriggerRequest(BaseModel):
    pipeline_name: str = "default"
    triggered_by: str = "manual"

class SchemaColumn(BaseModel):
    name: str
    type: str

class SchemaInfo(BaseModel):
    source_tablename: str
    destination_tablename: Optional[str] = None
    source_schema: Optional[List[SchemaColumn]] = None
    destination_schema: Optional[List[SchemaColumn]] = None
    last_updated: Optional[str] = None
