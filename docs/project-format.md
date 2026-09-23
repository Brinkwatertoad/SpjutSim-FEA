# Portable projects and local recovery

Plans 30–31 implement `.spjutsim-fea` files. Save project (or Ctrl/Cmd+S) defaults
to CAD and committed setup; Include mesh/results is optional. Apply or Cancel an
assignment draft first. File → Open stages and validates a candidate
before replacing the current analysis. Failed or cancelled opens preserve it.

A browser download request cannot prove the file reached disk. The UI marks the
requested snapshot saved, reports that a download was requested, and keeps later
edits dirty. Keep the downloaded file; recovery is a separate best-effort copy.

## Version 1 container

The container is an uncompressed ZIP with UTF-8 entry names, CRC-32 checksums,
contiguous entries, no encryption, comments, extra fields, spanning or ZIP64.
The reader deliberately accepts the application's narrow layout, not arbitrary
ZIP variants. Unknown required manifest versions are rejected.

- `manifest.json`: UTF-8 JSON, `format: "SpjutSim-FEA"`, `version: 1`.
- `source/cad.bin`: original STEP, IGES or OpenCASCADE BREP bytes.
- Optional `cache/array-N.bin`: raw typed-array bytes, referenced from the manifest.

The manifest contains `producer`, `source`, `setup`, `counters`, `presentation`,
and optional `cache`. All physical setup values use SI.

`source` records name, format, geometry ID, SHA-256 `identity`, and ordered per-face
`faces` evidence. Each face has its opaque ID, tessellation index count and CRC-32
of ordered canonical triangle coordinates encoded as Float64. Evidence is captured
before user orientation and retained through rotations. Reimport must reproduce
it exactly; equal face counts are insufficient. There is no nearest-face fallback.
A changed CAD importer/tessellator may require a new project import and explicit
assignment review. Checksums detect corruption/identity mismatch; they are not
signatures or proof of trustworthy engineering data.

`setup` includes material and provenance, boundary conditions, loads, gravity,
mesh/solve settings, rigid orientation and project metadata (name/report options).
Assignments retain names, IDs, face IDs and `enabled`; suppressed definitions are
saved but excluded from solver inputs. `counters` preserves item/support/load
allocation. Compact viewport presentation is separate from global unit/theme
preferences. Drafts, undo history, workers, prepared checks, DOM and user libraries
are excluded. Persistence revision tracks metadata separately from analysis
revision; presentation-only changes do not mark an engineering project dirty.

## Optional cache

The producer currently is `spjutsim-fea/cad-face-map-1/mesh-1/result-2`.
`cache` records producer, little-endian byte order, analysis revision, a canonical
source/setup fingerprint, mesh-descriptor SHA-256, and `data`. Each binary
reference declares `$array`, `type`, element `length`, and SHA-256. Supported types
are Float64Array, Float32Array, Uint32Array, Int32Array and Uint8Array. Readers
validate total allocations before decoding; array length, hashes, finite values,
mesh connectivity, result schema and actual mesh/result correspondence are checked
before installation. Restored results never restore solve readiness. Derived
factor of safety and convergence classification are recalculated from validated
inputs. Unsupported or invalid optional data offers an explicit setup-only open.

Writers omit FoS arrays and their derived ranges/extrema, sharing the original
solver arrays while preparing the cache. Zero stress can legitimately produce
infinite FoS; reopening reconstructs that value and the finite contour cap without
relaxing finite-value validation for physical results. Earlier caches containing
finite FoS metadata remain readable; their FoS is likewise recalculated.

A convergence level can use a different mesh from the currently installed mesh.
Such a result cannot currently be bundled with that mesh: save setup only, or
regenerate and solve the current mesh before including results. This avoids
silently pairing incompatible data. Cache compatibility is intentionally stricter
than setup portability; cached data is an inspection convenience.

## Bounds and allocation behavior

| Boundary | Maximum |
| --- | ---: |
| Archive | 2 GiB |
| CAD source | 512 MiB |
| All decoded cache arrays combined | 512 MiB |
| Manifest / ZIP directory | 8 MiB each |
| Entries | 2,048 |
| Face records | 100,000 |
| Assignments | 10,000 |
| Metadata nesting | 32 levels |

These are defensive limits, not a promise that every device can open the largest
allowed project. Read uses Blob slices; numerical data is not expanded into JSON
or base64. Save passes typed-array views and Blob parts to the shared ZIP writer.
CRC scans yield at 4 MiB intervals. Source SHA-256 is memoized for an immutable
source buffer. CAD import finishes and its worker is disposed before optional
arrays are decoded. The previous installed project remains resident until commit,
so transactional open temporarily needs both old and candidate data. Browser Blob,
WebCrypto, WASM import and GPU implementations can add copies; process peak memory
at maximum limits has not been measured. Large-device stress verification remains
part of Plan 38.

## Recovery

IndexedDB stores small setup records and CAD Blobs keyed by SHA-256. A transaction
writes source and record together and removes unreferenced sources. Committed changes
are queued for the next task, coalescing synchronous edits without a 750 ms delay.
New/Open wait for the latest committed snapshot before replacement. Recovery excludes
all mesh/results and drafts; it does not traverse numerical buffers during ordinary
edits. Retention is at most four records and 512 MiB of referenced CAD. When full, the
oldest unlocked record is retired in the same transaction as the replacement snapshot.
Live tabs are never evicted; if all slots are active, recovery reports the capacity
error. Failure rolls back both retirement and the new write, preserving the previous
snapshots. Each session owns its record; generation checks reject stale/conflicting
updates. Automatic restoration claims the existing record under a browser Web Lock and a
new owner/generation, rather than accumulating a copy on every reload. Manual Open copy
makes an independent unsaved project. Removing a model clears this session's recovery
record.

Startup automatically reopens the previous part/setup, without a guide or routine
recovery notice. A tab-specific pointer takes precedence over the last project
remembered for the browser origin. An explicit empty marker makes New survive reload.
Browser Web Locks prevent taking a live tab's record; unsupported coordination or a
conflict reports an error and leaves manual open/copy available. File → Local recovery
manages copies; Clear recovery explicitly includes other tabs. Quota, denial or
transaction failure reports unavailable recovery and permits Retry. Manual save/open
remains available. There is no unsaved-site unload warning, server/network fallback or
reliance on unload-time writes. A crash during an outstanding write can still lose the
latest change; unapplied drafts remain excluded. Storage is scoped to browser
profile/origin; `file://` handling is browser-dependent, and changing origin/profile,
private mode or clearing site data can make a copy unavailable. A portable file is the
durable user-managed path.

## Verification

Open the project browser harnesses listed in README. Inspect an actual package
independently with:

```sh
python3 tests/validate_project_file.py path/to/project.spjutsim-fea
```

This Python inspection checks ZIP entries, CRCs, source identity and binary
metadata; application import additionally validates geometry, setup and cache
semantics. See [implementation evidence](reviews/30-34-verification.md) for tested
CAD formats, execution modes, numerical checks and remaining owner review.
