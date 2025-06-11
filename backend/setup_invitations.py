#!/usr/bin/env python3
"""
Setup script for the invitation system
Run this inside the Docker container to set up the invitation system
"""

import sys
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import subprocess

def get_db_connection():
    """Get database connection using container environment"""
    try:
        # Use DATABASE_URL directly - psycopg2 can parse it
        database_url = os.environ.get('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            # Fallback to individual environment variables
            conn = psycopg2.connect(
                host=os.environ.get('DB_HOST', 'database'),
                port=int(os.environ.get('DB_PORT', 5433)),
                database=os.environ.get('DB_NAME', 'runplanprod'),
                user=os.environ.get('DB_USER', 'runplan_user'),
                password=os.environ.get('DB_PASSWORD', 'runplan_secure_password_123')
            )
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return None

def run_sql_file(filepath):
    """Run a SQL file against the database"""
    print(f"🔧 Running SQL file: {filepath}")
    
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        # Read and execute the SQL file as one block
        # PostgreSQL functions with $$ syntax need to be executed together
        with open(filepath, 'r') as file:
            sql_content = file.read()
            
        # Execute the entire file content at once
        cursor.execute(sql_content)
                
        conn.close()
        print("✅ SQL file executed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error executing SQL file: {e}")
        return False

def check_existing_setup():
    """Check if invitation system is already set up"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        # Check if approved_emails table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'approved_emails'
            );
        """)
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else False
        
    except Exception as e:
        print(f"❌ Error checking existing setup: {e}")
        return False

def setup_admin_user_interactive():
    """Interactive setup for the first admin user"""
    print("\n🔑 Admin User Setup")
    print("=" * 30)
    
    admin_email = input("Enter your email address (this will become the admin): ")
    
    if not admin_email or "@" not in admin_email:
        print("❌ Invalid email address")
        return False
    
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if user already exists
        cursor.execute("SELECT id, email FROM users WHERE email = %s", (admin_email,))
        user = cursor.fetchone()
        
        if user:
            print(f"✅ Found existing user: {user['email']}")
            user_id = user['id']
            
            # Check if already admin
            cursor.execute("SELECT is_user_admin(%s)", (user_id,))
            is_admin = cursor.fetchone()[0]
            
            if is_admin:
                print(f"ℹ️  User {admin_email} is already an admin")
            else:
                # Make user admin
                cursor.execute("""
                    INSERT INTO admin_users (user_id, granted_by)
                    VALUES (%s, %s)
                """, (user_id, user_id))
                print(f"✅ {admin_email} is now an admin!")
                
        else:
            print(f"📧 User {admin_email} not found. Please register first, then re-run this setup.")
            
            # Add email to approved list
            cursor.execute("""
                INSERT INTO approved_emails (email, invited_by, notes)
                VALUES (%s, %s, %s)
                ON CONFLICT (email) DO NOTHING
            """, (admin_email, 'system', 'Initial admin user'))
            
            print(f"✅ {admin_email} has been pre-approved for registration")
            conn.close()
            return False
        
        # Update the approved emails to use this admin email
        cursor.execute("""
            UPDATE approved_emails 
            SET email = %s, invited_by = %s, notes = %s
            WHERE email = 'admin@example.com'
        """, (admin_email, 'system', 'Initial admin user'))
        
        # Deactivate example emails
        cursor.execute("""
            UPDATE approved_emails 
            SET is_active = FALSE 
            WHERE email IN ('user1@example.com', 'user2@example.com')
        """)
        
        conn.close()
        print(f"✅ Setup complete! {admin_email} is now the admin.")
        return True
        
    except Exception as e:
        print(f"❌ Error setting up admin user: {e}")
        return False

def show_usage_instructions():
    """Show how to use the invitation system"""
    print("\n📧 How to Manage Invitations:")
    print("=" * 40)
    print("Now that you're set up as an admin, you can use these API endpoints:")
    print()
    print("• View approved emails: GET /api/admin/approved-emails")
    print("• Approve new email: POST /api/admin/approve-email")
    print("  Body: {\"email\": \"user@example.com\", \"notes\": \"Optional notes\"}")
    print("• Revoke email: DELETE /api/admin/revoke-email/user@example.com")
    print("• View logs: GET /api/admin/invitation-logs")
    print()
    print("🔗 Test with curl:")
    print("curl -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\")
    print("     http://localhost:3000/api/admin/approved-emails")
    print()
    print("🎯 Next Steps:")
    print("• Create a React admin panel to manage invitations")
    print("• Only approved emails can register new accounts")
    print("• You control who gets access to your application!")
    print()

def main():
    print("🚀 Route Planner Invitation System Setup")
    print("=" * 50)
    
    # Check if already set up
    if check_existing_setup():
        print("ℹ️  Invitation system tables already exist.")
        choice = input("Do you want to set up admin user anyway? (y/n): ")
        if choice.lower() != 'y':
            print("Exiting...")
            sys.exit(0)
    else:
        # Set up database schema
        schema_file = "database_schema_invitations.sql"
        if not os.path.exists(schema_file):
            print(f"❌ Schema file {schema_file} not found")
            sys.exit(1)
            
        if not run_sql_file(schema_file):
            print("❌ Failed to set up database schema")
            sys.exit(1)
    
    # Set up admin user
    if setup_admin_user_interactive():
        show_usage_instructions()
        print("\n🎉 Invitation system setup complete!")
    else:
        print("\n⚠️  Please register your account first, then re-run this setup.")

if __name__ == "__main__":
    main() 