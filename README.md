# Data Pipeline Project

A complete local data pipeline environment orchestrated with Docker Compose.

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone git@github.com:kuldeepkr16/data_pipeline.git
   cd data_pipeline
   ```

2. **Start the environment**
   ```bash
   docker compose up -d --build
   ```

3. **Stop the environment**
   ```bash
   docker compose down
   ```

## 🖥️ Access Points

| Service | URL / Port | Description |
|---------|------------|-------------|
| **Frontend UI** | [http://localhost:3000](http://localhost:3000) | React/Next.js Configuration Dashboard |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI Service |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Object Storage UI (User/Pass: `minioadmin`) |
| **Source DB** | `localhost:5434` | Postgres (Pre-loaded with data) |
| **Sink DB** | `localhost:5433` | Postgres (Empty) |

## 🔐 Credentials & Connections

### **PostgreSQL Databases**

**Source DB (Port 5434)**
```bash
PGPASSWORD=read_password psql -h localhost -p 5434 -U read_user -d source_db
```

**Sink DB (Port 5433)**
```bash
PGPASSWORD=write_password psql -h localhost -p 5433 -U write_user -d sink_db
```

### **MinIO**
- **Endpoint**: `http://localhost:9000`
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`

### **Configuration DB (SQLite)**
To inspect the config database locally:
```bash
sqlite3 databases/config_db/data/config.db "SELECT * FROM table_config;"
```
