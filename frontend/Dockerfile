# Build with Vite, serve the static bundle with nginx (final image has no Node).

# --- build ---
FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# relative /api paths, so no API URL to bake in — nginx proxies at runtime
COPY . .
RUN npm run build

# --- serve ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
