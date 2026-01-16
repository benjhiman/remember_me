# Multi-stage build for Remember Me API
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy packages
COPY packages ./packages

# Copy app
COPY apps/api ./apps/api

# Install pnpm
RUN npm install -g pnpm@latest

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build Prisma client
WORKDIR /app/packages/prisma
RUN pnpm prisma generate

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy packages (only what's needed for runtime)
COPY packages ./packages

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma client in runtime image
WORKDIR /app/packages/prisma
RUN pnpm prisma generate

WORKDIR /app/apps/api

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "dist/main.js"]
