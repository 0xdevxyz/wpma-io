FROM node:18-alpine

WORKDIR /app

# Package files kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm install

# Alles kopieren
COPY . .

# Build
RUN npm run build

# User erstellen
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV production

# Use standard next start for proper CSS loading
CMD ["npm", "start"]
