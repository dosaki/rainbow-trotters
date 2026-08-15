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
  for f in shared server client; do
    ./node_modules/.bin/terser "./public/${f}.js" -c -m -o "./public/${f}.tmp.js"
    mv "./public/${f}.tmp.js" "./public/${f}.js"
  done

  if [[ "${ROADROLL}" == 1 ]]; then
    for f in client shared; do
      ./node_modules/.bin/roadroller "./public/${f}.js" -o "./public/${f}.rr.js"
      mv "./public/${f}.rr.js" "./public/${f}.js"
    done
  fi

  printf ';' >> ./public/shared.js
fi

cp ./static/index.html ./public/index.html

if [[ "${MODE}" == "" || "${MODE}" == "--dist" ]]; then
  rm -rf ./dist && mkdir -p ./dist
  if [[ "${ROADROLL}" == 0 ]]; then
    echo "[measuring] roadroller skipped: deterministic, and larger than the real build"
  fi
  node scripts/pack.mjs public "dist/${NAME}.zip"
fi
