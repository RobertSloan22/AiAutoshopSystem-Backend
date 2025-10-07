# Use Node.js 20 Alpine base image for smaller size
FROM node:20-alpine AS base

# Install Python and build dependencies (for native modules and Python scripts)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies with retry logic and increased timeouts
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm ci --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages || true

# Copy application source
COPY . .

# Create necessary directories
RUN mkdir -p uploads logs temp

# Expose the port the app runs on
EXPOSE 3001

# Use non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "server.js"]