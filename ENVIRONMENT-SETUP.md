# Environment Variables Setup

## Overview

This application uses environment variables for configuration to ensure security and flexibility across different deployment environments. All sensitive configuration is managed through a `.env` file that is **never committed to version control**.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file** with your actual values (see sections below)

3. **Verify your setup:**
   ```bash
   docker compose config
   ```

## Required Environment Variables

### Database Configuration
```bash
POSTGRES_DB=runplanprod
POSTGRES_USER=runplan_user
POSTGRES_PASSWORD=your_secure_database_password_here
POSTGRES_HOST_AUTH_METHOD=trust
DATABASE_URL=postgresql://runplan_user:your_secure_database_password_here@database:5432/runplanprod
```

### Authentication & Security
```bash
# Generate a secure JWT secret key
JWT_SECRET_KEY=your-super-secure-jwt-secret-key-change-in-production
```

**To generate a secure JWT secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Email Configuration (Password Reset)
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@runplanprod.com
FROM_NAME=RunPlan Pro
FRONTEND_URL=http://localhost:3450
```

### PgAdmin Configuration
```bash
PGADMIN_DEFAULT_EMAIL=admin@runplanprod.com
PGADMIN_DEFAULT_PASSWORD=your_secure_pgadmin_password
PGADMIN_CONFIG_SERVER_MODE=False
PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=False
```

### Application Configuration
```bash
NODE_ENV=production
PYTHONPATH=/app
```

## Production Deployment Checklist

### Security
- [ ] Generate strong, unique passwords for all services
- [ ] Generate a cryptographically secure JWT secret key
- [ ] Use a professional email service (not Gmail) for production
- [ ] Set appropriate `FRONTEND_URL` for your domain
- [ ] Change default PgAdmin credentials

### Email Setup (Gmail Example)
If using Gmail for development/small deployments:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password:**
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Use the app password** as `SMTP_PASSWORD` (not your regular Gmail password)

### Professional Email Service
For production, consider using:
- **SendGrid**
- **AWS SES**
- **Mailgun**
- **Postmark**

### Environment-Specific Configurations

#### Development
```bash
FRONTEND_URL=http://localhost:3450
NODE_ENV=development
# Email can be left empty - will log to console
```

#### Staging
```bash
FRONTEND_URL=https://staging.yourdomain.com
NODE_ENV=production
# Use test email service
```

#### Production
```bash
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
# Use production email service
```

## Security Best Practices

1. **Never commit `.env` files** - they're already in `.gitignore`
2. **Use different passwords** for each environment
3. **Rotate secrets regularly** especially JWT keys
4. **Use environment-specific domains** for email links
5. **Monitor email usage** to detect potential abuse
6. **Use strong passwords** (minimum 16 characters, mixed case, numbers, symbols)

## Troubleshooting

### Common Issues

**Docker Compose says variables are not set:**
```bash
# Check if .env file exists
ls -la .env

# Validate docker-compose configuration
docker compose config
```

**Email not working:**
```bash
# Check backend logs for email service status
docker compose logs backend | grep -i email
```

**Database connection issues:**
```bash
# Verify database environment variables
docker compose exec backend env | grep -i postgres
```

### Testing Your Configuration

**Test database connection:**
```bash
docker compose exec backend python -c "
from database import get_db_connection
try:
    conn = get_db_connection()
    print('✅ Database connection successful')
    conn.close()
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"
```

**Test email configuration:**
```bash
docker compose exec backend python -c "
from email_service import email_service
if email_service.is_dev_mode:
    print('📧 Email service in development mode (logging only)')
else:
    print('📧 Email service configured for production')
"
```

## Files Modified

The following files have been updated to use environment variables:

- `docker-compose.yml` - Now uses `env_file: .env` and variable substitution
- `env.example` - Template for all required variables
- Backend services already use `os.getenv()` for configuration

## Next Steps

After setting up your `.env` file:

1. **Start the services:**
   ```bash
   docker compose up -d
   ```

2. **Verify all services are healthy:**
   ```bash
   docker compose ps
   ```

3. **Test the application** in your browser at the configured `FRONTEND_URL`

4. **Monitor logs** for any configuration issues:
   ```bash
   docker compose logs -f
   ``` 