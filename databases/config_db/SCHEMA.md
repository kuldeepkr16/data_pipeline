# Config Database Schema

Found in: `databases/config_db/data/config.db`
Initialization: `databases/config_db/init.sql`

## Tables

### 1. `pipeline_config`
**Purpose**: The central registry defining **WHAT** needs to be processed.
> [!IMPORTANT]
> This table is partially DEPRECATED. Connection details are now managed in `sources_config` and `destinations_config`, linked via `source_name` and `destination_name`.

- **Primary Key**: `source_tablename`
- **Usage**: Stores scheduling, load types (full/incremental), and active status for each table.

| Column | Type | Description |
|--------|------|-------------|
| `source_tablename` | TEXT | Unique identifier for the table config (PK) |
| `sink_tablename` | TEXT | Destination table name |
| `source_name` | TEXT | Reference name for the source connection |
| `destination_name` | TEXT | Reference name for the destination connection |
| `source_to_dl_schedule` | INTEGER | Interval in minutes |
| `source_to_dl_load_type` | TEXT | 'full' or 'incremental' |
| `source_to_dl_is_active` | BOOLEAN | 1 = Active, 0 = Inactive |
| `source_type` | TEXT | Default 'postgres' |
| `source_to_dl_incremental_key` | TEXT | Column used for incremental logic |
| `source_to_dl_last_incremental_value` | TIMESTAMP | Value of the last processed record |
| `dl_to_sink_schedule` | INTEGER | Interval in minutes |
| `dl_to_sink_load_type` | TEXT | 'full' or 'incremental' |
| `dl_to_sink_is_active` | BOOLEAN | 1 = Active, 0 = Inactive |
| `sink_type` | TEXT | Default 'postgres' |
| `dl_to_sink_incremental_key` | TEXT | Column used for incremental logic |
| `dl_to_sink_last_incremental_value` | TIMESTAMP | Value of the last processed record |
| `dl_to_sink_last_loader_run_timestamp` | TIMESTAMP | Time of last run |
| `dl_to_sink_last_loader_run_status` | TEXT | Status of last run |

---

### 2. `sources_config`
**Purpose**: Stores connection details for **Data Sources**.
- **Primary Key**: `id` (UUID v7)
- **Usage**: Central repository for source credentials and types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID v7 Primary Key |
| `source_name` | TEXT | Unique identifier/slug for the source |
| `source_type` | TEXT | 'postgres', 'mysql', 'mongo', 'salesforce', etc. |
| `source_creds` | TEXT | JSON string containing connection details (encrypted) |
| `created_at` | TIMESTAMP | Creation timestamp |

---

### 3. `destinations_config`
**Purpose**: Stores connection details for **Data Destinations**.
- **Primary Key**: `id` (UUID v7)
- **Usage**: Central repository for destination credentials and types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID v7 Primary Key |
| `destination_name` | TEXT | Unique identifier/slug for the destination |
| `destination_type` | TEXT | 'postgres', 'bigquery', 'snowflake', etc. |
| `destination_creds` | TEXT | JSON string containing connection details (encrypted) |
| `created_at` | TIMESTAMP | Creation timestamp |

---

### 4. `pipeline_stages`
**Purpose**: The template defining **HOW** the pipeline works.
- **Primary Key**: `id` (TEXT/UUID)
- **Unique Constraint**: `(pipeline_name, stage_order)`
- **Usage**: Defines the granular steps (driver check, extraction, verification, loading).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK (UUID v7) |
| `pipeline_name` | TEXT | Grouping name (e.g., 'default') |
| `stage_order` | INTEGER | Execution sequence (1, 2, 3...) |
| `stage_name` | TEXT | Human-readable name |
| `stage_type` | TEXT | System identifier for logic |
| `driver_container` | TEXT | Which docker container executes this stage |
| `is_active` | BOOLEAN | 1 = Active, 0 = Inactive |
| `created_at` | TIMESTAMP | Creation timestamp |

---

### 5. `pipeline_runs_master`
**Purpose**: The **Header** record for a single execution instance.
- **Foreign Key**: `source_tablename` -> `pipeline_config.source_tablename`
- **Usage**: Tracks the overall status of a triggered job.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK (Run ID - UUID v7) |
| `source_tablename` | TEXT | Target of this run |
| `pipeline_name` | TEXT | Which stage template was used |
| `status` | TEXT | 'pending', 'running', 'success', 'failed' |
| `current_stage` | INTEGER | Pointer to current step |
| `total_stages` | INTEGER | Total steps to complete |
| `triggered_by` | TEXT | 'manual', 'schedule', 'api' |
| `started_at` | TIMESTAMP | Start time |
| `completed_at` | TIMESTAMP | End time |
| `error_message` | TEXT | Root cause if failed |

---

### 6. `pipeline_run_stage_logs`
**Purpose**: The **Detail/Line Items** for a run.
- **Primary Key**: `id` (TEXT/UUID)
- **Foreign Key**: `pipeline_run_id` -> `pipeline_runs_master.id`
- **Usage**: Tracks the result of each individual stage within a run.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK (UUID v7) |
| `source_tablename` | TEXT | Link to table config |
| `pipeline_type` | TEXT | 'source_to_dl' or 'dl_to_sink' |
| `pipeline_run_id` | TEXT | Link to parent master run |
| `stage_order` | INTEGER | Which step this log belongs to |
| `status` | TEXT | 'success', 'failed', 'running' |
| `rows_processed` | INTEGER | Metrics |
| `file_paths` | TEXT | Artifacts generated (e.g., S3 paths) |
| `time_taken` | TEXT | Duration in HH:MM:SS format |
| `started_at` | TIMESTAMP | Start time |
| `completed_at` | TIMESTAMP | End time |
| `error_message` | TEXT | Error detail if failed |

---

### 7. `source_and_destination_table_schema`
**Purpose**: Caches inferred and retrieved schemas for mapping UI.
- **Primary Key**: `(source_tablename, destination_tablename)`
- **Usage**: Used to drive the "Schema Mapping" feature.

| Column | Type | Description |
|--------|------|-------------|
| `source_tablename` | TEXT | Source table identifier (Composite PK) |
| `destination_tablename` | TEXT | Destination table identifier (Composite PK) |
| `source_schema` | TEXT | JSON string: columns and types from Data Lake |
| `destination_schema` | TEXT | JSON string: columns and types from Sink DB |
| `last_updated` | TIMESTAMP | Last refresh timestamp |
