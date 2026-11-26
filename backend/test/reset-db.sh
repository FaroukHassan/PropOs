#!/bin/sh
# Recreate a local test database with sample data: sh test/reset-db.sh
set -e
psql -q -h localhost -U postgres -c "drop database if exists propos" -c "create database propos"
psql -q -h localhost -U postgres -d propos -f prisma/migrations/0001_init/migration.sql >/dev/null
SEED_DEMO=1 SEED_PASSWORD=${SEED_PASSWORD:-testpass123} node prisma/seed.js
