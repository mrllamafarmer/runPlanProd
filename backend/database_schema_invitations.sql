-- Invitation System for Route Planning Application
-- This schema adds invitation-based registration control

-- Approved emails table - controls who can register
CREATE TABLE approved_emails (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    invited_by VARCHAR(100) NOT NULL, -- email of admin who approved this
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registered_at TIMESTAMP NULL, -- when they actually registered
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT, -- optional notes about the invitation
    invitation_token VARCHAR(255) UNIQUE, -- optional token for email invitations
    token_expires_at TIMESTAMP NULL
);

-- Admin users table - controls who can invite others
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER, -- user_id of admin who granted this
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Invitation logs for audit trail
CREATE TABLE invitation_logs (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'invited', 'registered', 'revoked', 'expired'
    performed_by INTEGER, -- user_id of admin who performed action
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- additional context
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_approved_emails_email ON approved_emails(email);
CREATE INDEX idx_approved_emails_active ON approved_emails(is_active);
CREATE INDEX idx_approved_emails_token ON approved_emails(invitation_token);
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);
CREATE INDEX idx_invitation_logs_email ON invitation_logs(email);
CREATE INDEX idx_invitation_logs_performed_at ON invitation_logs(performed_at);

-- Function to check if email is approved for registration
CREATE OR REPLACE FUNCTION is_email_approved(check_email VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
    approved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO approved_count
    FROM approved_emails 
    WHERE email = check_email 
    AND is_active = TRUE
    AND (token_expires_at IS NULL OR token_expires_at > CURRENT_TIMESTAMP);
    
    RETURN approved_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(check_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count
    FROM admin_users 
    WHERE user_id = check_user_id 
    AND is_active = TRUE;
    
    RETURN admin_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to log invitation actions
CREATE OR REPLACE FUNCTION log_invitation_action(
    action_email VARCHAR(100),
    action_type VARCHAR(50),
    admin_user_id INTEGER DEFAULT NULL,
    action_details TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO invitation_logs (email, action, performed_by, details)
    VALUES (action_email, action_type, admin_user_id, action_details);
END;
$$ LANGUAGE plpgsql;

-- Trigger to log when someone registers with an approved email
CREATE OR REPLACE FUNCTION log_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this email was approved
    IF is_email_approved(NEW.email) THEN
        -- Update the approved_emails table
        UPDATE approved_emails 
        SET registered_at = CURRENT_TIMESTAMP 
        WHERE email = NEW.email;
        
        -- Log the registration
        PERFORM log_invitation_action(NEW.email, 'registered', NULL, 'User completed registration');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_registration_log 
    AFTER INSERT ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION log_user_registration();

-- Insert initial admin user (you'll need to update this with your actual user ID after first registration)
-- This is commented out - you'll need to run this manually after creating your first user account
-- INSERT INTO admin_users (user_id, granted_by) 
-- SELECT id, id FROM users WHERE email = 'your-admin-email@example.com';

-- Example approved emails (remove these and add your own)
INSERT INTO approved_emails (email, invited_by, notes) VALUES 
('admin@example.com', 'system', 'Initial admin user'),
('user1@example.com', 'admin@example.com', 'Approved beta tester'),
('user2@example.com', 'admin@example.com', 'Approved beta tester'); 