FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

ENV NODE_ENV=production
# Fly typically routes to port 8080 internally
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]


