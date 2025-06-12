#!/usr/bin/env python3
"""
Setup script for the invitation system
Run this after you have your first user account to set up the invitation system
"""

import sys
import os
import subprocess

def run_sql_commands():
    """Run the invitation system SQL setup"""
    print("🔧 Setting up invitation system database tables...")
    
    try:
        # Run the invitation schema setup
        result = subprocess.run([
            "docker", "exec", "-i", "runplanprod-database-1", 
            "psql", "-U", "postgres", "-d", "route_planner"
        ], input=open("backend/database_schema_invitations.sql", "r").read(), 
           text=True, capture_output=True)
        
        if result.returncode == 0:
            print("✅ Database schema updated successfully!")
        else:
            print(f"❌ Database setup failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error running database setup: {e}")
        return False
    
    return True

def setup_admin_user():
    """Instructions for setting up the first admin user"""
    print("\n🔑 Admin User Setup Instructions:")
    print("=" * 50)
    print("1. First, register your admin account through the normal registration process")
    print("   (it will work because we added some example approved emails)")
    print()
    print("2. Then run this SQL command to make yourself an admin:")
    print("   (Replace 'your-email@example.com' with your actual email)")
    print()
    print("   docker exec -it runplanprod-database-1 psql -U postgres -d route_planner -c \\")
    print("   \"INSERT INTO admin_users (user_id, granted_by) \\")
    print("    SELECT id, id FROM users WHERE email = 'your-email@example.com';\"")
    print()
    print("3. Update the approved emails list:")
    print("   docker exec -it runplanprod-database-1 psql -U postgres -d route_planner -c \\")
    print("   \"UPDATE approved_emails SET email = 'your-email@example.com', \\")
    print("    invited_by = 'system' WHERE email = 'admin@example.com';\"")
    print()
    print("4. Remove the example test emails:")
    print("   docker exec -it runplanprod-database-1 psql -U postgres -d route_planner -c \\")
    print("   \"UPDATE approved_emails SET is_active = FALSE \\")
    print("    WHERE email IN ('user1@example.com', 'user2@example.com');\"")
    print()

def show_usage_instructions():
    """Show how to use the invitation system"""
    print("📧 How to Manage Invitations:")
    print("=" * 40)
    print("After you're set up as an admin, you can:")
    print()
    print("• View approved emails: GET /api/admin/approved-emails")
    print("• Approve new email: POST /api/admin/approve-email")
    print("  Body: {\"email\": \"user@example.com\", \"notes\": \"Optional notes\"}")
    print("• Revoke email: DELETE /api/admin/revoke-email/user@example.com")
    print("• View logs: GET /api/admin/invitation-logs")
    print()
    print("🎯 Frontend Integration:")
    print("You can create an admin panel in React to manage these invitations!")
    print()

def main():
    print("🚀 Route Planner Invitation System Setup")
    print("=" * 50)
    
    # Check if Docker is running
    try:
        result = subprocess.run(["docker", "ps"], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Docker is not running. Please start Docker first.")
            sys.exit(1)
    except FileNotFoundError:
        print("❌ Docker command not found. Please install Docker first.")
        sys.exit(1)
    
    # Check if the database container is running
    try:
        result = subprocess.run([
            "docker", "exec", "runplanprod-database-1", "pg_isready", "-U", "postgres"
        ], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Database container is not running or not ready.")
            print("   Please start the application with: docker compose up -d")
            sys.exit(1)
    except Exception:
        print("❌ Cannot connect to database container 'runplanprod-database-1'")
        print("   Please make sure the application is running: docker compose up -d")
        sys.exit(1)
    
    print("✅ Docker and database are running")
    
    # Set up database schema
    if not run_sql_commands():
        print("❌ Failed to set up database schema")
        sys.exit(1)
    
    # Show setup instructions
    setup_admin_user()
    show_usage_instructions()
    
    print("🎉 Invitation system setup complete!")
    print("   Now follow the admin setup instructions above.")

if __name__ == "__main__":
    main() 