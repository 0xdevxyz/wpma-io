FROM node:20-alpine AS builder

WORKDIR /app

# Copy pre-installed node_modules from host (avoids npm registry during build)
COPY package*.json ./
COPY node_modules ./node_modules
COPY . .
RUN node_modules/.bin/next build

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV production

CMD ["node", "server.js"]
