#!/bin/sh
# Rust 엔진 → wasm/jeju.wasm (처음 한 번: rustup target add wasm32-unknown-unknown)
#  file://로 열 때는 fetch가 막혀서, 같은 내용을 base64로 담은 wasm/jeju-wasm.js도 만듦
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/jeju.wasm jeju.wasm
printf "// 자동 생성 (wasm/build.sh) — file://로 열 때 쓰는 jeju.wasm 사본\nwindow.JEJU_WASM = '%s';\n" "$(base64 < jeju.wasm | tr -d '\n')" > jeju-wasm.js
ls -l jeju.wasm jeju-wasm.js
