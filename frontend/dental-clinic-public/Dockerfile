# syntax=docker/dockerfile:1
FROM node:24.15-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund
COPY . .
RUN --mount=type=cache,target=/app/.angular/cache \
    npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/dental-clinic-public/browser /usr/share/nginx/html
EXPOSE 80
