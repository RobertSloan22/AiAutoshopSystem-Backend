#!/bin/sh

# Docker health check script for MCP servers
# This script checks if the MCP HTTP bridge is responding

PORT=${PORT:-3701}
HEALTH_URL="http://localhost:${PORT}/health"

# Check if the health endpoint responds
if wget --no-verbose --tries=1 --spider --timeout=5 "${HEALTH_URL}" 2>/dev/null; then
  exit 0
else
  # Try with curl as fallback
  if curl -f --max-time 5 "${HEALTH_URL}" >/dev/null 2>&1; then
    exit 0
  else
    exit 1
  fi
fi




