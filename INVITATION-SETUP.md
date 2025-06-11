# Invitation System Setup Guide

The Route Planner now includes an invitation-based registration system to control who can create accounts.

## Quick Setup

1. **Start the application:**
   ```bash
   docker compose up -d
   ```

2. **Run the setup script:**
   ```bash
   ./setup-invitations.sh
   ```
   
   Or manually:
   ```bash
   docker exec -it runplanprod-backend-1 python setup_invitations.py
   ```

3. **Follow the interactive prompts** to set up your admin user.

## How It Works

- **Controlled Registration**: Only pre-approved email addresses can register
- **Admin Management**: Admins can approve/revoke email addresses  
- **Audit Trail**: All invitation actions are logged
- **User Privacy**: Users still set their own passwords during registration

## Admin Operations

Once set up, you can manage invitations via API endpoints:

### View Approved Emails
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/approved-emails
```

### Approve New Email
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "notes": "Friend from work"}' \
     http://localhost:3000/api/admin/approve-email
```

### Revoke Email Access
```bash
curl -X DELETE \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/revoke-email/user@example.com
```

### View Audit Logs
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/invitation-logs
```

## What Gets Created

The setup process creates these database tables:

- **`approved_emails`**: Controls who can register
- **`admin_users`**: Manages admin privileges  
- **`invitation_logs`**: Audit trail of all actions

## Security Features

- JWT token required for all admin operations
- Only existing users can be granted admin privileges
- All invitation actions are logged with timestamps
- Email approval can be revoked at any time

## Next Steps

Consider building a React admin panel for easier invitation management instead of using curl commands. 