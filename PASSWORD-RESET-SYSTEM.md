# Password Reset System Documentation

## Overview

The RunPlan Pro application now includes a comprehensive password reset system that allows users to securely reset their passwords via email. The system is designed with security best practices and supports both development and production environments.

## Architecture

### Backend Components

1. **Database Schema** (`backend/database_schema.sql`)
   - `password_reset_tokens` table for secure token storage
   - Indexes for performance optimization
   - Cleanup function for expired tokens

2. **Email Service** (`backend/email_service.py`)
   - Professional HTML/text email templates
   - SMTP configuration with environment variables
   - Development mode with console logging
   - Production mode with actual email delivery

3. **Authentication System** (`backend/auth.py`)
   - `request_password_reset()` - Generate and send reset tokens
   - `confirm_password_reset()` - Validate tokens and update passwords
   - `cleanup_expired_reset_tokens()` - Maintenance function

4. **API Endpoints** (`backend/main.py`)
   - `POST /api/auth/request-password-reset` - Request password reset
   - `POST /api/auth/confirm-password-reset` - Confirm password reset

### Frontend Components

1. **Password Reset Request Form** (`frontend/src/components/PasswordResetRequestForm.tsx`)
   - Clean UI for email input
   - Client-side validation
   - Success confirmation screen

2. **Password Reset Confirmation Form** (`frontend/src/components/PasswordResetConfirmForm.tsx`)
   - Secure password input with validation
   - Real-time password strength feedback
   - Token-based authentication

3. **Updated Login Form** (`frontend/src/components/LoginForm.tsx`)
   - Added "Forgot Password" link
   - Integrated with app state management

4. **App Integration** (`frontend/src/App.tsx`)
   - URL token parsing and handling
   - State management for password reset flow
   - Routing between different auth states

## Security Features

### Token Security
- **Cryptographically secure tokens** using `secrets.token_urlsafe(32)`
- **1-hour expiration** for all reset tokens
- **Single-use tokens** - marked as used after successful reset
- **Automatic cleanup** of expired tokens
- **Token deactivation** when new tokens are generated

### Email Security
- **No email enumeration** - always returns success regardless of email existence
- **Secure URL handling** - tokens removed from browser URL after processing
- **Professional email templates** with clear security warnings

### Password Security
- **Minimum 8 characters** password requirement
- **Real-time validation** with user feedback
- **Secure password hashing** using PBKDF2
- **Password confirmation** to prevent typos

## Configuration

### Environment Variables

For production deployment, configure these environment variables:

```bash
# Email Configuration (Required for production)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@runplanprod.com
FROM_NAME=RunPlan Pro

# Frontend URL (Required for reset links)
FRONTEND_URL=https://your-domain.com

# Database Configuration (Already configured)
DATABASE_URL=postgresql://runplan_user:password@database:5432/runplanprod
```

### Development Mode

When SMTP credentials are not provided, the system automatically runs in development mode:
- Reset emails are logged to the backend console
- Full email content including reset URLs are displayed
- No actual emails are sent
- Perfect for testing and development

## User Flow

### Password Reset Request
1. User clicks "Forgot Password" on login page
2. User enters their email address
3. System generates secure token and stores in database
4. System sends email with reset link (or logs in dev mode)
5. User receives confirmation message

### Password Reset Confirmation
1. User clicks reset link from email
2. System validates token and shows password reset form
3. User enters new password with real-time validation
4. System updates password and marks token as used
5. User is redirected to login with success message

## API Documentation

### Request Password Reset

```http
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email address exists in our system, you will receive a password reset link shortly."
}
```

### Confirm Password Reset

```http
POST /api/auth/confirm-password-reset
Content-Type: application/json

{
  "token": "secure-reset-token-from-email",
  "new_password": "newSecurePassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successful. You can now log in with your new password."
}
```

## Database Schema

### password_reset_tokens Table

```sql
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Indexes
- `idx_password_reset_tokens_user_id` - Fast user lookups
- `idx_password_reset_tokens_token` - Fast token validation
- `idx_password_reset_tokens_expires_at` - Efficient cleanup

## Maintenance

### Token Cleanup

The system includes an automatic cleanup function for expired tokens:

```python
# Manual cleanup (can be run via admin interface or cron job)
deleted_count = auth_manager.cleanup_expired_reset_tokens()
```

### Monitoring

Monitor these metrics in production:
- Password reset request frequency
- Token usage rates
- Failed reset attempts
- Email delivery success rates

## Testing

### Development Testing
1. Start the application: `docker compose up -d`
2. Navigate to login page: `http://localhost:3450`
3. Click "Forgot Password"
4. Enter any email address
5. Check backend logs for reset URL: `docker compose logs backend -f`
6. Copy the reset URL and test password reset flow

### Production Testing
1. Configure SMTP environment variables
2. Test with real email addresses
3. Verify email delivery and formatting
4. Test complete reset flow end-to-end

## Troubleshooting

### Common Issues

1. **Emails not sending in production**
   - Check SMTP credentials and server settings
   - Verify firewall/network access to SMTP server
   - Check backend logs for detailed error messages

2. **Reset links not working**
   - Verify FRONTEND_URL environment variable
   - Check token expiration (1 hour limit)
   - Ensure token hasn't been used already

3. **Database errors**
   - Verify password_reset_tokens table exists
   - Check database migration was applied
   - Verify foreign key constraints

### Logs

Check backend logs for detailed information:
```bash
docker compose logs backend -f
```

Look for log entries containing:
- "Password reset token generated"
- "Password reset completed successfully"
- "[DEV MODE] Password reset email"

## Future Enhancements

### Potential Improvements
- **Rate limiting** to prevent abuse
- **Custom email templates** with branding
- **Admin interface** for token management
- **Email delivery tracking** and metrics
- **Multi-language support** for emails
- **SMS-based reset** as alternative option

### Security Enhancements
- **CAPTCHA integration** for reset requests
- **IP-based rate limiting**
- **Audit logging** for all reset activities
- **Two-factor authentication** integration 