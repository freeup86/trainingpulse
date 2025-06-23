-- Create statuses table for configurable course statuses
-- Migration 004: Add statuses management

CREATE TABLE statuses (
    id SERIAL PRIMARY KEY,
    value VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'Circle',
    color VARCHAR(100) NOT NULL DEFAULT 'text-gray-500 dark:text-gray-400',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_value CHECK (value ~ '^[a-z_]+$')
);

-- Create index for ordering and lookups
CREATE INDEX idx_statuses_value ON statuses(value);
CREATE INDEX idx_statuses_order ON statuses(order_index);
CREATE INDEX idx_statuses_active ON statuses(is_active);

-- Insert default statuses
INSERT INTO statuses (value, label, icon, color, order_index) VALUES
('active', 'Active', 'CheckCircle', 'text-green-500 dark:text-green-400', 1),
('inactive', 'Inactive', 'Circle', 'text-gray-500 dark:text-gray-400', 2),
('on_hold', 'On Hold', 'Pause', 'text-yellow-500 dark:text-yellow-400', 3),
('cancelled', 'Cancelled', 'X', 'text-red-500 dark:text-red-400', 4),
('completed', 'Completed', 'CheckCircle', 'text-blue-500 dark:text-blue-400', 5);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_statuses_updated_at
    BEFORE UPDATE ON statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_statuses_updated_at();