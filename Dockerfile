FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

# Rebuild sharp for linux/x64 (required for correct native binaries)
RUN npm rebuild sharp --platform=linux --arch=x64 || true

# ---

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---

FROM node:20-alpine AS production-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps --omit=dev

RUN npm rebuild sharp --platform=linux --arch=x64 || true

# ---

FROM node:20-alpine AS runner

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER nestjs

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
