FROM node:22-slim

# better-sqlite3 may need to compile if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/main.js"]
