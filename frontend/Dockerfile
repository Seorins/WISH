FROM node:24-alpine AS builder

WORKDIR /app

ARG APP_NAME
ARG VITE_APP_BASE_PATH=/
ARG VITE_API_BASE_URL=/api

ENV CI=true
ENV HUSKY=0
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN test -n "$APP_NAME"
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc tsconfig.base.json eslint.config.js ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@wish/${APP_NAME}" build
RUN mkdir -p /out && cp -R "apps/${APP_NAME}/dist/." /out/

FROM nginx:1.27-alpine AS runner

COPY --from=builder /out /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf && \
    printf '%s\n' \
      'server {' \
      '    listen 80;' \
      '    server_name _;' \
      '    root /usr/share/nginx/html;' \
      '    index index.html;' \
      '' \
      '    location / {' \
      '        try_files $uri $uri/ /index.html;' \
      '    }' \
      '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
