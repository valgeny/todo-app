# MCP Streamable HTTP server for Cloud Run (calls the Todo REST API).
FROM node:24-bookworm-slim

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
COPY mcp/package.json mcp/package.json
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN yarn install --frozen-lockfile

COPY mcp mcp

ENV PORT=8080
EXPOSE 8080
CMD ["yarn", "workspace", "mcp", "start:http"]
