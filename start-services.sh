#!/bin/bash

# Start all services for the all-in-one container

echo "Starting all services..."

# Create log directory and set permissions
mkdir -p /var/log/app
mkdir -p /var/lib/redis
chown redis:redis /var/lib/redis 2>/dev/null || true

# Start MongoDB
echo "Starting MongoDB..."
mongod --bind_ip_all --dbpath /data/db --logpath /var/log/app/mongodb.log --fork

# Wait for MongoDB to start
sleep 5

# Start Redis
echo "Starting Redis..."
redis-server --daemonize yes --bind 0.0.0.0 --port 6379 --logfile /var/log/app/redis.log --maxmemory 256mb --maxmemory-policy allkeys-lru

# Wait for Redis to start and verify it's running
sleep 3
redis-cli ping && echo "Redis is responding" || echo "Redis failed to respond"

# Start ChromaDB
echo "Starting ChromaDB..."
export CHROMA_SERVER_CORS_ALLOW_ORIGINS="*"
export CHROMA_SERVER_HOST="0.0.0.0"
export CHROMA_SERVER_PORT="8000"
nohup python3 -m chromadb.cli.cli run --host 0.0.0.0 --port 8000 --path /chroma/chroma > /var/log/app/chromadb.log 2>&1 &

# Wait for ChromaDB to start
sleep 5

# Initialize MongoDB with user if needed
echo "Initializing MongoDB..."
mongosh --eval "
try {
  db = db.getSiblingDB('automotivedb');
  db.createCollection('init');
  print('MongoDB initialized successfully');
} catch(e) {
  print('MongoDB initialization error: ' + e);
}
" > /var/log/app/mongo-init.log 2>&1 &

# Wait a bit more for all services to be ready
sleep 10

# Check if services are running
echo "Checking services status..."
pgrep mongod && echo "MongoDB is running" || echo "MongoDB failed to start"
pgrep redis-server && echo "Redis is running" || echo "Redis failed to start"
pgrep -f chromadb && echo "ChromaDB is running" || echo "ChromaDB failed to start"

# Test connections
echo "Testing service connections..."
mongosh --eval "db.runCommand('ping')" --quiet > /dev/null 2>&1 && echo "MongoDB connection: OK" || echo "MongoDB connection: FAILED"
redis-cli ping > /dev/null 2>&1 && echo "Redis connection: OK" || echo "Redis connection: FAILED"
curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1 && echo "ChromaDB connection: OK" || echo "ChromaDB connection: FAILED"

# Start the Node.js application
echo "Starting Node.js application..."
cd /app
exec node server.js