FROM alpine:latest

# Install SQLite
RUN apk add --no-cache sqlite

# Create data directory
WORKDIR /data

# Copy resources
COPY init.sql /init.sql
COPY entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

