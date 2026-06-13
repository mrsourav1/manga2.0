FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 5001

CMD ["npm", "run", "start"]
