#!/bin/bash
set -euo pipefail

if [ ! -f server/config/.env.local ]; then
  cp server/config/.env.example server/config/.env.local
fi

if [ ! -f web/config/.env.local ]; then
  cp web/config/.env.example web/config/.env.local
fi

corepack enable
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
yarn install --immutable
