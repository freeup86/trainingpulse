-- Seed data for TrainingPulse
-- Insert initial teams, workflow templates, and default admin user

-- Insert default teams
INSERT INTO teams (name, description) VALUES
('Training Development', 'Core team responsible for course development and instructional design'),
('Content Review', 'Team responsible for reviewing and approving training content'),
('Management', 'Training managers and coordinators'),
('External SMEs', 'Subject matter experts and external contractors');

-- Insert default workflow template
INSERT INTO workflow_templates (name, description, is_active) VALUES
('Standard Course Development', 'Standard workflow for developing training courses with review and approval stages', true),
('Fast Track Development', 'Accelerated workflow for urgent training needs', true),
('Compliance Training', 'Specialized workflow for compliance-related training materials', true);

-- Insert workflow states for Standard Course Development template
INSERT INTO workflow_states (workflow_template_id, state_name, display_name, is_initial, is_final, state_config) VALUES
(1, 'planning', 'Planning & Design', true, false, '{"color": "#3B82F6", "icon": "planning"}'),
(1, 'content_development', 'Content Development', false, false, '{"color": "#F59E0B", "icon": "development"}'),
(1, 'sme_review', 'SME Review', false, false, '{"color": "#8B5CF6", "icon": "review"}'),
(1, 'instructional_review', 'Instructional Review', false, false, '{"color": "#06B6D4", "icon": "review"}'),
(1, 'final_approval', 'Final Approval', false, false, '{"color": "#10B981", "icon": "approval"}'),
(1, 'published', 'Published', false, true, '{"color": "#059669", "icon": "check"}'),
(1, 'on_hold', 'On Hold', false, false, '{"color": "#EF4444", "icon": "pause"}');

-- Insert workflow states for Fast Track Development template
INSERT INTO workflow_states (workflow_template_id, state_name, display_name, is_initial, is_final, state_config) VALUES
(2, 'planning', 'Planning', true, false, '{"color": "#3B82F6", "icon": "planning"}'),
(2, 'development', 'Development', false, false, '{"color": "#F59E0B", "icon": "development"}'),
(2, 'review', 'Review', false, false, '{"color": "#8B5CF6", "icon": "review"}'),
(2, 'published', 'Published', false, true, '{"color": "#059669", "icon": "check"}');

-- Insert workflow states for Compliance Training template
INSERT INTO workflow_states (workflow_template_id, state_name, display_name, is_initial, is_final, state_config) VALUES
(3, 'planning', 'Planning', true, false, '{"color": "#3B82F6", "icon": "planning"}'),
(3, 'content_development', 'Content Development', false, false, '{"color": "#F59E0B", "icon": "development"}'),
(3, 'legal_review', 'Legal Review', false, false, '{"color": "#DC2626", "icon": "legal"}'),
(3, 'compliance_review', 'Compliance Review', false, false, '{"color": "#7C2D12", "icon": "compliance"}'),
(3, 'final_approval', 'Final Approval', false, false, '{"color": "#10B981", "icon": "approval"}'),
(3, 'published', 'Published', false, true, '{"color": "#059669", "icon": "check"}');

-- Insert default admin user (password: AdminPass123!)
-- Note: In production, this should be changed immediately
INSERT INTO users (email, password, name, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone) VALUES
('admin@trainingpulse.com', '$2b$12$LHbk5.EZLDKUyGJtJE8HFu7v3hFQYzOqJKJ6H8.9KPgG8MR7KAWmm', 'System Administrator', 'admin', 3, true, 8.0, 
 ARRAY['administration', 'system_management'], 
 '{"email": true, "inApp": true, "digest": "daily"}',
 '{"theme": "light", "density": "comfortable"}',
 'UTC');

-- Insert sample manager user (password: ManagerPass123!)
INSERT INTO users (email, password, name, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone) VALUES
('manager@trainingpulse.com', '$2b$12$LHbk5.EZLDKUyGJtJE8HFu7v3hFQYzOqJKJ6H8.9KPgG8MR7KAWmm', 'Training Manager', 'manager', 3, true, 8.0,
 ARRAY['project_management', 'training_strategy'],
 '{"email": true, "inApp": true, "digest": "daily"}',
 '{"theme": "light", "density": "comfortable"}',
 'UTC');

-- Insert sample designer user (password: DesignerPass123!)
INSERT INTO users (email, password, name, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone) VALUES
('designer@trainingpulse.com', '$2b$12$LHbk5.EZLDKUyGJtJE8HFu7v3hFQYzOqJKJ6H8.9KPgG8MR7KAWmm', 'Instructional Designer', 'designer', 1, true, 8.0,
 ARRAY['instructional_design', 'content_development', 'elearning'],
 '{"email": true, "inApp": true, "digest": "daily"}',
 '{"theme": "light", "density": "comfortable"}',
 'UTC');

-- Insert sample reviewer user (password: ReviewerPass123!)
INSERT INTO users (email, password, name, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone) VALUES
('reviewer@trainingpulse.com', '$2b$12$LHbk5.EZLDKUyGJtJE8HFu7v3hFQYzOqJKJ6H8.9KPgG8MR7KAWmm', 'Content Reviewer', 'reviewer', 2, true, 6.0,
 ARRAY['content_review', 'quality_assurance'],
 '{"email": true, "inApp": true, "digest": "daily"}',
 '{"theme": "light", "density": "comfortable"}',
 'UTC');

