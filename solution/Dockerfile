FROM node:20.11.0-alpine3.18 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY ./ ./

CMD ["node", "/app/server.js"]
