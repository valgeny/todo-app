FROM node:22-bookworm-slim

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN yarn install --frozen-lockfile

COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["yarn", "workspace", "server", "start"]
