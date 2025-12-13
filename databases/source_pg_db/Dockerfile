FROM postgres:15-alpine

# Set environment variables for superuser
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=source_db

# Copy initialization script (99_ prefix ensures it runs AFTER tables are created)
COPY init.sql /docker-entrypoint-initdb.d/99_init.sql

# Expose PostgreSQL port
EXPOSE 5432

