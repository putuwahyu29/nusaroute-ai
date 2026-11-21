# Stage 1: Build TypeScript
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

# Stage 2: Hardened Production Runtime (non-root)
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist

# Drop root privileges for container security (CIS Docker Benchmark)
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
