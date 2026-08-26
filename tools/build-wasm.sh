#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
EMSDK_ROOT=${SPJUTSIM_EMSDK_ROOT:-"$ROOT/build/gmsh-local-runtime/emsdk"}
if [ -f "$EMSDK_ROOT/emsdk_env.sh" ]; then
  # shellcheck disable=SC1091
  . "$EMSDK_ROOT/emsdk_env.sh" >/dev/null
fi
: "${EMXX:=$(command -v em++ || true)}"
if [ -z "$EMXX" ]; then
  echo "Emscripten em++ was not found. Set SPJUTSIM_EMSDK_ROOT or EMXX." >&2
  exit 1
fi

OUTPUT="$ROOT/web/wasm/fem/fem.js"
mkdir -p "$(dirname "$OUTPUT")"
"$EMXX" \
  "$ROOT/native/fem/src/fem_context.cpp" \
  "$ROOT/native/fem/src/fem_c_api.cpp" \
  "$ROOT/native/fem/src/pcg.cpp" \
  "$ROOT/native/fem/src/sparse.cpp" \
  "$ROOT/native/fem/src/tet4.cpp" \
  "$ROOT/native/wasm/fem_c_api.cpp" \
  -I"$ROOT/native/fem/include" -std=c++17 -O3 \
  -sSINGLE_FILE=1 -sMODULARIZE=1 -sEXPORT_NAME=createSpjutsimFemModule \
  -sENVIRONMENT=worker -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=16777216 -sMAXIMUM_MEMORY=3758096384 \
  -sASSERTIONS=0 -sMALLOC=emmalloc \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_fem_create","_fem_destroy","_fem_load_mesh","_fem_set_material","_fem_set_constraints","_fem_clear_loads","_fem_set_nodal_forces","_fem_add_pressure","_fem_add_total_face_force","_fem_set_gravity","_fem_wasm_api_version","_fem_wasm_preflight","_fem_wasm_memory_value","_fem_wasm_solve","_fem_wasm_read_results","_fem_wasm_result_value","_fem_wasm_result_pointer","_fem_wasm_read_error","_fem_wasm_error_string","_fem_wasm_error_value"]' \
  -o "$OUTPUT"

perl -pi -e 's/[ \t]+$//' "$OUTPUT"
python3 "$ROOT/tools/build-local-runtime.py" --fem-runtime "$OUTPUT"
