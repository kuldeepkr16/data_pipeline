import sqlite3
import os

DB_PATH = "databases/config_db/data/config.db"

def migrate():
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Running migration for Connections (UUID + Creds)...")

    # Drop existing tables to support the schema change (User approved)
    cursor.execute("DROP TABLE IF EXISTS sources_config")
    cursor.execute("DROP TABLE IF EXISTS destinations_config")

    # Create sources_config with new schema
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sources_config (
        id TEXT PRIMARY KEY, -- UUID
        source_name TEXT UNIQUE NOT NULL,
        source_type TEXT DEFAULT 'postgres',
        source_creds TEXT, -- JSON string: {host, port, user, password, dbname}
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    print("Re-created sources_config table.")

    # Create destinations_config with new schema
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS destinations_config (
        id TEXT PRIMARY KEY, -- UUID
        destination_name TEXT UNIQUE NOT NULL,
        destination_type TEXT DEFAULT 'postgres',
        destination_creds TEXT, -- JSON string
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    print("Re-created destinations_config table.")
    
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
