# v1.0 readiness evidence

Status: **Unreleased — Tasks 21–30 improvements and owner reviews pending, then Task 20 candidate acceptance**.

The acceptance audit records the production Tet10 `file://` vertical slice,
five-case analytical/reference matrix, 50-part CAD corpus, and supported-browser
resource matrix as passing. Reproducible records are under `benchmarks/`;
`v1-acceptance-audit.md` describes their scope and browser versions.

The distribution gate passes: the owner approved GPL-2.0-or-later on 2026-09-06
and the final policy/artifact list on 2026-09-07. The source-accompanied stage
passes `python3 tools/audit-distribution.py --release-root build/distribution/web --require-approved`.

Complete the approved sequence and M21–M30 in `../plans/README.md` first. Earlier
passing records retain their historical scope and do not certify changed UI,
postprocessing, or STL behavior. Then run Task 20 against the final candidate,
including the rebuilt Gmsh artifact,
before claiming v1.0 readiness. Task 19's focused rebuild/startup checks do
not replace the complete candidate acceptance matrix.

See `distribution-policy.md`, `artifact-manifest.json`, `SOURCE.md`, and
`reproducibility.md`. Website deployment must serve the staged source-accompanied
package.

No unchecked gate in `spec.md` section 26 should be interpreted as passing.
