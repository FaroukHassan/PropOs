#!/bin/sh
# Recreate a local test database with sample data: sh test/reset-db.sh
set -e
psql -q -h localhost -U postgres -c "drop database if exists propos" -c "create database propos"
for m in prisma/migrations/*/migration.sql; do psql -q -h localhost -U postgres -d propos -v ON_ERROR_STOP=1 -f "$m" >/dev/null; done
SEED_DEMO=1 SEED_PASSWORD=${SEED_PASSWORD:-testpass123} node prisma/seed.js
