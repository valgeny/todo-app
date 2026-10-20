FROM node:24-bookworm-slim

WORKDIR /usr/src/app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Root context: Yarn metadata lives at the repo root. No workspace: deps, so
# only this workspace manifest is required. ts-node is a devDependency, so this
# is not a --production focus.
COPY package.json yarn.lock .yarnrc.yml ./
COPY server/package.json server/package.json
RUN yarn workspaces focus server

COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["yarn", "workspace", "server", "start"]
