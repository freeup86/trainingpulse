-- Migration: Add missing permissions for the new permission system
-- This ensures all the permissions referenced in the code exist in the database

-- Insert missing permissions if they don't exist
INSERT INTO permissions (name, display_name, description, category) VALUES
-- Admin permissions
('admin.override', 'Admin Override', 'Bypass ownership and team restrictions', 'admin'),
('admin.settings.manage', 'Manage Settings', 'Access and modify system settings', 'admin'),

-- Course permissions  
('courses.view', 'View Courses', 'View course information and listings', 'courses'),
('courses.create', 'Create Courses', 'Create new courses', 'courses'),
('courses.update', 'Update Courses', 'Edit existing courses', 'courses'),
('courses.delete', 'Delete Courses', 'Remove courses from the system', 'courses'),
('courses.manage', 'Manage Courses', 'Full course management capabilities', 'courses'),

-- User permissions
('users.view', 'View Users', 'View user information and listings', 'users'),
('users.create', 'Create Users', 'Add new users to the system', 'users'),
('users.update', 'Update Users', 'Edit existing user accounts', 'users'),
('users.delete', 'Delete Users', 'Remove or deactivate user accounts', 'users'),

-- Team permissions
('teams.view', 'View Teams', 'View team information and listings', 'teams'),
('teams.create', 'Create Teams', 'Create new teams', 'teams'),
('teams.update', 'Update Teams', 'Edit existing teams', 'teams'),
('teams.delete', 'Delete Teams', 'Remove teams from the system', 'teams'),

-- Workflow permissions
('workflows.view', 'View Workflows', 'View workflow templates and instances', 'workflows'),
('workflows.create', 'Create Workflows', 'Create new workflow templates', 'workflows'),
('workflows.update', 'Update Workflows', 'Edit existing workflows', 'workflows'),
('workflows.delete', 'Delete Workflows', 'Remove workflow templates', 'workflows'),
('workflows.manage', 'Manage Workflows', 'Full workflow management capabilities', 'workflows'),

-- Analytics permissions
('analytics.view', 'View Analytics', 'Access analytics and reporting features', 'analytics'),

-- Notification permissions
('notifications.view', 'View Notifications', 'Access notification features', 'notifications'),
('notifications.manage', 'Manage Notifications', 'Configure and manage notifications', 'notifications'),

-- Bulk operations permissions
('bulk.execute', 'Execute Bulk Operations', 'Perform bulk operations on data', 'bulk')

ON CONFLICT (name) DO NOTHING;

-- Update admin role to have all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update manager role with appropriate permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager' 
AND p.name IN (
    'courses.view', 'courses.create', 'courses.update', 'courses.manage',
    'users.view', 'teams.view', 'teams.create', 'teams.update',
    'workflows.view', 'workflows.create', 'workflows.update', 'workflows.manage',
    'analytics.view', 'notifications.view', 'notifications.manage',
    'bulk.execute'
)
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update designer role with appropriate permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'designer' 
AND p.name IN (
    'courses.view', 'courses.create', 'courses.update',
    'workflows.view', 'notifications.view'
)
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update reviewer role with appropriate permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'reviewer' 
AND p.name IN (
    'courses.view', 'courses.update',
    'workflows.view', 'analytics.view', 'notifications.view'
)
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update sme role with appropriate permissions  
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sme' 
AND p.name IN (
    'courses.view', 'courses.update',
    'notifications.view'
)
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update instructor role with appropriate permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'instructor' 
AND p.name IN (
    'courses.view', 'notifications.view'
)
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;