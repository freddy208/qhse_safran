# ── Stage 1 : build ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2 : serve statique avec Caddy ───────────────────────────────────
FROM caddy:2-alpine AS runtime

COPY --from=builder /app/dist /srv
COPY Caddyfile.local /etc/caddy/Caddyfile

EXPOSE 80
