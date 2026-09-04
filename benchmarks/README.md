# Benchmark records

## Numerical validation matrix

The five v1 validation cases use SI inputs, converged SpjutSim Tet10 studies,
and independent CalculiX 2.21 C3D8 references. The normalized records are
validated against [`validation/schema-v1.md`](validation/schema-v1.md).

| Case | Compared evidence | Maximum measured error | Limit | Record |
| --- | --- | ---: | ---: | --- |
| Axial traction | face displacement, reaction, energy, raw stress | 0.00000071% | 1% | [`axial-traction.json`](validation/records/axial-traction.json) |
| Cantilever bending | free-end displacement, beam theory, energy | 0.7632% | 3% | [`cantilever-bending.json`](validation/records/cantilever-bending.json) |
| Uniform pressure | face displacement, reaction, energy | 0.0000000015% | 3% | [`uniform-pressure.json`](validation/records/uniform-pressure.json) |
| Gravity reaction | corrected constrained-support resultant | 0.0000000043% | 0.1% | [`gravity-reaction.json`](validation/records/gravity-reaction.json) |
| Notched prism | nonsingular raw interior stress and reaction | 0.1369% | 5% | [`notched-prism-stress.json`](validation/records/notched-prism-stress.json) |

The notched-prism global peak remains explicitly `converged-stress-unresolved`;
only the fixed interior raw recovery probe is tolerance-tested. Reproduce the
stored evidence with:

```sh
python3 tools/generate-validation-geometry.py benchmarks/validation/geometry
python3 tools/generate-calculix-reference.py benchmarks/reference/calculix
# Run `ccx case` in each CalculiX case directory, then run the browser harness.
python3 tools/build-validation-records.py
python3 tools/validate-validation-records.py
```

`spjutsim-browser-evidence.json` is the compact export from
`tests/browser/validation-benchmark-tests.html`. See
[`reference/calculix/README.md`](reference/calculix/README.md) for the pinned
reference-solver run and extraction details. Regenerating records twice is
covered by the Python test suite and must be byte-identical.

## Resource measurements

Copy `resource-measurement-template.json` for each representative Tet4 or Tet10
browser run. Record the exact preflight and solver-statistics values returned by
the application, plus browser/version and wall time. External process peak
memory is optional because browser process accounting differs by platform.

The current multiplier remains the provisional, uncalibrated value of 1.5 and
the single-threaded WASM cap remains 3.5 GiB. The existing Chromium cube record
captures post-solve linear memory rather than peak memory, so it cannot fit or
validate the multiplier. Keep Task 13's calibration item open until a
representative Tet4/Tet10 supported-browser matrix captures peak WASM or
external process memory and the documented PCG cases have been measured.
