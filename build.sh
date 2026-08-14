#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

NAME="rainbow-trotters"
ARG="${1:-}"

rm -rf ./public && mkdir -p ./public

./node_modules/.bin/webpack

if [[ "${ARG}" != "--dev" ]]; then
  for f in shared server client; do
    ./node_modules/.bin/terser "./public/${f}.js" -c -m -o "./public/${f}.tmp.js"
    mv "./public/${f}.tmp.js" "./public/${f}.js"
  done
  ./node_modules/.bin/roadroller ./public/client.js -o ./public/client.rr.js
  mv ./public/client.rr.js ./public/client.js
fi

cp ./static/index.html ./public/index.html

if [[ "${ARG}" == "" || "${ARG}" == "--dist" ]]; then
  rm -rf ./dist && mkdir -p ./dist
  node scripts/pack.mjs public "dist/${NAME}.zip"
fi
