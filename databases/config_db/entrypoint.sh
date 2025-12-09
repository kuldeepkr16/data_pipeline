#!/bin/sh

DB_FILE="/data/config.db"
INIT_SQL="/init.sql"

# Check if database needs initialization
if [ ! -f "$DB_FILE" ]; then
    echo "Initializing SQLite database..."
    sqlite3 "$DB_FILE" < "$INIT_SQL"
    echo "Database initialized."
else
    echo "Database already exists."
fi

# Keep the container running so you can access it
exec tail -f /dev/null

