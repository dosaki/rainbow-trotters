#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

NAME="rainbow-trotters"

MODE=""
ROADROLL=1
export WAVEDASH=0

for arg in "$@"; do
  case "${arg}" in
    --dev|--ci|--dist)  MODE="${arg}" ;;
    --no-roadroller|--no-rr) ROADROLL=0 ;;
    --wavedash) WAVEDASH=1 ;;
    *) echo "build.sh: unknown option '${arg}'" >&2; exit 2 ;;
  esac
done

rm -rf ./public && mkdir -p ./public

./node_modules/.bin/webpack

if [[ "${MODE}" != "--dev" ]]; then
  ./node_modules/.bin/terser ./public/client.js -c -m -o ./public/client.tmp.js
  mv ./public/client.tmp.js ./public/client.js
fi

if [[ "${MODE}" == "" || "${MODE}" == "--dist" || "${WAVEDASH}" == 1 ]] && [[ "${ROADROLL}" == 1 ]]; then
  ./node_modules/.bin/roadroller ./public/client.js -o ./public/client.rr.js
  mv ./public/client.rr.js ./public/client.js
fi

cp ./static/index.html ./public/index.html

if [[ "${WAVEDASH}" == 1 ]]; then
  rm -rf ./build-wavedash && mkdir -p ./build-wavedash
  cp ./public/index.html ./public/client.js ./build-wavedash/
  mkdir -p ./dist
  node scripts/pack.mjs build-wavedash "dist/${NAME}-wavedash.zip" --no-limit
  echo "[wavedash] build-wavedash/ is ready to upload, no size budget applies"
  exit 0
fi

if [[ "${MODE}" == "" || "${MODE}" == "--dist" ]]; then
  rm -rf ./dist && mkdir -p ./dist
  if [[ "${ROADROLL}" == 0 ]]; then
    echo "[measuring] roadroller skipped: deterministic, and larger than the real build"
  fi
  node scripts/pack.mjs public "dist/${NAME}.zip"
fi
