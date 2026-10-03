# Plans 36–38 changed-path numerical and browser evidence

Scope: uncommitted `feature/bearing-moments-integrated-review` based on `bfc2b3e`,
Linux x86_64, 2026-10-02–03. These are implementation checks, not owner acceptance
or an exact release-candidate audit. The final feature suite uses runtime SHA-256
`ac3037522380eecb0ab0873768103f7ba5ee552fcaa9e9e901e2ae3f996db064`.

- `chromium-file-harnesses.json`: all 54 applicable Chromium 152.0.7977.75 harnesses.
- `chromium-http-dpr2-harnesses.json`: ten focused isolated HTTP checks at 2× DPR.
- `firefox-file-harnesses.json`: eight focused patched Firefox 153.0 checks.
- `chromium-http-reduced-motion.json`: three integrated bracket cycles at 2× DPR
  with reduced motion confirmed in the application, four themes and equivalent
  125%/200% available viewport sizes. Physical zoom/display checks remain manual.
- `packaging-verification.json`: identical rebuilt WASM/source-string wrappers,
  final runtime identity and native/Python counts. The local source-accompanied
  package at `build/plans38-distribution-stage` passes the artifact/source audit.
- `diff-review.json`: complete implementation review scope and fixed defects.
- `boundary-benchmark.cpp` / `.json`: native boundary-only assembly timing and
  retained connectivity/result capacity for 128–2,048 Tri3/Tri6 faces; ten runs
  after warmup. These are illustrative native timings, with concurrent desktop
  Firefox work, not a browser timing calibration.
- `file-verification.json`, `http-verification.json`: fresh 50-part CAD corpus and
  five-case analytical/reference browser runs, with the final runtime identity.
- `file/http-browser-evidence.json` and `records-file/records-http`: extracted
  five-case evidence and normalized independently validated records. Reference
  raw outputs remain under `benchmarks/reference/calculix`.
- `file/http-cad-corpus.json`: extracted corpus reports with expected classification,
  mesher memory and quality evidence. Fixture identity remains in the corpus manifest.

## Bearing independent reference

`bearing-calculix/case.inp` and `.dat` are matched CalculiX 2.21 input/output.
`case.loads.json` records independent applied force/moment and quadrature,
`comparison.json` enforces 3% maximum displacement, 3% energy and 5% nonsingular
stress limits. `provenance.json` hashes the deck, raw output and complete browser
input; the current regenerated deck was byte-identical to the solved deck.

Both use the finest 0.098 m Tet10 hole mesh (3,868 nodes, 2,088 elements),
E = 1 GPa, ν = 0.25, x-min fixed and 100 N transverse +X cosine bearing force.
The reference uses independent 6×6 Duffy Gauss–Legendre integration, consistent
nodal loads and CalculiX's Spooles direct solve. Edge ordering is converted to
CalculiX C3D10. Energy is independently computed from U·F/2; the stress probe is
nearest [0.75, 0.5, 0.15] m away from load/support concentrations.

| Quantity | SpjutSim | CalculiX | Relative error |
| --- | ---: | ---: | ---: |
| Maximum displacement (m) | 7.0384478603e−7 | 7.0341418578e−7 | 0.06122% |
| Strain energy (J) | 3.0466200652e−5 | 3.0451240906e−5 | 0.04913% |
| Probe von Mises (Pa) | 830.1231401 | 830.5764159 | 0.05457% |

Regenerate with the optional existing Playwright/Chromium verification tools
configured as described in the root README:

```sh
node tools/export-development-review.cjs
python3 tools/generate-bearing-reference.py docs/reviews/fixtures/36-38/bearing-reference-input.json build/bearing-reference/case.inp
# Run CalculiX 2.21 with job name case in build/bearing-reference.
python3 tools/compare-bearing-reference.py docs/reviews/fixtures/36-38/bearing-reference-input.json build/bearing-reference/case.dat build/bearing-reference/case.loads.json build/bearing-reference/comparison.json
python3 tools/build-validation-records.py --evidence benchmarks/validation/plans36-38/file-browser-evidence.json --output build/rechecked-validation
python3 tools/validate-validation-records.py --record build/rechecked-validation/axial-traction.json
```

Use actual filenames emitted by the record builder for individual validation;
all five stored records per mode were checked. Open
`tests/browser/validation-benchmark-tests.html`, `cad-corpus-tests.html`,
`bearing-load-tests.html` and `moment-load-tests.html` for fresh evidence.
The [review checklist](../../../docs/reviews/38-owner-walkthrough-checklist.md)
supplies setup-only projects, exact expected records and bounded failure harnesses.

Full large-case resource repetitions are retained separately in
`benchmarks/resource/plans36-38-matrix-v2.json`, with phase-specific runtime hashes. Desktop Firefox 155 uses the default solve
budget; the two timed-out patched headless Firefox 153 attempts are retained
separately and do not supply resource acceptance. The default application timeout
and historical release matrix are preserved.

Reproduce the boundary measurements with the driver and both operators compiled at O2:

```sh
g++ -std=c++17 -O2 -I native/fem/include benchmarks/validation/plans36-38/boundary-benchmark.cpp native/fem/src/bearing_load.cpp native/fem/src/surface_resultants.cpp -o build/boundary-benchmark
build/boundary-benchmark
```

The emitted columns are operator, nodes per face, face count, median integration
milliseconds, boundary connectivity capacity bytes and result bytes per load.
The RHS is allocated once before timing, quadrature storage is constant, and the
result holds six doubles (48 bytes). Production preflight counts both retained
bridge/Context input copies as well as the result storage.
