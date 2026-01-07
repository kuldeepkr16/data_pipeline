FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Loaders will be mounted or copied here.
# For development we mount, for production we could copy.
# But per implementation plan, we follow the pattern.

# Keep container alive
CMD ["tail", "-f", "/dev/null"]
