#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

NAME="rainbow-trotters"

MODE=""
ROADROLL=1

for arg in "$@"; do
  case "${arg}" in
    --dev|--ci|--dist)  MODE="${arg}" ;;
    --no-roadroller|--no-rr) ROADROLL=0 ;;
    *) echo "build.sh: unknown option '${arg}'" >&2; exit 2 ;;
  esac
done

rm -rf ./public && mkdir -p ./public

./node_modules/.bin/webpack

if [[ "${MODE}" != "--dev" ]]; then
  ./node_modules/.bin/terser ./public/client.js -c -m -o ./public/client.tmp.js
  mv ./public/client.tmp.js ./public/client.js
fi

if [[ "${MODE}" == "" || "${MODE}" == "--dist" ]] && [[ "${ROADROLL}" == 1 ]]; then
  ./node_modules/.bin/roadroller ./public/client.js -o ./public/client.rr.js
  mv ./public/client.rr.js ./public/client.js
fi

cp ./static/index.html ./public/index.html

if [[ "${MODE}" == "" || "${MODE}" == "--dist" ]]; then
  rm -rf ./dist && mkdir -p ./dist
  if [[ "${ROADROLL}" == 0 ]]; then
    echo "[measuring] roadroller skipped: deterministic, and larger than the real build"
  fi
  node scripts/pack.mjs public "dist/${NAME}.zip"
fi
