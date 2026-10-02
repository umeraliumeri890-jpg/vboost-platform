# Multi-stage Dockerfile for VBoost Full-Stack Production
FROM node:18-alpine AS base
WORKDIR /app

# Backend dependencies
COPY package*.json ./
RUN npm ci --only=production

# Frontend dependencies & build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Final runner image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy root backend
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Copy built frontend
COPY --from=base /app/frontend/.next ./frontend/.next
COPY --from=base /app/frontend/node_modules ./frontend/node_modules
COPY --from=base /app/frontend/package*.json ./frontend/
COPY --from=base /app/frontend/public ./frontend/public

EXPOSE 5000
EXPOSE 3000

# Start backend by default (or run via docker-compose)
CMD ["node", "src/server.js"]
