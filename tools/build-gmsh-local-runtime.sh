#!/usr/bin/env bash
# Build and package the pinned serial Gmsh/OpenCASCADE runtime for file:// use.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ROOT="${SPJUTSIM_GMSH_BUILD_ROOT:-$ROOT/build/gmsh-local-runtime}"
SOURCE_ROOT="$BUILD_ROOT/gmsh-js"
EMSDK_ROOT="$BUILD_ROOT/emsdk"
OCCT_SOURCE="$BUILD_ROOT/occt-source"
OCCT_BUILD="$BUILD_ROOT/occt-build"
OCCT_PREFIX="$BUILD_ROOT/occt-install-serial"
GMSH_BUILD="$BUILD_ROOT/gmsh-build"
DIST="$BUILD_ROOT/dist"

GMSH_JS_TAG="v0.3.0"
GMSH_JS_COMMIT="3fdabeeb1dac2417446cefb9f75ecb6645315cd6"
GMSH_COMMIT="29726e7237db13ff77ef3f2db2d7fb9499c4e65c"
OCCT_VERSION="7.8.1"
OCCT_TAG="V7_8_1"
OCCT_ARCHIVE_SHA256="7321af48c34dc253bf8aae3f0430e8cb10976961d534d8509e72516978aa82f5"
OCCT_SOURCE_SHA256="8a8c83a681b95d7741e70d429d9427072cf75c599ef663614772c97c67cef9af"
EMSDK_VERSION="3.1.74"
EMSDK_COMMIT="3d6d8ee910466516a53e665b86458faa81dae9ba"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"
OPT="${OPT:--O3}"

verify_file_sha256() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(shasum -a 256 "$path" | awk '{print $1}')"
  test "$actual" = "$expected" || {
    echo "Checksum mismatch for $path: got $actual, expected $expected" >&2
    exit 1
  }
}

verify_source_tree() {
  local directory="$1"
  local expected="$2"
  local actual
  actual="$(
    cd "$directory"
    find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256 | awk '{print $1}'
  )"
  test "$actual" = "$expected" || {
    echo "Source-tree checksum mismatch for $directory: got $actual, expected $expected" >&2
    exit 1
  }
}

mkdir -p "$BUILD_ROOT" "$DIST"

if [ ! -d "$SOURCE_ROOT/.git" ]; then
  git clone --branch "$GMSH_JS_TAG" --depth 1 --recurse-submodules \
    --shallow-submodules https://github.com/loumalouomega/GMSH-JS.git "$SOURCE_ROOT"
fi

test "$(git -C "$SOURCE_ROOT" rev-parse HEAD)" = "$GMSH_JS_COMMIT" || {
  echo "Unexpected GMSH-JS revision in $SOURCE_ROOT" >&2
  exit 1
}
test "$(git -C "$SOURCE_ROOT/gmsh" rev-parse HEAD)" = "$GMSH_COMMIT" || {
  echo "Unexpected Gmsh revision in $SOURCE_ROOT/gmsh" >&2
  exit 1
}

if [ ! -d "$EMSDK_ROOT/.git" ]; then
  git clone --branch "$EMSDK_VERSION" --depth 1 \
    https://github.com/emscripten-core/emsdk.git "$EMSDK_ROOT"
fi
test "$(git -C "$EMSDK_ROOT" rev-parse HEAD)" = "$EMSDK_COMMIT" || {
  echo "Unexpected emsdk revision in $EMSDK_ROOT" >&2
  exit 1
}
"$EMSDK_ROOT/emsdk" install "$EMSDK_VERSION"
"$EMSDK_ROOT/emsdk" activate "$EMSDK_VERSION"
# shellcheck disable=SC1091
source "$EMSDK_ROOT/emsdk_env.sh" >/dev/null

archive="$BUILD_ROOT/occt-$OCCT_TAG.tar.gz"
if [ ! -f "$archive" ]; then
  curl --fail --location --output "$archive.partial" \
    "https://github.com/Open-Cascade-SAS/OCCT/archive/refs/tags/$OCCT_TAG.tar.gz"
  mv "$archive.partial" "$archive"
fi
verify_file_sha256 "$archive" "$OCCT_ARCHIVE_SHA256"

if [ ! -f "$OCCT_SOURCE/CMakeLists.txt" ]; then
  mkdir -p "$OCCT_SOURCE"
  tar -xzf "$archive" -C "$OCCT_SOURCE" --strip-components=1
fi
verify_source_tree "$OCCT_SOURCE" "$OCCT_SOURCE_SHA256"

emcmake cmake -S "$OCCT_SOURCE" -B "$OCCT_BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
  -DCMAKE_INSTALL_PREFIX="$OCCT_PREFIX" \
  -DCMAKE_C_FLAGS="" \
  -DCMAKE_CXX_FLAGS="-fexceptions" \
  -DBUILD_LIBRARY_TYPE=Static \
  -DBUILD_MODULE_Draw=OFF \
  -DBUILD_MODULE_Visualization=OFF \
  -DBUILD_MODULE_ApplicationFramework=ON \
  -DBUILD_MODULE_DataExchange=ON \
  -DBUILD_MODULE_DETools=OFF \
  -DBUILD_MODULE_ModelingAlgorithms=ON \
  -DBUILD_MODULE_ModelingData=ON \
  -DBUILD_MODULE_FoundationClasses=ON \
  -DBUILD_DOC_Overview=OFF \
  -DBUILD_USE_PCH=OFF \
  -DUSE_FREETYPE=OFF \
  -DUSE_TK=OFF \
  -DUSE_TCL=OFF \
  -DUSE_OPENGL=OFF \
  -DUSE_GLES2=OFF \
  -DUSE_RAPIDJSON=OFF \
  -DUSE_DRACO=OFF \
  -DUSE_VTK=OFF \
  -DUSE_FREEIMAGE=OFF \
  -DUSE_OPENVR=OFF \
  -DINSTALL_TEST_CASES=OFF

