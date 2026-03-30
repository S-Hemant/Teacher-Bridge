FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
