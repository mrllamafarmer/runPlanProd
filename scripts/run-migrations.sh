#!/bin/bash

# Database Migration Runner
# Usage: ./scripts/run-migrations.sh

set -e

echo "🔄 Running database migrations..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose first."
    exit 1
fi

# Check if database container is running
if ! docker-compose ps database | grep -q "Up"; then
    echo "❌ Database container is not running. Please start it first:"
    echo "   docker-compose up -d database"
    exit 1
fi

# Run migrations
MIGRATION_DIR="backend/database/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo "❌ Migration directory not found: $MIGRATION_DIR"
    exit 1
fi

echo "📁 Looking for migrations in: $MIGRATION_DIR"

# Find and run migration files in order
for migration_file in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        echo "🔧 Running migration: $(basename "$migration_file")"
        docker-compose exec -T database psql -U runplan_user -d runplanprod -f "/dev/stdin" < "$migration_file"
        echo "✅ Migration completed: $(basename "$migration_file")"
    fi
done

echo "🎉 All migrations completed successfully!" 