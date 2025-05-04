FROM node:18-alpine

# Install git and other dependencies
RUN apk add --no-cache git wget

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install dependencies with production flag to reduce size
RUN npm install --only=production

# Copy application code
COPY --chown=appuser:appgroup . .

# Create uploads directory and set permissions
RUN mkdir -p uploads && chown -R appuser:appgroup uploads

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 5000

# Set proper environment values
ENV NODE_ENV=production \
    PORT=5000

# Healthcheck to verify app is running correctly
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Command to run the application
CMD ["node", "server.js"] 