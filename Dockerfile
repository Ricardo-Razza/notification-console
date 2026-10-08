FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY scripts/version.mjs ./scripts/version.mjs
ARG BUILD_REVISION=development
ENV BUILD_REVISION=${BUILD_REVISION}
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/notification-console/browser /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/version.json || exit 1
