# Plan 37 review — distributed moments and offset forces

- Status: **Implemented; pending owner walkthrough.**
- Implementation: uncommitted `feature/bearing-moments-integrated-review` based
  on `bfc2b3e`; grouped walkthrough explicitly deferred by the owner.
- Platform: Linux x86_64; Chromium 152.0.7977.75 file/HTTP and Firefox 153.0
  automation, with detailed provenance in Plan 38 evidence.
- Fixtures: [torsion shaft](fixtures/36-38/torsion-shaft.spjutsim-fea),
  [offset cantilever](fixtures/36-38/offset-cantilever.spjutsim-fea),
  [asymmetric local-frame bracket](fixtures/36-38/asymmetric-bracket.spjutsim-fea).
- Owner response/date: **Not yet received.**

The native surface operator minimizes area-weighted squared traction subject to
six force/moment constraints. It integrates area/centroid and the 3×3 geometric
moment operator using Tri3/Tri6 isoparametric quadrature, then applies
`F/A + lambda × (x−centroid)`. Scale-aware pivot and realized-wrench checks reject
rank/conditioning failures without a guessed fallback. Selected faces stay
flexible; no stiffness or rigid connector is introduced. Disconnected finite-area
patches are supported. Three streaming boundary passes keep quadrature storage
constant; native tests verify pure couples, offsets, reference changes, arbitrary
rigid transforms, Tri6 and disconnected patches, degenerate targets and deformation
energy. A regression caught a missing realized-resultant memory category; preflight
now includes the exactly reserved six scalars per active new load.

Moment vectors can use supported rectangular frames; all reference/application
points use global meters. Offset moment is `(application−reference) × global F`.
Changing a reference preserves the physical wrench. Moment/offset editors,
curved arrows/lever arms, summaries, SI/USCS moment units, immediate invalid drafts,
Undo/suppression, local-frame replacement, recovery, projects and reports are integrated.
Results show each realized force/moment and its own named global reference,
plus global moments about the mesh bounding-box center. Worker/client validation
rejects malformed/null loads, nonzero force inside a pure moment and contradictory
offset resultants with actionable errors. Source/setup/cached-diagnostic compatibility
is revalidated when reopening.

| Analytical case | Displacement error | Nonsingular stress error | Limits |
| --- | ---: | ---: | --- |
| Shaft, Tet4 (max 0.05 m/min 0.02 m) | 1.5236% | 1.8352% | 3% / 5% |
| Shaft, Tet10 (max 0.2 m/min 0.05 m) | 0.01873% | 0.01707% | 3% / 5% |
| Shaft, refined Tet10 (max 0.14 m/min 0.035 m) | 0.01650% | 0.000280% | 3% / 5% |
| Offset cantilever, Tet10 | 0.8747% | Not used as an analytical stress benchmark | 3% displacement |

For r = 0.5 m, L = 1 m, E = 1 GPa, ν = 0.25, T = 100 N·m,
`G = 0.4 GPa`, `J = πr⁴/2` and surface tip displacement is `TLr/(GJ)` =
**1.27323954e−6 m**. Tet10 gives **1.27347798e−6 m**. Shear probes are away from
end restraint/load introduction, evaluated against `sqrt(3) T rprobe/J`; their
actual mesh locations and values are recorded rather than treated as identical
between Tet4 and Tet10. Refining Tet10 from 0.2 to 0.14 m changes
displacement by 0.00222% (limit 2%) and the location-normalized stress ratio
by 0.01735% (limit 5%). Normalization uses the analytical stress at each actual
mesh probe, so a shifted centroid is not misreported as stress refinement.

The 4 × 0.25 × 0.5 m cantilever receives −1,000 N in Z at x = 5 m, transferred
through its x = 4 m face. Its reference is [4, 0.125, 0.25] m and its additional
moment is +1,000 N·m in Y. Euler–Bernoulli force-plus-end-moment deflection is
**0.011264 m**; Tet10 gives **0.011362523 m**. This 3% limit allows the small
three-dimensional/shear/end-restraint differences. Moving the reference to x = 0
or replacing the offset with an equivalent face force plus couple preserves the
computed field (maximum equivalent difference **2.08e−14 m**). Agreement of
local stresses is not required for other statically equivalent transfer models.

Both force and moment equilibrium retain the default 1e−6 acceptance tolerance.
Moment scale combines absolute nodal moments and mesh diagonal × existing force
scale, with DBL_MIN handling a zero denominator. Force acceptance is unchanged.
The reported global reference differs from a load's chosen reference; the
cantilever has +3,000 N·m about its bounding-box center and +1,000 N·m about the
entered tip reference. The UI/report explicitly identifies both.

Verification: [moment workflow](../../tests/browser/moment-load-tests.html),
[surface editor](../../tests/browser/surface-load-ui-tests.html), native/C-ABI
regressions and [Plan 38 matrices](38-integrated-usability-and-pre-release-regression.md).
[Exact analytical records](fixtures/36-38/expected-values.json),
[torque screenshot](evidence/38-torsion-shaft.png).
Use the [grouped walkthrough](38-owner-walkthrough-checklist.md#moment-and-offset-force--plan-37).
Contact, remote displacement, rigid spiders and follower loads remain outside this model.
Owner acceptance and exact release-candidate approval remain pending.
