FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN rm -f /root/.npmrc /home/*/.npmrc ~/.npmrc && \
    npm config set registry https://registry.npmjs.org/ && \
    npm ci --omit=dev
COPY . .
CMD ["node", "bot.js"]
