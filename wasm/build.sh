#!/bin/sh
# Rust 커널 → wasm/jeju.wasm (처음 한 번: rustup target add wasm32-unknown-unknown)
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/jeju.wasm jeju.wasm
ls -l jeju.wasm
