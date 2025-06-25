-- Migration: Add subtask_assignments table for multiple user assignments
-- This migration creates a junction table to support multiple users assigned to each subtask

-- Create subtask_assignments table
CREATE TABLE subtask_assignments (
  id SERIAL PRIMARY KEY,
  subtask_id INTEGER NOT NULL REFERENCES course_subtasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subtask_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_subtask_assignments_subtask_id ON subtask_assignments(subtask_id);
CREATE INDEX idx_subtask_assignments_user_id ON subtask_assignments(user_id);
CREATE INDEX idx_subtask_assignments_assigned_by ON subtask_assignments(assigned_by);

-- Migrate existing single assignments to the new table
INSERT INTO subtask_assignments (subtask_id, user_id, assigned_at, assigned_by)
SELECT id, assigned_user_id, assigned_at, assigned_by
FROM course_subtasks
WHERE assigned_user_id IS NOT NULL;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_subtask_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subtask_assignments_updated_at
    BEFORE UPDATE ON subtask_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_subtask_assignments_updated_at();