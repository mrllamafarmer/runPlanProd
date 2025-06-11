"""
Invitation Management System for Route Planning Application
Handles approved emails, admin users, and invitation controls
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from database import get_db_connection
from auth import AuthenticationError

logger = logging.getLogger(__name__)

@dataclass
class ApprovedEmail:
    id: int
    email: str
    invited_by: str
    invited_at: datetime
    registered_at: Optional[datetime]
    is_active: bool
    notes: Optional[str]
    invitation_token: Optional[str]
    token_expires_at: Optional[datetime]

@dataclass
class InvitationLog:
    id: int
    email: str
    action: str
    performed_by: Optional[int]
    performed_at: datetime
    details: Optional[str]

class InvitationManager:
    """Manages email invitations and user approvals"""
    
    def __init__(self):
        self.token_length = 32
        self.default_token_expiry_days = 7
    
    def generate_invitation_token(self) -> str:
        """Generate a secure random invitation token"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(self.token_length))
    
    def is_email_approved(self, email: str) -> bool:
        """Check if an email is approved for registration"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT is_email_approved(%s)
            """, (email,))
            
            result = cursor.fetchone()
            conn.close()
            
            return result[0] if result else False
            
        except Exception as e:
            logger.error(f"Error checking email approval for {email}: {str(e)}")
            return False
    
    def is_user_admin(self, user_id: int) -> bool:
        """Check if a user is an admin"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT is_user_admin(%s)
            """, (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            return result[0] if result else False
            
        except Exception as e:
            logger.error(f"Error checking admin status for user {user_id}: {str(e)}")
            return False
    
    def add_approved_email(self, email: str, invited_by_email: str, notes: str = None, 
                          generate_token: bool = False, admin_user_id: int = None) -> Dict[str, Any]:
        """Add an email to the approved list"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Generate token if requested
            invitation_token = None
            token_expires_at = None
            if generate_token:
                invitation_token = self.generate_invitation_token()
                token_expires_at = datetime.now() + timedelta(days=self.default_token_expiry_days)
            
            # Insert approved email
            cursor.execute("""
                INSERT INTO approved_emails 
                (email, invited_by, notes, invitation_token, token_expires_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, invited_at
            """, (email, invited_by_email, notes, invitation_token, token_expires_at))
            
            result = cursor.fetchone()
            approval_id = result['id']
            invited_at = result['invited_at']
            
            # Log the action
            cursor.execute("""
                SELECT log_invitation_action(%s, %s, %s, %s)
            """, (email, 'invited', admin_user_id, f"Added to approved list. Notes: {notes or 'None'}"))
            
            conn.commit()
            conn.close()
            
            response_data = {
                "id": approval_id,
                "email": email,
                "invited_by": invited_by_email,
                "invited_at": invited_at.isoformat(),
                "notes": notes,
                "message": f"Email {email} added to approved list"
            }
            
            if invitation_token:
                response_data["invitation_token"] = invitation_token
                response_data["token_expires_at"] = token_expires_at.isoformat()
            
            return response_data
            
        except Exception as e:
            logger.error(f"Error adding approved email {email}: {str(e)}")
            raise AuthenticationError(f"Failed to add approved email: {str(e)}")
    
    def remove_approved_email(self, email: str, admin_user_id: int = None) -> Dict[str, str]:
        """Remove an email from the approved list"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Deactivate the email instead of deleting (for audit trail)
            cursor.execute("""
                UPDATE approved_emails 
                SET is_active = FALSE 
                WHERE email = %s AND is_active = TRUE
                RETURNING id
            """, (email,))
            
            result = cursor.fetchone()
            if not result:
                raise AuthenticationError(f"Email {email} not found in approved list")
            
            # Log the action
            cursor.execute("""
                SELECT log_invitation_action(%s, %s, %s, %s)
            """, (email, 'revoked', admin_user_id, "Removed from approved list"))
            
            conn.commit()
            conn.close()
            
            return {"message": f"Email {email} removed from approved list"}
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error removing approved email {email}: {str(e)}")
            raise AuthenticationError(f"Failed to remove approved email: {str(e)}")
    
    def get_approved_emails(self, include_inactive: bool = False) -> List[ApprovedEmail]:
        """Get list of approved emails"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            query = """
                SELECT id, email, invited_by, invited_at, registered_at, 
                       is_active, notes, invitation_token, token_expires_at
                FROM approved_emails
            """
            
            if not include_inactive:
                query += " WHERE is_active = TRUE"
            
            query += " ORDER BY invited_at DESC"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            conn.close()
            
            return [
                ApprovedEmail(
                    id=row['id'],
                    email=row['email'],
                    invited_by=row['invited_by'],
                    invited_at=row['invited_at'],
                    registered_at=row['registered_at'],
                    is_active=row['is_active'],
                    notes=row['notes'],
                    invitation_token=row['invitation_token'],
                    token_expires_at=row['token_expires_at']
                )
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting approved emails: {str(e)}")
            return []
    
    def make_user_admin(self, user_id: int, granted_by_user_id: int) -> Dict[str, str]:
        """Grant admin privileges to a user"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check if user exists
            cursor.execute("""
                SELECT id, email FROM users WHERE id = %s AND is_active = TRUE
            """, (user_id,))
            
            user = cursor.fetchone()
            if not user:
                raise AuthenticationError(f"User with ID {user_id} not found")
            
            # Check if already admin
            if self.is_user_admin(user_id):
                raise AuthenticationError(f"User {user['email']} is already an admin")
            
            # Grant admin privileges
            cursor.execute("""
                INSERT INTO admin_users (user_id, granted_by)
                VALUES (%s, %s)
                RETURNING id
            """, (user_id, granted_by_user_id))
            
            admin_id = cursor.fetchone()['id']
            
            # Log the action
            cursor.execute("""
                SELECT log_invitation_action(%s, %s, %s, %s)
            """, (user['email'], 'admin_granted', granted_by_user_id, f"User granted admin privileges"))
            
            conn.commit()
            conn.close()
            
            return {"message": f"Admin privileges granted to {user['email']}"}
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error granting admin privileges to user {user_id}: {str(e)}")
            raise AuthenticationError(f"Failed to grant admin privileges: {str(e)}")
    
    def revoke_admin(self, user_id: int, revoked_by_user_id: int) -> Dict[str, str]:
        """Revoke admin privileges from a user"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get user info
            cursor.execute("""
                SELECT email FROM users WHERE id = %s
            """, (user_id,))
            
            user = cursor.fetchone()
            if not user:
                raise AuthenticationError(f"User with ID {user_id} not found")
            
            # Revoke admin privileges
            cursor.execute("""
                UPDATE admin_users 
                SET is_active = FALSE 
                WHERE user_id = %s AND is_active = TRUE
                RETURNING id
            """, (user_id,))
            
            result = cursor.fetchone()
            if not result:
                raise AuthenticationError(f"User {user['email']} is not an admin")
            
            # Log the action
            cursor.execute("""
                SELECT log_invitation_action(%s, %s, %s, %s)
            """, (user['email'], 'admin_revoked', revoked_by_user_id, "Admin privileges revoked"))
            
            conn.commit()
            conn.close()
            
            return {"message": f"Admin privileges revoked from {user['email']}"}
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error revoking admin privileges from user {user_id}: {str(e)}")
            raise AuthenticationError(f"Failed to revoke admin privileges: {str(e)}")
    
    def get_invitation_logs(self, email: str = None, limit: int = 100) -> List[InvitationLog]:
        """Get invitation action logs"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            query = """
                SELECT il.id, il.email, il.action, il.performed_by, 
                       il.performed_at, il.details, u.username as performed_by_username
                FROM invitation_logs il
                LEFT JOIN users u ON il.performed_by = u.id
            """
            
            params = []
            if email:
                query += " WHERE il.email = %s"
                params.append(email)
            
            query += " ORDER BY il.performed_at DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            
            return [
                InvitationLog(
                    id=row['id'],
                    email=row['email'],
                    action=row['action'],
                    performed_by=row['performed_by'],
                    performed_at=row['performed_at'],
                    details=row['details']
                )
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting invitation logs: {str(e)}")
            return []

# Create global invitation manager instance
invitation_manager = InvitationManager() 