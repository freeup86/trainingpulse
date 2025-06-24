-- Backfill Alpha Review history for existing phases that don't have any status history
-- This ensures all phases have an Alpha Review start date based on their creation date

INSERT INTO phase_status_history (subtask_id, status, started_at, created_at, updated_at)
SELECT 
    cs.id as subtask_id,
    'alpha_review' as status,
    cs.created_at as started_at,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM course_subtasks cs
WHERE NOT EXISTS (
    SELECT 1 FROM phase_status_history psh 
    WHERE psh.subtask_id = cs.id AND psh.status = 'alpha_review'
)
AND cs.created_at IS NOT NULL;

-- Add a comment for documentation
COMMENT ON TABLE phase_status_history IS 'Tracks start and finish dates for each status a phase goes through (Alpha, Beta, Final, etc.). Alpha Review is auto-created when phases are created.';