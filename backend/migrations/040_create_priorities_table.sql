-- Create priorities table to manage course priority options dynamically
CREATE TABLE IF NOT EXISTS priorities (
    id SERIAL PRIMARY KEY,
    value VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(100) DEFAULT 'text-gray-500 dark:text-gray-400',
    icon VARCHAR(50) DEFAULT 'Flag',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default priority values
INSERT INTO priorities (value, label, color, icon, sort_order, is_default) VALUES
    ('low', 'Low', 'text-gray-500 dark:text-gray-400', 'Flag', 1, false),
    ('medium', 'Medium', 'text-yellow-500 dark:text-yellow-400', 'Flag', 2, true),
    ('high', 'High', 'text-orange-500 dark:text-orange-400', 'Flag', 3, false),
    ('critical', 'Critical', 'text-red-500 dark:text-red-400', 'AlertTriangle', 4, false),
    ('urgent', 'Urgent', 'text-red-600 dark:text-red-500', 'AlertTriangle', 5, false)
ON CONFLICT (value) DO NOTHING;

-- Update courses table to remove the priority constraint (will be validated against priorities table)
ALTER TABLE courses DROP CONSTRAINT IF EXISTS valid_priority;

-- Add comment for documentation
COMMENT ON TABLE priorities IS 'Stores configurable priority levels for courses';
COMMENT ON COLUMN priorities.value IS 'Internal value used in database and API';
COMMENT ON COLUMN priorities.label IS 'Display label shown in UI';
COMMENT ON COLUMN priorities.color IS 'Tailwind CSS classes for styling';
COMMENT ON COLUMN priorities.icon IS 'Lucide icon name for display';
COMMENT ON COLUMN priorities.sort_order IS 'Display order in dropdowns and lists';
COMMENT ON COLUMN priorities.is_active IS 'Whether this priority is available for selection';
COMMENT ON COLUMN priorities.is_default IS 'Default priority for new courses';