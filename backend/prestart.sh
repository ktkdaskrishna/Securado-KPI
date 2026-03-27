#!/bin/bash
# Pre-start script: Install Redis server if not present
if ! command -v redis-server &> /dev/null; then
    echo "Installing redis-server..."
    apt-get update -qq && apt-get install -y -qq redis-server 2>/dev/null || true
fi
echo "Redis server: $(which redis-server 2>/dev/null || echo 'not available')"
