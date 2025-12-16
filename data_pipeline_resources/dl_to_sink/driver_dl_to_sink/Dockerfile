FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy the driver script
COPY main.py .

# Install dependencies via requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Make the script executable
RUN chmod +x main.py
