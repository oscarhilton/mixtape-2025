FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo

# Copy root package files
COPY package*.json ./
COPY turbo.json ./
COPY .npmrc ./

# Copy workspace package files
COPY apps/web/package*.json ./apps/web/
COPY packages/api/package*.json ./packages/api/
COPY packages/typescript-config/package*.json ./packages/typescript-config/

# Install dependencies
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS web
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy necessary files
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/web/server.js"]

# Production image for API
FROM base AS api
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/packages/api/package*.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/knexfile.js ./packages/api/knexfile.js
COPY --from=builder /app/packages/api/migrations ./packages/api/migrations
COPY --from=builder /app/packages/api/tsconfig.json ./packages/api/tsconfig.json

# Install production dependencies
WORKDIR /app/packages/api
RUN npm install --production
RUN npm install -g ts-node typescript

# Compile migrations
RUN npx tsc -p tsconfig.json

COPY packages/api/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
EXPOSE 3001

CMD ["./start.sh"]