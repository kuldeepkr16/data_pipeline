-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
);

-- Insert dummy data into customers
INSERT INTO customers (first_name, last_name, email) VALUES
    ('John', 'Doe', 'john.doe@example.com'),
    ('Jane', 'Smith', 'jane.smith@example.com'),
    ('Michael', 'Johnson', 'michael.j@example.com'),
    ('Emily', 'Brown', 'emily.b@example.com'),
    ('David', 'Wilson', 'david.w@example.com'),
    ('Sarah', 'Taylor', 'sarah.t@example.com'),
    ('Robert', 'Anderson', 'robert.a@example.com'),
    ('Lisa', 'Martinez', 'lisa.m@example.com'),
    ('James', 'Thomas', 'james.t@example.com'),
    ('Jennifer', 'Garcia', 'jennifer.g@example.com');

-- Insert dummy data into orders
INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES
    (1, '2023-01-15 10:30:00', 99.99, 'completed'),
    (2, '2023-01-16 14:20:00', 149.50, 'processing'),
    (1, '2023-01-20 09:15:00', 45.00, 'completed'),
    (3, '2023-01-22 11:45:00', 299.99, 'shipped'),
    (4, '2023-01-25 16:10:00', 75.25, 'pending'),
    (5, '2023-01-28 13:00:00', 120.00, 'completed'),
    (2, '2023-02-01 08:45:00', 55.50, 'cancelled'),
    (6, '2023-02-05 15:30:00', 180.75, 'shipped'),
    (7, '2023-02-10 12:20:00', 89.99, 'processing'),
    (8, '2023-02-15 10:00:00', 210.00, 'completed');

