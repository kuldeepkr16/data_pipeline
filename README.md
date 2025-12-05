# Data Pipeline Project

This project sets up a local data pipeline environment using Docker. It includes two PostgreSQL databases (source and sink) and a MinIO object storage server.

## Services

| Service | Container Name | Port | Description |
|---------|----------------|------|-------------|
| **Source DB** | `source_pg_db` | 5434 | Source PostgreSQL database with initial data |
| **Sink DB** | `sink_pg_db` | 5433 | Sink PostgreSQL database (empty) |
| **MinIO** | `minio_server` | 9000 (API), 9001 (UI) | S3-compatible object storage |

## Getting Started

### Prerequisites
- Docker Desktop installed and running.

### Start the Environment
Run the following command in the project root to build and start all services:

```bash
docker compose up -d --build
```

### Stop the Environment
To stop and remove the containers:

```bash
docker compose down
```

## Credentials

### Source Database (`source_pg_db`)
- **Host**: `localhost`
- **Port**: `5434`
- **Database**: `source_db`
- **Superuser**: `postgres` / `postgres`
- **Read User**: `read_user` / `read_password`

**Connect via terminal:**
```bash
PGPASSWORD=read_password psql -h localhost -p 5434 -U read_user -d source_db
```

### Sink Database (`sink_pg_db`)
- **Host**: `localhost`
- **Port**: `5433`
- **Database**: `sink_db`
- **Superuser**: `postgres` / `postgres`
- **Write User**: `write_user` / `write_password`

**Connect via terminal:**
```bash
PGPASSWORD=write_password psql -h localhost -p 5433 -U write_user -d sink_db
```

### MinIO
- **Console URL**: [http://localhost:9001](http://localhost:9001)
- **API Endpoint**: `http://localhost:9000`
- **User**: `minioadmin`
- **Password**: `minioadmin`

## Data Persistence
- **MinIO**: Data is persisted in the `./minio_data` folder on your host machine.
- **Databases**: Data is **ephemeral**. The Source DB is automatically re-populated with dummy data (`sql_schema/initial_tables.sql`) every time the container starts. The Sink DB starts empty.

