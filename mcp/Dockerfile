# MCP Streamable HTTP server for Cloud Run (calls the Todo REST API).
FROM node:24-bookworm-slim

WORKDIR /usr/src/app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Root context. tsx is a devDependency, so focus stays off --production.
COPY package.json yarn.lock .yarnrc.yml ./
COPY mcp/package.json mcp/package.json
RUN yarn workspaces focus mcp

COPY mcp mcp

ENV PORT=8080
EXPOSE 8080
CMD ["yarn", "workspace", "mcp", "start:http"]
