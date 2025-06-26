-- Allow empty status for new phases
-- This enables phases to start without any status set

-- Drop the existing constraint
ALTER TABLE course_subtasks
DROP CONSTRAINT IF EXISTS valid_task_status;

-- Add new constraint that includes empty string
ALTER TABLE course_subtasks
ADD CONSTRAINT valid_task_status CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final'));

-- Update existing phases that might be affected (optional - you can skip this if you want to keep existing data)
-- UPDATE course_subtasks SET status = '' WHERE status = 'alpha_review' AND created_at > NOW() - INTERVAL '1 hour';