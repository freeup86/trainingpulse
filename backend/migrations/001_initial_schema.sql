-- TrainingPulse Database Schema
-- Initial migration: Core tables and relationships

-- Create teams table first (referenced by users)
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    active BOOLEAN DEFAULT true,
    daily_capacity_hours DECIMAL(3,1) DEFAULT 8.0,
    skills TEXT[] DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{}',
    ui_preferences JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'designer', 'reviewer', 'viewer'))
);

-- Create workflow_templates table (referenced by workflow_instances)
CREATE TABLE workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_states table
CREATE TABLE workflow_states (
    id SERIAL PRIMARY KEY,
    workflow_template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    state_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    is_initial BOOLEAN DEFAULT false,
    is_final BOOLEAN DEFAULT false,
    state_config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create courses table
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'standard',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    calculated_status VARCHAR(50),
    completion_percentage INTEGER DEFAULT 0,
    start_date DATE,
    due_date DATE,
    estimated_hours INTEGER,
    estimated_daily_hours DECIMAL(4,2),
    metadata JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_dates CHECK (start_date <= due_date)
);

-- Create course_assignments table
CREATE TABLE course_assignments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    
    CONSTRAINT valid_assignment_role CHECK (role IN ('owner', 'designer', 'reviewer', 'approver', 'sme')),
    CONSTRAINT unique_course_user_role UNIQUE(course_id, user_id, role)
);

-- Create course_subtasks table
CREATE TABLE course_subtasks (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_blocking BOOLEAN DEFAULT false,
    weight INTEGER DEFAULT 1,
    order_index INTEGER NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create course_dependencies table
CREATE TABLE course_dependencies (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    depends_on_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'blocks',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT no_self_dependency CHECK (course_id != depends_on_course_id),
    CONSTRAINT unique_dependency UNIQUE(course_id, depends_on_course_id)
);

-- Create course_attachments table
CREATE TABLE course_attachments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_instances table
CREATE TABLE workflow_instances (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    workflow_template_id INTEGER NOT NULL REFERENCES workflow_templates(id),
    current_state VARCHAR(100) NOT NULL,
    state_entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    state_data JSONB DEFAULT '{}',
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_transitions table
CREATE TABLE workflow_transitions (
    id SERIAL PRIMARY KEY,
    workflow_instance_id INTEGER NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    from_state VARCHAR(100),
    to_state VARCHAR(100) NOT NULL,
    triggered_by INTEGER REFERENCES users(id),
    transition_data JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50),
    related_entity_id INTEGER,
    from_user_id INTEGER REFERENCES users(id),
    action_url VARCHAR(500),
    action_data JSONB,
    read_at TIMESTAMP,
    sent_channels TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_notification_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_team ON users(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_users_active ON users(active) WHERE active = true;

CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_due_date ON courses(due_date);
CREATE INDEX idx_courses_type_priority ON courses(type, priority);
CREATE INDEX idx_courses_calculated_status ON courses(calculated_status) WHERE calculated_status IS NOT NULL;

CREATE INDEX idx_assignments_course ON course_assignments(course_id);
CREATE INDEX idx_assignments_user ON course_assignments(user_id);

CREATE INDEX idx_course_subtasks_course ON course_subtasks(course_id);
CREATE INDEX idx_course_subtasks_order ON course_subtasks(course_id, order_index);

CREATE INDEX idx_course_dependencies_course ON course_dependencies(course_id);
CREATE INDEX idx_course_dependencies_blocks ON course_dependencies(depends_on_course_id);

CREATE INDEX idx_course_attachments_course ON course_attachments(course_id);

CREATE INDEX idx_workflow_states_template ON workflow_states(workflow_template_id);
CREATE UNIQUE INDEX idx_workflow_states_unique ON workflow_states(workflow_template_id, state_name);

CREATE INDEX idx_workflow_instances_course ON workflow_instances(course_id);
CREATE INDEX idx_workflow_instances_state ON workflow_instances(current_state);
CREATE INDEX idx_workflow_instances_active ON workflow_instances(is_complete) WHERE is_complete = false;

CREATE INDEX idx_workflow_transitions_instance ON workflow_transitions(workflow_instance_id);
CREATE INDEX idx_workflow_transitions_chronological ON workflow_transitions(workflow_instance_id, created_at);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_related ON notifications(related_entity_type, related_entity_id);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_subtasks_updated_at BEFORE UPDATE ON course_subtasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create partial unique index for active workflows
CREATE UNIQUE INDEX idx_one_active_workflow_per_course 
    ON workflow_instances(course_id) 
    WHERE is_complete = false;