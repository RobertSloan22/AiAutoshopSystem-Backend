FROM node:20-alpine

WORKDIR /app

# Install dependencies for MCP SDK and Express
RUN npm install -g @modelcontextprotocol/sdk express axios

# Copy bridge script
COPY stdio-http-bridge.js ./stdio-http-bridge.js

# Make script executable
RUN chmod +x stdio-http-bridge.js

# Expose port (will be overridden by environment variable)
EXPOSE 3701

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3701) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start bridge
CMD ["node", "stdio-http-bridge.js"]

