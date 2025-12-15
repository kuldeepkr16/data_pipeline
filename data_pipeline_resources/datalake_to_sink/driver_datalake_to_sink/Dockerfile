FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy the driver script
COPY main.py .

# Install dependencies for the driver AND the loader
RUN pip install --no-cache-dir \
    psycopg2-binary==2.9.9 \
    pandas==2.1.4 \
    pyarrow==14.0.1 \
    minio==7.2.0 \
    SQLAlchemy==2.0.25

# Make the script executable
RUN chmod +x main.py
