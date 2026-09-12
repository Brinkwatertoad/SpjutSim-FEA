# Corresponding source and release procedure

Each release accompanies its executable browser assets with the exact
corresponding source under GPLv2 section 3(a) and equivalent access for network
downloads. We do not substitute a promise to supply source later. Keep the
source downloads available alongside every retained executable release.

## Prepare the candidate

Run from the repository root with Python 3 and the pinned build toolchains:

```sh
tools/build-wasm.sh
tools/build-gmsh-local-runtime.sh
python3 -m unittest discover -s tests
python3 tools/audit-distribution.py
python3 tools/package-distribution.py --fetch-sources
python3 tools/audit-distribution.py --release-root build/distribution/web
```

The packager downloads only explicitly requested, SHA-256-pinned source
archives. It caches them under ignored `build/distribution-inputs/`; subsequent
packaging works offline without `--fetch-sources`. It refuses an existing output
directory to avoid overwriting a candidate. Move the old candidate aside or use
`--output build/another-candidate/web` for another review.

The stage contains the original `web/` tree, local notices, and a `sources/`
directory containing the application source snapshot plus GMSH-JS, Gmsh, OCCT,
Three.js, Emscripten, and emsdk source archives. The Gmsh archive includes its
bundled dependencies and their source notices. The application snapshot includes
new/modified files in this candidate, not just the last Git commit. Build caches,
VCS data, and Python caches are excluded. Inspect the tree for unintended files
before packaging. No files are uploaded by the packager.

Archives are split into ordered 20 MiB parts so that every hosted asset fits
the static host's 25 MiB limit. `sources/index.html` links every part and states
the reconstruction commands; `sources/manifest.json` records their hashes and
the candidate artifact-manifest hash. Reconstruct each archive, verify its
combined hash, and extract it. The packager normalizes application tar ownership,
permissions, timestamps, and gzip header metadata. Source files retain their
actual contents. All license texts remain unmodified.

The audit verifies the staged web files against the candidate, every source
archive part against its hash, upstream archive hashes against the artifact
manifest, and every application-source member against the current candidate.
It rejects unlisted staged files. The literal runtime-URL scan is a guard, not a
JavaScript interpreter: run browser verification with network disabled as well.

## Rebuild from the source package

When intentionally changing an artifact or build input, first review its
provenance, license, source pin, and complete file coverage in
`artifact-manifest.json`. Then run `python3 tools/audit-distribution.py --refresh-hashes`
to update existing local-file hashes. This command never adds new dependencies,
changes upstream archive pins, or grants final approval. Missing/unlisted files
still fail the audit, and changed manifests invalidate previous final review.
The staged audit also compares upstream notices against the actual pinned
archive members, so refreshing hashes cannot silently rewrite their terms.

The application archive extracts to `SpjutSim-FEA/`. Its README describes the
native and browser tests. The toolchain is Emscripten 3.1.74; use a host-native
SDK on Linux/WSL or macOS. Native tests require CMake and a C++17 compiler.

GMSH-JS is pinned to `3fdabeeb1dac2417446cefb9f75ecb6645315cd6` and its Gmsh
submodule to `29726e7237db13ff77ef3f2db2d7fb9499c4e65c`. The official Gmsh
GitHub mirror supplies the source archive; the normal build script uses the
original ONELAB repository. They identify the same Git commit. OCCT is 7.8.1,
with both the archive and extracted-tree checksums recorded in the build script.

The Gmsh recipe normalizes its build date with `SOURCE_DATE_EPOCH` from the
pinned Gmsh commit, sets stable host/packager labels, and maps the build-root
prefix in compiler `__FILE__` strings to `/spjutsim-build`. Earlier artifacts
embedded the operator's date, hostname, and source paths, so a fresh build of
those same sources differed. The normalized candidate replaces that artifact;
see `reproducibility.md` for measured hashes and verification limits.

With network available, run the two build commands above; they obtain and
verify the pinned inputs. To use the accompanied source archives or modified
OCCT sources, follow the same CMake and Emscripten commands in
`tools/build-gmsh-local-runtime.sh` with your extracted directories. The Git-HEAD
and source-checksum guards intentionally validate pristine release inputs; for
a modified-library build, adapt those guards to your modified source. No signing
key or secret is required. The final `tools/build-local-runtime.py` invocation
embeds the replacement runtime so the application can run against modified
OCCT/Gmsh code. `tools/build-wasm.sh` and `native/` contain the complete first-party
FEM build. Three.js's upstream 0.149.0 source package contains its readable
`src/` tree and the unchanged classic `build/three.min.js`; no npm command is
needed to use or extract it. UI foundation source is already in the application archive.

Exact upstream notices can be reproduced by copying their archive members to
the paths recorded as `upstream_path` in the artifact manifest. The general GPL
text is copied from the GPL portion of the pinned GMSH-JS LICENSE; the root grant
and NOTICE are first-party policy documents.

## Publish only after review

The owner must review `distribution-policy.md` and `artifact-manifest.json`
before the final review record is approved. Then restage the candidate so its
source includes that review, and run:

```sh
python3 tools/audit-distribution.py --release-root build/distribution/web --require-approved
wrangler deploy
```

Wrangler serves the staged directory and runs the same gate before publishing.
Direct `web/` deployment omits accompanied sources and is not this release path.
For folder distribution, distribute the entire staged `web/` directory, including
`sources/` and `licenses/`, and open its `index.html` locally. No source download
is necessary for normal application startup. The general v1 acceptance gate is
separate from the licensing gate and still requires Task 20's candidate audit.
