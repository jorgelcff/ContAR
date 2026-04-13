FROM node:22-alpine

WORKDIR /app

COPY . .

RUN if [ ! -f package.json ] && [ -f backend/package.json ]; then cp -R backend/. /app/; fi
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

EXPOSE 3001

CMD ["node", "server.js"]
