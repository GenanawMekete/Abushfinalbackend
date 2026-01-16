# Multi-stage Docker build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads

# ========================================

FROM node:18-alpine AS production

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy built dependencies and source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/admin ./admin
COPY --from=builder /app/ecosystem.config.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S geeze -u 1001 && \
    chown -R geeze:nodejs /app

# Switch to non-root user
USER geeze

# Create directories with proper permissions
RUN mkdir -p logs uploads && \
    chown -R geeze:nodejs /app/logs /app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error()})"

# Start application with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
