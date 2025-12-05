-- Create read-only user for source database
CREATE USER read_user WITH PASSWORD 'read_password';

-- Grant connect privilege
GRANT CONNECT ON DATABASE source_db TO read_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO read_user;

-- Grant select on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_user;

-- Grant select on all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_user;

-- Grant select on all existing sequences
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO read_user;

-- Grant select on all future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO read_user;

