"""
Email Service Module

Handles sending emails for password reset and other notifications.
Supports both production SMTP and development logging.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from logging_config import get_logger

logger = get_logger(__name__)


class EmailService:
    """Handles email sending functionality."""
    
    def __init__(self):
        # Email configuration from environment variables
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_username)
        self.from_name = os.getenv("FROM_NAME", "RunPlan Pro")
        
        # Frontend URL for reset links
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3450")
        
        # Development mode (if no SMTP configured, just log emails)
        self.is_dev_mode = not (self.smtp_username and self.smtp_password)
        
        if self.is_dev_mode:
            logger.warning("Email service running in development mode - emails will be logged, not sent")
    
    def send_password_reset_email(self, email: str, username: str, reset_token: str) -> bool:
        """Send password reset email to user."""
        try:
            reset_url = f"{self.frontend_url}/reset-password?token={reset_token}"
            
            subject = "Password Reset Request - RunPlan Pro"
            
            # Create HTML email content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Password Reset</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 20px; background: #f8f9fa; }}
                    .button {{ display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ padding: 20px; text-align: center; color: #666; font-size: 14px; }}
                    .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>RunPlan Pro</h1>
                        <p>Password Reset Request</p>
                    </div>
                    
                    <div class="content">
                        <h2>Hello {username},</h2>
                        
                        <p>We received a request to reset your password for your RunPlan Pro account.</p>
                        
                        <p>If you requested this password reset, click the button below to create a new password:</p>
                        
                        <p style="text-align: center;">
                            <a href="{reset_url}" class="button">Reset Your Password</a>
                        </p>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 3px;">
                            {reset_url}
                        </p>
                        
                        <div class="warning">
                            <strong>Important:</strong>
                            <ul>
                                <li>This link will expire in 1 hour for security reasons</li>
                                <li>If you didn't request this reset, please ignore this email</li>
                                <li>Your password will remain unchanged until you use this link</li>
                            </ul>
                        </div>
                        
                        <p>If you continue to have problems, please contact our support team.</p>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent on {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}</p>
                        <p>RunPlan Pro - Your Ultimate Route Planning Companion</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text version for email clients that don't support HTML
            text_content = f"""
            RunPlan Pro - Password Reset Request
            
            Hello {username},
            
            We received a request to reset your password for your RunPlan Pro account.
            
            If you requested this password reset, visit the following link to create a new password:
            
            {reset_url}
            
            IMPORTANT:
            - This link will expire in 1 hour for security reasons
            - If you didn't request this reset, please ignore this email
            - Your password will remain unchanged until you use this link
            
            If you continue to have problems, please contact our support team.
            
            This email was sent on {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}
            
            RunPlan Pro - Your Ultimate Route Planning Companion
            """
            
            if self.is_dev_mode:
                # Development mode - just log the email
                logger.info(f"[DEV MODE] Password reset email for {email}:")
                logger.info(f"Subject: {subject}")
                logger.info(f"Reset URL: {reset_url}")
                logger.info(f"Content preview: Password reset email for user {username}")
                return True
            else:
                # Production mode - send actual email
                return self._send_email(email, subject, text_content, html_content)
                
        except Exception as e:
            logger.error(f"Error sending password reset email to {email}: {str(e)}")
            return False
    
    def _send_email(self, to_email: str, subject: str, text_content: str, html_content: str) -> bool:
        """Send email via SMTP."""
        try:
            # Create multipart message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email
            
            # Add both plain text and HTML versions
            text_part = MIMEText(text_content, "plain")
            html_part = MIMEText(html_content, "html")
            
            message.attach(text_part)
            message.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # Enable encryption
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(message)
            
            logger.info(f"Password reset email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False


# Global email service instance
email_service = EmailService() 