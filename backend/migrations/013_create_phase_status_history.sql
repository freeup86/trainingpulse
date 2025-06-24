-- Create phase_status_history table to track start and finish dates for each status
-- This allows tracking when each phase (Alpha, Beta, Final) was started and finished

CREATE TABLE phase_status_history (
    id SERIAL PRIMARY KEY,
    subtask_id INTEGER NOT NULL REFERENCES course_subtasks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX idx_phase_status_history_subtask_id ON phase_status_history(subtask_id);
CREATE INDEX idx_phase_status_history_status ON phase_status_history(status);
CREATE INDEX idx_phase_status_history_started_at ON phase_status_history(started_at);

-- Add unique constraint to prevent duplicate active status entries
CREATE UNIQUE INDEX idx_phase_status_history_active_status 
ON phase_status_history(subtask_id, status) 
WHERE finished_at IS NULL;

-- Add comments for documentation
COMMENT ON TABLE phase_status_history IS 'Tracks start and finish dates for each status a phase goes through (Alpha, Beta, Final, etc.)';
COMMENT ON COLUMN phase_status_history.subtask_id IS 'Reference to the course subtask (phase)';
COMMENT ON COLUMN phase_status_history.status IS 'The status that was entered (alpha_review, beta_review, final, etc.)';
COMMENT ON COLUMN phase_status_history.started_at IS 'When this status was entered';
COMMENT ON COLUMN phase_status_history.finished_at IS 'When this status was exited (NULL if still active)';