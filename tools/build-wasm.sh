#!/bin/sh
set -eu
mkdir -p build/wasm
emcc native/wasm/fem_c_api.cpp -std=c++17 -O2 -sSINGLE_FILE=1 -sENVIRONMENT=worker -sEXPORTED_FUNCTIONS='["_fem_protocol_version"]' -o build/wasm/fem.js
