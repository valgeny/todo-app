# CopilotKit Next.js UI. Build from repo root:
#   docker build -f agent-ui/Dockerfile -t …/todo-sandbox-agent-ui:latest .

# Root package.json engines require Node >=24.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY agent-ui/package.json ./agent-ui/
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY agent-ui ./agent-ui
WORKDIR /app/agent-ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build /app/agent-ui/public ./agent-ui/public
COPY --from=build --chown=nextjs:nodejs /app/agent-ui/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/agent-ui/.next/static ./agent-ui/.next/static
USER nextjs
EXPOSE 8080
# standalone layout with outputFileTracingRoot → agent-ui/server.js
CMD ["node", "agent-ui/server.js"]
