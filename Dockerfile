# ── Stage 1 : build frontend ──────────────────────────────────────────────
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2 : build backend ───────────────────────────────────────────────
FROM node:20-alpine AS build-backend
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── Stage 3 : runtime ─────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

RUN apk add --no-cache openssl

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY --from=build-backend /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/prisma ./backend/prisma

# Frontend (servi par le backend)
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

EXPOSE 10000
CMD ["node", "backend/dist/server.js"]
