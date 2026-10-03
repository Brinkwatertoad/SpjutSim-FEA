# Plan 36 review — bearing loads

- Status: **Implemented; pending owner walkthrough.**
- Implementation: uncommitted `feature/bearing-moments-integrated-review` working
  tree based on `bfc2b3e`; owner requested Plans 36–38 together, with walkthroughs afterward.
- Platform: Linux x86_64; Chromium 152.0.7977.75 file/HTTP and Firefox 153.0
  automation. Exact browser/runtime provenance accompanies the evidence.
- Start: [prepared hole project](fixtures/36-38/bearing-hole.spjutsim-fea),
  E = 1 GPa, ν = 0.25, fixed x-min face, full r = 0.18 m hole,
  axial span 0.3 m and 100 N global +X.
- Owner response/date: **Not yet received.**

CAD extraction supplies canonical circular-band descriptors only for recognized
Cylinder surfaces with matching analytic samples and area. Selections must cover
one full coaxial band; compatible split faces work. Real split-cylinder extraction
and solving, outward/inward native boundaries, reversals and rigid transforms are
covered. A rounding error at a split STEP seam was reproduced and corrected;
partial/conical/noncoaxial/mixed-radius/axial selections remain rejected.

Native Tri3/Tri6 integration uses compressive cosine pressure on the loaded half,
uniform axially, normalized with the same seven-point boundary quadrature that
assembles nodal forces. Force error is bounded by 0.5% of |F| and band-center
moment by 0.5% |F| max(radius, length). Poor resolution fails with a refinement
instruction. The application reports realized resultants instead of hiding small
discretization components. A native full-band area check independently rejects missing unloaded sectors,
even when their removal preserves the wrench (5% area discretization limit).
An independent moment cannot silently enter a bearing
record. Geometry validation and native tests cover nonfinite data and malformed
connectivity. No contact/friction/preload model is introduced.

Editor, loaded-half clipping/arrows, summaries, history/suppression, replacement,
project caches, units and reports use the same validated definition. Hide/reveal
and Model/Mesh/result switches refresh the highlight; its draw range shares the
existing surface buffers and detaches shared attributes before disposal. New loads
transfer only their true solver boundary; no equivalent main-thread nodal-force
or display-triangle normal/area arrays are generated.

| Tet10 target size | Nodes | Max displacement (m) | Energy (J) | Nonsingular probe von Mises (Pa) |
| --- | ---: | ---: | ---: | ---: |
| 0.2 m | 1,580 | 7.0221262e−7 | 3.0269404e−5 | 811.8433 |
| 0.14 m | 1,801 | 6.9732552e−7 | 3.0191975e−5 | 865.9960 |
| 0.098 m | 3,868 | 7.0384479e−7 | 3.0466201e−5 | 830.1231 |

The last displacement/energy changes are below 2%; the nonsingular probe change
is below 5%. Probe elements are nearest the fixed target [0.75, 0.5, 0.15] m;
the recorded actual centroid differs by mesh and is preserved in the evidence.
Raw peak stress grows 1,471.84 → 1,586.57 → 1,592.68 Pa: these load/support
concentrations are kept visible and are not claimed converged.

Matched **CalculiX 2.21** uses the same mesh/material/supports and physical cosine
pressure, independently integrated by 6×6 Duffy Gauss–Legendre quadrature. Its
Spooles direct solve is independent of SpjutSim's PCG solve. Finest-level errors:
maximum displacement **0.0612%**, energy **0.0491%**, nonsingular stress **0.0546%**
(acceptance 3%, 3%, 5%). [Comparison and raw reference](../../benchmarks/validation/plans36-38/README.md).
The independent test quadrature checks loaded-half compression, resultant and
zero moment, including force reversal; missing energy evidence is rejected.

Verification: native bearing/resultant/C-ABI regressions, the real
[bearing workflow](../../tests/browser/bearing-load-tests.html), viewport/editor
regressions and the integrated matrices in [Plan 38](38-integrated-usability-and-pre-release-regression.md).
API 2 gains additive entries; protocol 6 and the new project producer reject old
interpretations. Generated runtime assets are rebuilt from source. Preflight
accounts for retained surface input copies and six result scalars per new load.

Use the [grouped walkthrough](38-owner-walkthrough-checklist.md#bearing-force--plan-36).
[Editor screenshot](evidence/38-bearing-hole.png). Broader distributions,
partial cylinders, friction and contact remain outside this first model.
Automated verification does not supply owner usability acceptance or publication authorization.
