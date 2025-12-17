# ===========================================
# KIDzAPP - Production Dockerfile
# ===========================================
# Multi-stage build for minimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend (Vite) and backend (esbuild)
# This creates:
# - dist/public/  (frontend assets)
# - dist/index.js (server bundle)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
# The build creates dist/index.js (server) and dist/public/ (frontend)
COPY --from=builder /app/dist ./dist

# Copy shared schema for Drizzle
COPY --from=builder /app/shared ./shared

# Copy drizzle config for migrations
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kidzapp -u 1001 -G nodejs

# Set ownership
RUN chown -R kidzapp:nodejs /app

USER kidzapp

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
