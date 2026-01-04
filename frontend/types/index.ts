export interface Config {
    source_tablename: string;
    source_to_dl_schedule: number;
    source_to_dl_load_type: string;
    source_to_dl_is_active: number;
    source_to_dl_last_loader_run_status?: string;
    source_to_dl_last_loader_run_timestamp?: string;
    source_type?: string;
    dl_to_sink_schedule?: number;
    dl_to_sink_load_type?: string;
    dl_to_sink_is_active?: number;
    dl_to_sink_last_loader_run_status?: string;
    dl_to_sink_last_loader_run_timestamp?: string;
    sink_type?: string;
    source_name?: string;
    destination_name?: string;
}

export interface ConfigCreate {
    source_tablename: string;
    sink_tablename: string;
    source_type?: string;
    sink_type?: string;
    source_to_dl_schedule?: number;
    source_to_dl_load_type?: string;
    dl_to_sink_schedule?: number;
    dl_to_sink_load_type?: string;
    source_name: string;
    destination_name: string;
}

export interface ConnectionCreds {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    dbname?: string;
    [key: string]: any;
}

export interface SourceConfig {
    id?: string;
    source_name: string;
    source_type?: string;
    source_creds?: ConnectionCreds;
    created_at?: string;
}

export interface DestinationConfig {
    id?: string;
    destination_name: string;
    destination_type?: string;
    destination_creds?: ConnectionCreds;
    created_at?: string;
}

export interface PipelineLog {
    id: string;
    source_tablename: string;
    pipeline_type: string;
    status: string;
    error_message: string | null;
    rows_processed: number | null;
    file_paths: string | null;
    started_at: string;
    completed_at: string | null;
    time_taken: string | null;
    stage_order?: number;
}

export interface PipelineStage {
    id: string;
    pipeline_name: string;
    stage_order: number;
    stage_name: string;
    stage_type: string;
    driver_container: string;
    is_active: boolean;
}

export interface PipelineRun {
    id: string;
    source_tablename: string;
    pipeline_name: string;
    status: string;
    current_stage: number;
    total_stages: number;
    triggered_by: string;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
    stages?: PipelineLog[];
    stage_definitions?: PipelineStage[];
}
