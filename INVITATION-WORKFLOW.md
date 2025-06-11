# Complete User Invitation Workflow

## 1. Initial Setup (One Time Only)

Run the setup script to make yourself the first admin:

```bash
docker exec -it runplanprod-backend-1 python setup_invitations.py
```

Follow the prompts to enter your email address. This makes you the admin.

## 2. How to Invite New Users

### Option A: Using API Endpoints (Current Method)

**Step 1:** Get your JWT token by logging into the app
**Step 2:** Use the admin API to approve email addresses

```bash
# Approve someone for registration
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "friend@example.com", "notes": "My friend who wants to use the app"}' \
  http://localhost:3000/api/admin/approve-email
```

**Step 3:** Tell the person they can now register at your app with that email

### Option B: Future Admin Panel (Recommended)

We should build a React admin panel where you can:
- View all approved emails
- Add new approved emails with notes
- Revoke access
- View invitation logs
- Much easier than using curl commands!

## 3. What Happens When Someone Tries to Register

- ✅ **If their email is approved**: Registration works normally
- ❌ **If their email is NOT approved**: Registration fails with "Email not approved for registration"

## 4. Managing Existing Invitations

```bash
# View all approved emails
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/approved-emails

# Revoke someone's ability to register (won't affect existing users)
curl -X DELETE \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/revoke-email/someone@example.com

# View invitation audit logs
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/admin/invitation-logs
```

## 5. Quick Test

Let's test the system:

1. **Try registering with an unapproved email** → Should fail
2. **Approve an email via API** → Should succeed
3. **Try registering with that email** → Should work
4. **Check the logs** → Should show the approval action

## 6. Production Recommendations

### Build an Admin Panel
Create a React component like `AdminPanel.tsx` with:
```typescript
- EmailApprovalForm (add new emails)
- ApprovedEmailsList (view/revoke)
- InvitationLogs (audit trail)
- AdminUserManagement (grant admin to others)
```

### Email Integration
Add actual email sending:
```typescript
- Send invitation emails with registration links
- Include temporary tokens for one-time registration
- Email notifications when approved/revoked
```

### Bulk Operations
```typescript
- Import CSV of emails to approve
- Bulk approve/revoke operations
- Invitation expiry dates
```

This gives you complete control over who can access your application while maintaining user privacy (they still set their own passwords). 