cmake --build "$OCCT_BUILD" --parallel "$JOBS"
cmake --install "$OCCT_BUILD"

required_occt="TKDESTEP TKDEIGES TKXSBase TKOffset TKFeat TKFillet TKBool TKMesh TKHLR TKBO TKPrim TKShHealing TKTopAlgo TKGeomAlgo TKBRep TKGeomBase TKG3d TKG2d TKMath TKernel"
for toolkit in $required_occt; do
  test -f "$OCCT_PREFIX/lib/lib$toolkit.a" || {
    echo "Missing required OCCT toolkit: lib$toolkit.a" >&2
    exit 1
  }
done

export CASROOT="$OCCT_PREFIX"
mkdir -p "$GMSH_BUILD"
pushd "$GMSH_BUILD" >/dev/null
emcmake cmake -S "$SOURCE_ROOT/gmsh" -B . \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
  -DCMAKE_C_FLAGS="" \
  -DCMAKE_CXX_FLAGS="-fexceptions" \
  -DENABLE_BUILD_LIB=ON -DENABLE_BUILD_SHARED=OFF -DENABLE_BUILD_DYNAMIC=OFF \
  -DENABLE_FLTK=OFF -DENABLE_GRAPHICS=OFF -DENABLE_OS_SPECIFIC_INSTALL=OFF \
  -DENABLE_OPENMP=OFF -DENABLE_MPI=OFF \
  -DENABLE_EIGEN=ON -DENABLE_BLAS_LAPACK=OFF \
  -DENABLE_PETSC=OFF -DENABLE_SLEPC=OFF -DENABLE_MUMPS=OFF \
  -DENABLE_MED=OFF -DENABLE_CGNS=OFF -DENABLE_HDF5=OFF \
  -DENABLE_MESH=ON -DENABLE_PARSER=ON -DENABLE_POST=ON \
  -DENABLE_TESTS=OFF \
  -DENABLE_OCC=ON -DENABLE_OCC_STATIC=ON -DENABLE_OCC_CAF=ON \
  -DOCC_INC="$OCCT_PREFIX/include/opencascade" \
  -DCMAKE_FIND_ROOT_PATH="$OCCT_PREFIX" \
  -DCMAKE_LIBRARY_PATH="$OCCT_PREFIX/lib" \
  -DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=BOTH \
  -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=BOTH
popd >/dev/null

if grep -q '#define GMSH_CONFIG_OPTIONS.* OpenMP ' "$GMSH_BUILD/src/common/GmshConfig.h"; then
  echo "OpenMP unexpectedly enabled; refusing to package the local runtime" >&2
  exit 1
fi

cmake --build "$GMSH_BUILD" --target lib --parallel "$JOBS"
libgmsh="$(find "$GMSH_BUILD" -name libgmsh.a | head -n 1)"
test -n "$libgmsh"

python3 "$SOURCE_ROOT/scripts/gen_js.py"
exports="$SOURCE_ROOT/generated/exported_functions.json"
occt_libraries=()
for library in "$OCCT_PREFIX"/lib/libTK*.a; do
  occt_libraries+=("$library")
done
occt_libraries+=("${occt_libraries[@]}")

emcc "$libgmsh" "${occt_libraries[@]}" \
  "$OPT" -fexceptions \
  -sMODULARIZE=1 -sEXPORT_NAME=createGmshModule \
  -sSINGLE_FILE=1 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sMAXIMUM_MEMORY=4GB \
  -sMALLOC=emmalloc -sSTACK_SIZE=4MB \
  -sALLOW_TABLE_GROWTH=1 \
  -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,lengthBytesUTF8,wasmMemory,addFunction,removeFunction \
  -sEXPORTED_FUNCTIONS=@"$exports" \
  -sENVIRONMENT=worker \
  -o "$DIST/gmsh-core.serial.js"

python3 "$ROOT/tools/build-local-runtime.py" \
  --gmsh-core "$DIST/gmsh-core.serial.js" \
  --gmsh-runtime "$SOURCE_ROOT/src/runtime.mjs" \
  --gmsh-descriptor "$SOURCE_ROOT/generated/gmsh-api.json"

license_dir="$ROOT/web/wasm/gmsh/licenses"
mkdir -p "$license_dir"
cp "$SOURCE_ROOT/LICENSE" "$license_dir/GMSH-JS-LICENSE.txt"
cp "$SOURCE_ROOT/gmsh/LICENSE.txt" "$license_dir/GMSH-LICENSE.txt"
cp "$OCCT_SOURCE/LICENSE_LGPL_21.txt" "$license_dir/OCCT-LGPL-2.1.txt"
cp "$OCCT_SOURCE/OCCT_LGPL_EXCEPTION.txt" "$license_dir/OCCT-LGPL-EXCEPTION.txt"

shasum -a 256 "$DIST/gmsh-core.serial.js" \
  "$SOURCE_ROOT/src/runtime.mjs" "$SOURCE_ROOT/generated/gmsh-api.json" \
  "$ROOT/web/generated/local-runtime/gmsh-runtime-source.js"
