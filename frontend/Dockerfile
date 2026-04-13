FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_AVATURN_DIRECT_URL
ARG VITE_AVATURN_SUBDOMAIN
ARG VITE_AVATURN_DISABLE_BACKEND_FALLBACK
ARG VITE_AVATURN_USER_ID

ENV VITE_AVATURN_DIRECT_URL=${VITE_AVATURN_DIRECT_URL}
ENV VITE_AVATURN_SUBDOMAIN=${VITE_AVATURN_SUBDOMAIN}
ENV VITE_AVATURN_DISABLE_BACKEND_FALLBACK=${VITE_AVATURN_DISABLE_BACKEND_FALLBACK}
ENV VITE_AVATURN_USER_ID=${VITE_AVATURN_USER_ID}

COPY . .
RUN if [ ! -f package.json ] && [ -f frontend/package.json ]; then cp -R frontend/. /app/; fi
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY --from=build /app/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENV API_ORIGIN=https://avaturn-threejs.onrender.com

CMD ["sh", "-c", "envsubst '$API_ORIGIN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
