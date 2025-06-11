#!/bin/bash
# Simple script to run the invitation setup inside the Docker container

echo "🚀 Setting up invitation system..."
echo "This will run the setup script inside the backend container."
echo

# Check if containers are running
if ! docker ps | grep -q "runplanprod-backend-1"; then
    echo "❌ Backend container is not running."
    echo "   Please start the application first: docker compose up -d"
    exit 1
fi

echo "✅ Backend container is running"
echo "🔧 Executing setup script in container..."
echo

# Run the setup script inside the container
docker exec -it runplanprod-backend-1 python setup_invitations.py

echo
echo "🎉 Setup complete! You can now control registration via invitations." 