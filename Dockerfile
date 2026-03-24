FROM node:22-slim AS build

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json turbo.json ./

# Copy package manifests
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/

RUN npm ci

# Copy source code
COPY packages/web/ ./packages/web/
COPY packages/server/ ./packages/server/

# Build web first (SPA static files), then server
RUN npx turbo build

# --- Production ---
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
RUN npm ci --omit=dev -w packages/server

# Copy server build output
COPY --from=build /app/packages/server/dist ./packages/server/dist

# Copy web build output (SPA static files)
COPY --from=build /app/packages/web/dist ./packages/web/dist

WORKDIR /app/packages/server

EXPOSE 3333

CMD ["node", "dist/server.js"]