-- Insert sample courses for demonstration
INSERT INTO courses (title, description, type, priority, status, start_date, due_date, estimated_hours, created_by, updated_by) VALUES
('New Employee Onboarding', 'Comprehensive onboarding program for new hires covering company policies, procedures, and culture', 'standard', 'high', 'in_progress', '2024-01-15', '2024-03-15', 40, 2, 2),
('Safety Training Refresher', 'Annual safety training update for all employees', 'compliance', 'critical', 'planning', '2024-02-01', '2024-02-28', 8, 2, 2),
('Leadership Development Program', 'Advanced leadership skills training for managers and senior staff', 'standard', 'medium', 'planning', '2024-03-01', '2024-05-30', 60, 2, 2),
('Customer Service Excellence', 'Training program focused on improving customer service skills and satisfaction', 'standard', 'medium', 'content_development', '2024-01-20', '2024-04-01', 24, 3, 3),
('Compliance Training Q1', 'Quarterly compliance training covering regulatory updates and requirements', 'compliance', 'high', 'legal_review', '2024-01-01', '2024-03-31', 12, 2, 2);

-- Insert course assignments
INSERT INTO course_assignments (course_id, user_id, role, assigned_by) VALUES
-- New Employee Onboarding assignments
(1, 3, 'designer', 2),
(1, 4, 'reviewer', 2),
(1, 2, 'owner', 1),

-- Safety Training Refresher assignments
(2, 3, 'designer', 2),
(2, 4, 'reviewer', 2),
(2, 2, 'owner', 1),

-- Leadership Development Program assignments
(3, 3, 'designer', 2),
(3, 4, 'reviewer', 2),
(3, 2, 'owner', 1),

-- Customer Service Excellence assignments
(4, 3, 'designer', 2),
(4, 4, 'reviewer', 2),

-- Compliance Training Q1 assignments
(5, 3, 'designer', 2),
(5, 4, 'reviewer', 2),
(5, 2, 'owner', 1);

-- Insert course subtasks for demonstration
INSERT INTO course_subtasks (course_id, title, status, is_blocking, weight, order_index) VALUES
-- New Employee Onboarding subtasks
(1, 'Define Learning Objectives', 'completed', true, 10, 1),
(1, 'Create Course Outline', 'completed', true, 10, 2),
(1, 'Develop Welcome Module', 'completed', false, 15, 3),
(1, 'Develop Company Policies Module', 'in_progress', false, 20, 4),
(1, 'Develop Benefits Overview', 'pending', false, 15, 5),
(1, 'Create Assessment Materials', 'pending', false, 15, 6),
(1, 'Review and Edit Content', 'pending', true, 15, 7),

-- Safety Training Refresher subtasks
(2, 'Review Previous Year Content', 'completed', true, 20, 1),
(2, 'Update Regulatory Requirements', 'in_progress', true, 30, 2),
(2, 'Create New Assessment Questions', 'pending', false, 25, 3),
(2, 'Review and Approve', 'pending', true, 25, 4);

-- Insert workflow instances
INSERT INTO workflow_instances (course_id, workflow_template_id, current_state, state_data) VALUES
(1, 1, 'content_development', '{"progress": 65, "reviewers": [4]}'),
(2, 1, 'planning', '{"progress": 30}'),
(3, 1, 'planning', '{"progress": 10}'),
(4, 1, 'content_development', '{"progress": 45}'),
(5, 3, 'legal_review', '{"progress": 75, "reviewers": [4]}');

-- Insert workflow transitions for tracking history
INSERT INTO workflow_transitions (workflow_instance_id, from_state, to_state, triggered_by, notes) VALUES
(1, NULL, 'planning', 2, 'Course initiated'),
(1, 'planning', 'content_development', 3, 'Planning phase completed, starting content development'),
(2, NULL, 'planning', 2, 'Safety training refresh initiated'),
(3, NULL, 'planning', 2, 'Leadership program initiated'),
(4, NULL, 'planning', 3, 'Customer service course initiated'),
(4, 'planning', 'content_development', 3, 'Started content development'),
(5, NULL, 'planning', 2, 'Compliance training initiated'),
(5, 'planning', 'content_development', 3, 'Content development started'),
(5, 'content_development', 'legal_review', 2, 'Content ready for legal review');

-- Insert some sample notifications
INSERT INTO notifications (user_id, type, priority, title, message, related_entity_type, related_entity_id, from_user_id, action_url) VALUES
(3, 'review_requested', 'high', 'Review Required: New Employee Onboarding', 'Your review is needed for the New Employee Onboarding course content.', 'course', 1, 2, '/courses/1/review'),
(4, 'course_overdue', 'urgent', 'Safety Training Refresher is overdue', 'The Safety Training Refresher course has passed its due date and needs immediate attention.', 'course', 2, NULL, '/courses/2'),
(2, 'workflow_transition', 'normal', 'Course moved to Legal Review', 'Compliance Training Q1 has been moved to legal review stage.', 'course', 5, 3, '/courses/5'),
(3, 'assignment_created', 'normal', 'New assignment: Leadership Development Program', 'You have been assigned as the designer for the Leadership Development Program.', 'course', 3, 2, '/courses/3');

-- Update calculated status and completion percentage for courses based on subtasks
UPDATE courses SET 
    calculated_status = 'in_progress',
    completion_percentage = 65
WHERE id = 1;

UPDATE courses SET 
    calculated_status = 'planning',
    completion_percentage = 30
WHERE id = 2;

UPDATE courses SET 
    calculated_status = 'planning',
    completion_percentage = 10
WHERE id = 3;

UPDATE courses SET 
    calculated_status = 'in_progress',
    completion_percentage = 45
WHERE id = 4;

UPDATE courses SET 
    calculated_status = 'review',
    completion_percentage = 75
WHERE id = 5;