#!/usr/bin/env bash
# Chạy toàn bộ E2E dưới xvfb. Dùng: bash test/e2e/run.sh [file.test.js ...]
# Cần: xvfb-run, ImageMagick (import), playwright-core (tạm: npm i --no-save playwright-core@1.48.2)
set -u
cd "$(dirname "$0")/../.."
node -e "require('playwright-core')" 2>/dev/null || npm i --no-save playwright-core@1.48.2 >/dev/null
files=("$@")
[ ${#files[@]} -eq 0 ] && files=(test/e2e/*.test.js)
exec xvfb-run -a -s "-screen 0 1440x900x24" node --test --test-concurrency=1 "${files[@]}"
