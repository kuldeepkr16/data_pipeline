FROM python:3.9-slim

WORKDIR /app

# Install system dependencies for loaders (postgres, etc.)
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy the driver script
COPY main.py .

# Install loader dependencies (will be available when loaders are mounted)
# This allows the driver to run loaders directly
RUN pip install --no-cache-dir \
    psycopg2-binary==2.9.9 \
    pandas==2.1.4 \
    pyarrow==14.0.1 \
    minio==7.2.0

# Make the script executable
RUN chmod +x main.py
