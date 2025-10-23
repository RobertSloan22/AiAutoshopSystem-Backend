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
    ttf-freefont \
    mongodb-tools \
    curl \
    wget

# Set environment variables for Puppeteer and MongoDB
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=5005

# Create app directory
WORKDIR /app

# Copy package files first for better caching
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

# Create necessary directories with proper permissions
RUN mkdir -p uploads logs temp && \
    chmod 755 uploads logs temp

# Expose the port the app runs on
EXPOSE 5005

# Use non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Enhanced health check with MongoDB connectivity test
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD node -e "\
    const http = require('http'); \
    const { MongoClient } = require('mongodb'); \
    \
    const checkHealth = async () => { \
      try { \
        // Check HTTP server \
        const httpPromise = new Promise((resolve, reject) => { \
          const req = http.get('http://localhost:5005/health', (res) => { \
            resolve(res.statusCode === 200); \
          }); \
          req.on('error', reject); \
          req.setTimeout(5000, () => reject(new Error('HTTP timeout'))); \
        }); \
        \
        // Check MongoDB connection \
        const mongoPromise = new Promise(async (resolve, reject) => { \
          try { \
            const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://admin:password123@mongodb:27017/autoshop?authSource=admin'); \
            await client.connect(); \
            await client.db().admin().ping(); \
            await client.close(); \
            resolve(true); \
          } catch (error) { \
            reject(error); \
          } \
        }); \
        \
        const [httpOk, mongoOk] = await Promise.all([httpPromise, mongoPromise]); \
        process.exit(httpOk && mongoOk ? 0 : 1); \
      } catch (error) { \
        console.error('Health check failed:', error.message); \
        process.exit(1); \
      } \
    }; \
    checkHealth();"

# Start the application
CMD ["node", "server.js"]
