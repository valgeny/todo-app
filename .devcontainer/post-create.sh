#!/bin/bash
set -euo pipefail

if [ ! -f server/config/.env.local ]; then
  cp server/config/.env.example server/config/.env.local
fi

if [ ! -f web/config/.env.local ]; then
  cp web/config/.env.example web/config/.env.local
fi

corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
