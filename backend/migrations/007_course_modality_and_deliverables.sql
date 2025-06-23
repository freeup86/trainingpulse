-- Migration: Add modality types, deliverables, and update task structure
-- This migration updates the course creation process to support:
-- 1. Modality types (WBT, ILT/VLT, Micro Learning, SIMS, DAP)
-- 2. Auto-assigned deliverables based on modality
-- 3. Auto-created tasks with specific statuses

-- Add modality column to courses table
ALTER TABLE courses 
ADD COLUMN modality VARCHAR(50),
ADD CONSTRAINT valid_modality CHECK (modality IN ('WBT', 'ILT/VLT', 'Micro Learning', 'SIMS', 'DAP'));

-- Create deliverables table
CREATE TABLE deliverables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create course_deliverables junction table
CREATE TABLE course_deliverables (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    deliverable_id INTEGER NOT NULL REFERENCES deliverables(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_course_deliverable UNIQUE(course_id, deliverable_id)
);

-- Update course_subtasks to support new task types and statuses
ALTER TABLE course_subtasks
ADD COLUMN task_type VARCHAR(50),
ADD COLUMN assigned_user_id INTEGER REFERENCES users(id),
ADD COLUMN assigned_at TIMESTAMP,
ADD COLUMN assigned_by INTEGER REFERENCES users(id);

-- Add constraint for task types
ALTER TABLE course_subtasks
ADD CONSTRAINT valid_task_type CHECK (task_type IN ('Outline', 'Storyboard', 'Development'));

-- Update status constraint to include new statuses
ALTER TABLE course_subtasks
DROP CONSTRAINT IF EXISTS course_subtasks_status_check;

ALTER TABLE course_subtasks
ADD CONSTRAINT valid_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final'));

-- Insert default deliverables
INSERT INTO deliverables (name, description) VALUES
('Custom Content', 'Custom content deliverable for WBT courses'),
('Course Wrapper', 'Course wrapper deliverable for WBT courses'),
('Facilitator Guide', 'Facilitator guide for ILT/VLT courses'),
('PowerPoint', 'PowerPoint presentation for ILT/VLT courses'),
('Microlearning', 'Microlearning content deliverable'),
('SIMS', 'Software simulation deliverable'),
('QRG', 'Quick Reference Guide deliverable'),
('Demo', 'Demo deliverable for SIMS courses'),
('WalkMe', 'WalkMe deliverable for DAP courses');

-- Create modality_deliverables table to define auto-assignments
CREATE TABLE modality_deliverables (
    id SERIAL PRIMARY KEY,
    modality VARCHAR(50) NOT NULL,
    deliverable_id INTEGER NOT NULL REFERENCES deliverables(id),
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_modality_deliverable UNIQUE(modality, deliverable_id)
);

-- Define auto-assigned deliverables for each modality
INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'ILT/VLT', id, false FROM deliverables WHERE name IN ('Facilitator Guide', 'PowerPoint');

INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'Micro Learning', id, false FROM deliverables WHERE name = 'Microlearning';

INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'SIMS', id, false FROM deliverables WHERE name IN ('SIMS', 'QRG', 'Demo');

INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'DAP', id, false FROM deliverables WHERE name = 'WalkMe';

-- WBT has optional deliverables (user chooses between Custom Content or Course Wrapper)
INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'WBT', id, true FROM deliverables WHERE name IN ('Custom Content', 'Course Wrapper');

-- Create modality_tasks table to define auto-created tasks
CREATE TABLE modality_tasks (
    id SERIAL PRIMARY KEY,
    modality VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_modality_task UNIQUE(modality, task_type)
);

-- Define auto-created tasks for each modality
-- WBT: Outline, Storyboard, Development
INSERT INTO modality_tasks (modality, task_type, order_index) VALUES
('WBT', 'Outline', 1),
('WBT', 'Storyboard', 2),
('WBT', 'Development', 3);

-- ILT/VLT: Outline, Development
INSERT INTO modality_tasks (modality, task_type, order_index) VALUES
('ILT/VLT', 'Outline', 1),
('ILT/VLT', 'Development', 2);

-- Microlearning: Outline, Storyboard, Development
INSERT INTO modality_tasks (modality, task_type, order_index) VALUES
('Micro Learning', 'Outline', 1),
('Micro Learning', 'Storyboard', 2),
('Micro Learning', 'Development', 3);

-- SIMS: Storyboard, Development
INSERT INTO modality_tasks (modality, task_type, order_index) VALUES
('SIMS', 'Storyboard', 1),
('SIMS', 'Development', 2);

-- DAP: Storyboard, Development
INSERT INTO modality_tasks (modality, task_type, order_index) VALUES
('DAP', 'Storyboard', 1),
('DAP', 'Development', 2);

-- Create indexes for performance
CREATE INDEX idx_course_deliverables_course ON course_deliverables(course_id);
CREATE INDEX idx_course_deliverables_deliverable ON course_deliverables(deliverable_id);
CREATE INDEX idx_modality_deliverables_modality ON modality_deliverables(modality);
CREATE INDEX idx_modality_tasks_modality ON modality_tasks(modality);
CREATE INDEX idx_course_subtasks_assigned_user ON course_subtasks(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX idx_courses_modality ON courses(modality) WHERE modality IS NOT NULL;