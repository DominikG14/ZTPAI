#!/bin/sh
set -e

echo "Applying database migrations..."
npx knex migrate:latest

echo "Starting server..."
exec "$@"
