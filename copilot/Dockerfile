# CopilotKit Next.js BFF. Build from repo root:
#   docker build -f copilot/Dockerfile -t …/todo-sandbox-copilot:latest .

# Root package.json engines require Node >=24.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY copilot/package.json ./copilot/
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY copilot ./copilot
WORKDIR /app/copilot
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build /app/copilot/public ./copilot/public
COPY --from=build --chown=nextjs:nodejs /app/copilot/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/copilot/.next/static ./copilot/.next/static
USER nextjs
EXPOSE 8080
# standalone layout with outputFileTracingRoot → copilot/server.js
CMD ["node", "copilot/server.js"]
