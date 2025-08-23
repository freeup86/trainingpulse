-- Migration: Create course phase archives table
-- This table stores historical phase data when a course progresses to a new status

CREATE TABLE IF NOT EXISTS course_phase_archives (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  course_status VARCHAR(50) NOT NULL, -- The course status during which these phases were completed
  subtask_id INTEGER NOT NULL,
  subtask_title VARCHAR(255) NOT NULL,
  phase_status VARCHAR(50) NOT NULL,
  
  -- Store all the phase status history for this subtask during this course status
  phase_history JSONB NOT NULL DEFAULT '[]', -- Array of {status, started_at, finished_at}
  
  -- Key dates
  start_date TIMESTAMP,
  finish_date TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Metadata
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_by INTEGER REFERENCES users(id),
  
  -- Index for lookups
  CONSTRAINT unique_course_subtask_status UNIQUE (course_id, subtask_id, course_status)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_phase_archives_course_id ON course_phase_archives(course_id);
CREATE INDEX IF NOT EXISTS idx_course_phase_archives_course_status ON course_phase_archives(course_status);
CREATE INDEX IF NOT EXISTS idx_course_phase_archives_subtask_id ON course_phase_archives(subtask_id);
CREATE INDEX IF NOT EXISTS idx_course_phase_archives_archived_at ON course_phase_archives(archived_at);

-- Add a comment explaining the table
COMMENT ON TABLE course_phase_archives IS 'Stores historical phase completion data when courses progress to new statuses, preserving all dates and progress from previous status periods';