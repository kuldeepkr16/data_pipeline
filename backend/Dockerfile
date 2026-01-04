FROM python:3.9-slim

WORKDIR /app

# Install Docker CLI for pipeline triggering
RUN apt-get update && apt-get install -y \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# We expect the SQLite DB to be mounted at /data/config.db
# This matches the path used in the code

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

