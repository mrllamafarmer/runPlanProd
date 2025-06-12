"""
User Authentication and Authorization Module

Handles user registration, login, JWT token management, and session security.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from passlib.context import CryptContext
from passlib.hash import pbkdf2_sha256

from models import UserCreate, UserLogin, User, PasswordResetRequest, PasswordResetConfirm
from database import get_db_connection
from exceptions import AuthenticationError, ValidationError
from email_service import email_service
from logging_config import get_logger

logger = get_logger(__name__)

# Password hashing configuration
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days


class AuthManager:
    """Handles user authentication and authorization."""
    
    def __init__(self):
        self.secret_key = JWT_SECRET_KEY
        self.algorithm = JWT_ALGORITHM
        self.access_token_expire_hours = JWT_ACCESS_TOKEN_EXPIRE_HOURS
    
    def hash_password(self, password: str) -> str:
        """Hash a password using PBKDF2."""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, user_id: int, username: str) -> str:
        """Create a JWT access token for a user."""
        expire = datetime.now(timezone.utc) + timedelta(hours=self.access_token_expire_hours)
        
        payload = {
            "user_id": user_id,
            "username": username,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        
        logger.info(f"Created access token for user {username} (ID: {user_id})")
        return token
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Verify token type
            if payload.get("type") != "access":
                raise AuthenticationError("Invalid token type")
            
            # Check if token is expired
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, timezone.utc) < datetime.now(timezone.utc):
                raise AuthenticationError("Token has expired")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(f"Invalid token: {str(e)}")
    
    def register_user(self, user_data: UserCreate) -> Dict[str, Any]:
        """Register a new user."""
        try:
            # Import here to avoid circular import
            from invitation_manager import invitation_manager
            
            # Validate input
            if not user_data.username or len(user_data.username.strip()) < 3:
                raise ValidationError("Username must be at least 3 characters long")
            
            if not user_data.email or "@" not in user_data.email:
                raise ValidationError("Invalid email address")
            
            if not user_data.password or len(user_data.password) < 8:
                raise ValidationError("Password must be at least 8 characters long")
            
            # Check if email is approved for registration
            if not invitation_manager.is_email_approved(user_data.email.strip()):
                raise ValidationError("Registration is by invitation only. Your email address has not been approved for registration.")
            
            # Check if user already exists
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT id FROM users WHERE username = %s OR email = %s",
                (user_data.username.strip(), user_data.email.strip())
            )
            
            if cursor.fetchone():
                raise ValidationError("Username or email already exists")
            
            # Hash password and create user
            hashed_password = self.hash_password(user_data.password)
            
            cursor.execute("""
                INSERT INTO users (username, email, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (user_data.username.strip(), user_data.email.strip(), hashed_password))
            
            result = cursor.fetchone()
            user_id = result['id'] if result else None
            
            if not user_id:
                raise AuthenticationError("Failed to create user")
                
            conn.commit()
            conn.close()
            
            # Create access token
            access_token = self.create_access_token(user_id, user_data.username.strip())
            
            logger.info(f"User registered successfully: {user_data.username} (ID: {user_id})")
            
            return {
                "user_id": user_id,
                "username": user_data.username.strip(),
                "email": user_data.email.strip(),
                "access_token": access_token,
                "token_type": "bearer"
            }
            
        except (ValidationError, AuthenticationError):
            raise
        except Exception as e:
            logger.error(f"Error registering user {user_data.username}: {str(e)}")
            raise AuthenticationError("Failed to register user")
    
    def login_user(self, login_data: UserLogin) -> Dict[str, Any]:
        """Authenticate user login."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Find user by username or email
            cursor.execute("""
                SELECT id, username, email, password_hash, is_active
                FROM users 
                WHERE (username = %s OR email = %s) AND is_active = TRUE
            """, (login_data.username_or_email, login_data.username_or_email))
            
            user_row = cursor.fetchone()
            conn.close()
            
            if not user_row:
                raise AuthenticationError("Invalid username/email or password")
            
            user_id = user_row['id']
            username = user_row['username']
            email = user_row['email']
            password_hash = user_row['password_hash']
            is_active = user_row['is_active']
            
            # Verify password
            if not self.verify_password(login_data.password, password_hash):
                raise AuthenticationError("Invalid username/email or password")
            
            # Create access token
            access_token = self.create_access_token(user_id, username)
            
            logger.info(f"User logged in successfully: {username} (ID: {user_id})")
            
            return {
                "user_id": user_id,
                "username": username,
                "email": email,
                "access_token": access_token,
                "token_type": "bearer"
            }
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error during login for {login_data.username_or_email}: {str(e)}")
            raise AuthenticationError("Login failed")
    
    def get_current_user(self, token: str) -> User:
        """Get current user from JWT token."""
        try:
            payload = self.verify_token(token)
            user_id = payload.get("user_id")
            
            if not user_id:
                raise AuthenticationError("Invalid token payload")
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, username, email, created_at, is_active
                FROM users 
                WHERE id = %s AND is_active = TRUE
            """, (user_id,))
            
            user_row = cursor.fetchone()
            conn.close()
            
            if not user_row:
                raise AuthenticationError("User not found or inactive")
            
            user_id = user_row['id']
            username = user_row['username']
            email = user_row['email']
            created_at = user_row['created_at']
            is_active = user_row['is_active']
            
            return User(
                id=user_id,
                username=username,
                email=email,
                created_at=created_at.isoformat() if created_at else None,
                is_active=is_active
            )
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            raise AuthenticationError("Failed to authenticate user")
    
    def validate_route_access(self, user_id: int, route_id: int) -> bool:
        """Check if user has access to a specific route."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT user_id, is_public 
                FROM routes 
                WHERE id = %s
            """, (route_id,))
            
            route_row = cursor.fetchone()
            conn.close()
            
            if not route_row:
                return False
            
            route_user_id = route_row['user_id']
            is_public = route_row['is_public']
            
            # User owns the route or route is public
            return route_user_id == user_id or is_public
            
        except Exception as e:
            logger.error(f"Error validating route access for user {user_id}, route {route_id}: {str(e)}")
            return False
    
    def change_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        """Change user password."""
        try:
            if len(new_password) < 8:
                raise ValidationError("New password must be at least 8 characters long")
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get current password hash
            cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            
            if not row:
                raise AuthenticationError("User not found")
            
            current_hash = row['password_hash']
            
            # Verify current password
            if not self.verify_password(current_password, current_hash):
                raise AuthenticationError("Current password is incorrect")
            
            # Update password
            new_hash = self.hash_password(new_password)
            cursor.execute(
                "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (new_hash, user_id)
            )
            
            conn.commit()
            conn.close()
            
            logger.info(f"Password changed successfully for user ID: {user_id}")
            return True
            
        except (ValidationError, AuthenticationError):
            raise
        except Exception as e:
            logger.error(f"Error changing password for user {user_id}: {str(e)}")
            raise AuthenticationError("Failed to change password")
    
    def request_password_reset(self, email: str) -> bool:
        """Generate and send password reset token."""
        try:
            # Validate email format
            if not email or "@" not in email:
                raise ValidationError("Invalid email address")
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Find user by email
            cursor.execute(
                "SELECT id, username, email, is_active FROM users WHERE email = %s AND is_active = TRUE",
                (email.strip(),)
            )
            
            user_row = cursor.fetchone()
            
            if not user_row:
                # For security, don't reveal if email exists or not
                # Just log and return success
                logger.info(f"Password reset requested for non-existent email: {email}")
                return True
            
            user_id = user_row['id']
            username = user_row['username']
            user_email = user_row['email']
            
            # Generate secure reset token
            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)  # 1 hour expiry
            
            # Deactivate any existing reset tokens for this user
            cursor.execute(
                "UPDATE password_reset_tokens SET is_active = FALSE WHERE user_id = %s AND is_active = TRUE",
                (user_id,)
            )
            
            # Insert new reset token
            cursor.execute("""
                INSERT INTO password_reset_tokens (user_id, token, expires_at)
                VALUES (%s, %s, %s)
            """, (user_id, reset_token, expires_at))
            
            conn.commit()
            conn.close()
            
            # Send password reset email
            email_sent = email_service.send_password_reset_email(user_email, username, reset_token)
            
            if email_sent:
                logger.info(f"Password reset token generated and email sent for user: {username} (ID: {user_id})")
            else:
                logger.error(f"Password reset token generated but email failed for user: {username} (ID: {user_id})")
            
            return True  # Always return True for security (don't reveal if email exists)
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error during password reset request for {email}: {str(e)}")
            # For security, still return True
            return True
    
    def confirm_password_reset(self, token: str, new_password: str) -> bool:
        """Reset password using valid token."""
        try:
            # Validate new password
            if not new_password or len(new_password) < 8:
                raise ValidationError("New password must be at least 8 characters long")
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Find valid, unused token
            cursor.execute("""
                SELECT rt.id, rt.user_id, rt.expires_at, u.username, u.email
                FROM password_reset_tokens rt
                JOIN users u ON rt.user_id = u.id
                WHERE rt.token = %s 
                  AND rt.is_active = TRUE 
                  AND rt.used_at IS NULL 
                  AND rt.expires_at > %s
                  AND u.is_active = TRUE
            """, (token, datetime.now(timezone.utc)))
            
            token_row = cursor.fetchone()
            
            if not token_row:
                raise AuthenticationError("Invalid or expired reset token")
            
            token_id = token_row['id']
            user_id = token_row['user_id']
            username = token_row['username']
            
            # Hash new password
            new_password_hash = self.hash_password(new_password)
            
            # Update user's password
            cursor.execute("""
                UPDATE users 
                SET password_hash = %s, updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
            """, (new_password_hash, user_id))
            
            # Mark token as used
            cursor.execute("""
                UPDATE password_reset_tokens 
                SET used_at = CURRENT_TIMESTAMP, is_active = FALSE 
                WHERE id = %s
            """, (token_id,))
            
            # Deactivate all other reset tokens for this user
            cursor.execute("""
                UPDATE password_reset_tokens 
                SET is_active = FALSE 
                WHERE user_id = %s AND id != %s
            """, (user_id, token_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Password reset completed successfully for user: {username} (ID: {user_id})")
            return True
            
        except (ValidationError, AuthenticationError):
            raise
        except Exception as e:
            logger.error(f"Error during password reset confirmation: {str(e)}")
            raise AuthenticationError("Password reset failed")
    
    def cleanup_expired_reset_tokens(self) -> int:
        """Clean up expired password reset tokens (for maintenance)."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Use the database function we created
            cursor.execute("SELECT cleanup_expired_password_reset_tokens()")
            result = cursor.fetchone()
            deleted_count = result[0] if result else 0
            
            conn.close()
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired password reset tokens")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired reset tokens: {str(e)}")
            return 0


# Global auth manager instance
auth_manager = AuthManager() 