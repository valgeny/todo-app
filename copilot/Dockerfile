# CopilotKit Next.js BFF. Build from repo root:
#   docker build -f copilot/Dockerfile -t …/todo-sandbox-copilot:latest .
#
# Context stays the repo root: Yarn metadata is there, and Next traces files
# from outputFileTracingRoot (the workspace root). typescript is a devDependency.

# Root package.json engines require Node >=24.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY copilot/package.json ./copilot/package.json
RUN yarn workspaces focus copilot
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
# public/ may be empty (tracked via .gitkeep); ensure the path exists for Next.
RUN mkdir -p ./copilot/public
COPY --from=build /app/copilot/public ./copilot/public
COPY --from=build --chown=nextjs:nodejs /app/copilot/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/copilot/.next/static ./copilot/.next/static
USER nextjs
EXPOSE 8080
# standalone layout with outputFileTracingRoot → copilot/server.js
CMD ["node", "copilot/server.js"]
