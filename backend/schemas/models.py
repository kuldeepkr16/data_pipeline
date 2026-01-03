from pydantic import BaseModel
from typing import Optional

class ConfigUpdate(BaseModel):
    source_to_dl_schedule: Optional[int] = None
    source_to_dl_load_type: Optional[str] = None
    source_to_dl_is_active: Optional[int] = None
    dl_to_sink_schedule: Optional[int] = None
    dl_to_sink_load_type: Optional[str] = None
    dl_to_sink_is_active: Optional[int] = None

class StageCreate(BaseModel):
    pipeline_name: str
    stage_order: int
    stage_name: str
    stage_type: str
    driver_container: str

class TriggerRequest(BaseModel):
    pipeline_name: str = "default"
    triggered_by: str = "manual"
