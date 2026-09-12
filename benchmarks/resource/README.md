# Browser resource calibration

The v1 matrix contains 36 successful non-headless desktop records: three
repetitions of four cases in Chromium 152.0.7977.75 under both `file://` and
cross-origin-isolated HTTP, and Firefox 155.0.1 under `file://`. The measurements
were made on Linux x86_64 with 24 logical cores and 16 GiB declared system
memory, against application commit `87129725e8869ad8b7310103b4cc4ce17a1bbc0f`
and solver runtime SHA-256
`539a7f06dbfb97f136ba0f01b560fdd0186fdd413ade65b959fc98cfd4140625`.

| Browser mode | Case | Median solve wall time | Worst WASM high-water | Worst WASM/model ratio | PCG iterations |
| --- | --- | ---: | ---: | ---: | ---: |
| Chromium HTTP | Axial Tet10, 24,210 nodes | 3.64 s | 89.8 MiB | 0.625785 | 725 |
| Chromium HTTP | Cantilever Tet10, 71,325 nodes | 59.62 s | 261.5 MiB | 0.884036 | 4,314 |
| Chromium HTTP | Mixed-scale Tet10, 144,742 nodes | 481.17 s | 524.8 MiB | 0.991525 | 17,188 |
| Chromium HTTP | Poor-quality Tet4, 24,817 nodes | 15.30 s | 67.3 MiB | 0.563255 | 6,638 |
| Chromium `file://` | Axial Tet10, 24,210 nodes | 3.76 s | 89.8 MiB | 0.625785 | 725 |
| Chromium `file://` | Cantilever Tet10, 71,325 nodes | 62.14 s | 261.5 MiB | 0.884036 | 4,314 |
| Chromium `file://` | Mixed-scale Tet10, 144,742 nodes | 501.44 s | 524.8 MiB | 0.991525 | 17,188 |
| Chromium `file://` | Poor-quality Tet4, 24,817 nodes | 15.84 s | 67.3 MiB | 0.563255 | 6,638 |
| Firefox `file://` | Axial Tet10, 24,210 nodes | 3.88 s | 89.8 MiB | 0.625785 | 725 |
| Firefox `file://` | Cantilever Tet10, 71,325 nodes | 63.90 s | 261.5 MiB | 0.884036 | 4,314 |
| Firefox `file://` | Mixed-scale Tet10, 144,742 nodes | 520.54 s | 524.8 MiB | 0.991525 | 17,188 |
| Firefox `file://` | Poor-quality Tet4, 24,817 nodes | 16.31 s | 67.3 MiB | 0.563255 | 6,638 |

Every run converged to the production relative residual tolerance of `1e-8`
with identical iteration counts and final residuals for a given case. The
maximum observed WASM/model ratio was 0.991525. Adding the selected 0.25
absolute margin and rounding upward to a tenth gives 1.3; v1 conservatively
retains the existing 1.5 multiplier rather than lowering it. The 3.5 GiB
single-threaded WASM cap also remains unchanged because this corpus does not
exercise a near-cap allocation. No modeled allocation category was shown to be
missing from the phase high-water.

Jacobi remains the production preconditioner. The recorded cases all converged
without fallback using relative tolerance `1e-8` and the existing automatic
iteration ceiling `max(1000, 10 * DOF)`. IC(0) is therefore not introduced for
v1. The roughly eight-minute 150k-node solve shows a useful post-v1 acceleration
opportunity, but not a correctness blocker. A pthread build is deferred until
it can be packaged, memory-modeled, and rerun against the numerical matrix;
cross-origin isolation alone does not imply that threading is available.

## Process observation and reproduction

During each matrix run, aggregate resident memory for the browser process tree
was sampled every ten seconds with the platform command:

```sh
ps -C chrome -o rss= | awk '{sum += $1} END {print sum + 0}'
ps -C firefox-bin -o rss= | awk '{sum += $1} END {print sum + 0}'
```

Firefox peaked at 511,340 KiB aggregate RSS. Chromium `file://` rose from a
1,320,608 KiB pre-navigation baseline to 1,959,188 KiB (638,580 KiB delta), and
Chromium HTTP rose from 1,416,804 KiB to 2,249,160 KiB (832,356 KiB delta).
These are run-wide diagnostic observations, not per-case solver allocations:
summed RSS includes the persistent browser UI, caches, shared mappings, and may
double-count shared pages. They are therefore documented here rather than put
in `externalProcessPeakBytes` or used to fit the solver-only preflight model.
The per-case WASM high-water is the comparable allocation boundary.

Run the matrix from `tests/browser/resource-benchmark-tests.html` with
`repetitions=3` and provenance query parameters. Completed rows are checkpointed
in origin-local browser storage so an interrupted run resumes safely. Export
`window.__spjutsimResourceRecords`; add `reset=1` to deliberately discard a
matching checkpoint and start a clean run. Combine the three mode files into
`matrix-v2.json`, then run:

```sh
python3 tools/validate-resource-records.py benchmarks/resource/matrix-v2.json
python3 tools/analyze-resource-records.py benchmarks/resource/matrix-v2.json
```

Release validation requires every repetition to report a successful solve.
A `passed` solve must have a finite final relative residual no greater than its
recorded tolerance. Failed, cancelled, and preflight-blocked outcomes can be
retained as diagnostic records, but do not satisfy the release calibration gate.
