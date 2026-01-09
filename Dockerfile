# ===========================================
# KIDzAPP - Production Dockerfile
# ===========================================
# Multi-stage build for minimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend (Vite) and backend (esbuild)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install all dependencies (some are needed at runtime for drizzle)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy shared schema for Drizzle ORM
COPY --from=builder /app/shared ./shared

# Copy Drizzle config and TypeScript config for migrations
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kidzapp -u 1001 -G nodejs && \
    chown -R kidzapp:nodejs /app

USER kidzapp

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1
    
CMD ["node", "dist/index.js"]
