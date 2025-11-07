# Use Ubuntu base image to support multiple services
FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies including databases
RUN apt-get update && apt-get install -y \
    # Node.js dependencies
    curl \
    wget \
    gnupg2 \
    software-properties-common \
    # Python and build tools
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    make \
    g++ \
    # Graphics libraries
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    libpng-dev \
    libfontconfig1-dev \
    # Chromium
    chromium-browser \
    # Databases and services
    mongodb \
    redis-server \
    # Process management
    supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean

# Set environment variables for Puppeteer and MongoDB
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=5005 \
    DOCKER_ENV=true \
    MONGODB_URI=mongodb://localhost:27017/automotivedb \
    MONGO_USERNAME=admin \
    MONGO_PASSWORD=password123 \
    JWT_SECRET=f9e0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6 \
    OPENAI_API_KEY=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 \
    PLATETOVIN_API_KEY=y54oVvax8IJa2W0d8OZSmbC1lUCh7Ny4 \
    VITE_SERPER_API_KEY=4fbab440f75895c906dc1156e68808561be2bb9d \
    GOOGLE_API_KEY=AIzaSyCK-sjz8LO-Ew2r58B_zJnnPvfF3GIs7PI \
    GOOGLE_CSE_ID=776aac6f8801448f8 \
    TAVILY_API_KEY=nlBslk1ib9QYLHOOhAGGSrmJwcCWf9dz \
    RAPID_API_KEY=7624da3beemshc1c601ca1294533p1eb29ejsn6de33431dd8a \
    RAPIDAPI_KEY=9e368ded71msh13e1a14a97158f4p1e96bejsn0dc9dd6a2ae4 \
    RAPIDAPI_HOST=apibroker-license-plate-search-v1.p.rapidapi.com \
    REDIS_PASSWORD= \
    REDIS_URL=redis://localhost:6379 \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    REDIS_DB=0 \
    CHROMA_URL=http://localhost:8000 \
    MCP_SERVER_URL=http://localhost:3700 \
    FRONTEND_URL=http://localhost:5173 \
    SUPABASE_URL=http://192.168.1.124:8000 \
    SUPABASE_SERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwfQ.TTkxbGZ-nC9ADT1JxHm-YuQwZRCWENxcYjO1yLUU4VQ \
    SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMH0.ewHWulAzVzqo-g9-4XjsLJF0TZX8YjDwE8BYsbWmPWU \
    PGVECTOR_CONNECTION_STRING=postgres://postgres:your_password@localhost:5432/postgres

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

# Install Python requirements and ChromaDB
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages || true \
    && pip3 install chromadb --break-system-packages

# Copy application source
COPY . .

# Create necessary directories for app and databases
RUN mkdir -p uploads logs temp \
    && mkdir -p /data/db \
    && mkdir -p /var/lib/redis \
    && mkdir -p /chroma/chroma \
    && mkdir -p /var/log/supervisor \
    && mkdir -p /etc/supervisor/conf.d \
    && chmod 755 uploads logs temp

# Expose ports for all services
EXPOSE 5005 3001 27017 6379 8000

# Set proper permissions for database directories
RUN chown -R mongodb:mongodb /data/db || true \
    && chown -R redis:redis /var/lib/redis || true

# Health check for the application
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:5005/health || exit 1

# Create and copy startup script
COPY start-services.sh /start-services.sh
RUN chmod +x /start-services.sh

# Start all services
CMD ["/start-services.sh"]
