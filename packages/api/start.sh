#!/bin/sh

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL is ready!"

# Run migrations
echo "Running database migrations..."
NODE_ENV=production npx knex migrate:latest --knexfile ./knexfile.js --migrations-directory ./dist/migrations

# Start the server
echo "Starting API server..."
node dist/index.js 