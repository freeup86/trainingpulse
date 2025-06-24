-- Migration: Update course statuses to use proper training course statuses
-- This migration replaces the generic statuses with training-specific statuses
-- and sets Pre-Development as the default status

-- Clear existing statuses (since we're changing the schema)
DELETE FROM statuses;

-- Insert the proper training course statuses
INSERT INTO statuses (value, label, icon, color, order_index) VALUES
('pre_development', 'Pre-Development', 'Clock', 'text-purple-500 dark:text-purple-400', 1),
('on_hold', 'On Hold', 'Pause', 'text-yellow-500 dark:text-yellow-400', 2),
('outlines', 'Outlines', 'FileText', 'text-blue-500 dark:text-blue-400', 3),
('storyboard', 'Storyboard', 'Layout', 'text-indigo-500 dark:text-indigo-400', 4),
('development', 'Development', 'Code', 'text-orange-500 dark:text-orange-400', 5),
('completed', 'Completed', 'CheckCircle', 'text-green-500 dark:text-green-400', 6),
('paused', 'Paused', 'Square', 'text-gray-500 dark:text-gray-400', 7);

-- Update the default value for the courses table status column to pre_development
ALTER TABLE courses ALTER COLUMN status SET DEFAULT 'pre_development';

-- Update any existing courses that have 'draft' status to 'pre_development'
UPDATE courses SET status = 'pre_development' WHERE status = 'draft';

-- Update any existing courses that have 'inactive' status to 'pre_development'
UPDATE courses SET status = 'pre_development' WHERE status = 'inactive';