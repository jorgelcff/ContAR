FROM node:22-slim

WORKDIR /app

COPY backend/ .

RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

EXPOSE 3001

CMD ["node", "server.js"]
