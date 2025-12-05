-- Create write user for sink database
CREATE USER write_user WITH PASSWORD 'write_password';

-- Grant connect privilege
GRANT CONNECT ON DATABASE sink_db TO write_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO write_user;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO write_user;

-- Grant all privileges on all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO write_user;

-- Grant all privileges on all existing sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO write_user;

-- Grant all privileges on all future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO write_user;

-- Grant create privilege to allow creating tables
GRANT CREATE ON SCHEMA public TO write_user;

