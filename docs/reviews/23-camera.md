# M23: Camera review

- Status: **Accepted 2026-09-08**.
- Implementation, browser, checks and solved fixture:
  [combined packet](21-23-review.md).
- Navigation/picking harnesses pass for both projections at 1×/2× DPI, exact
  signed axes, pole-safe up vectors, wide/tall fits, extreme scales, projection
  continuity, high-zoom clipping, cancellation, reduced motion, preference
  migration, menu commands and isolated gizmo pointer/keyboard events.

Use a solved cube first, then an asymmetric licensed fixture such as
`tests/fixtures/cad-corpus/loft.step`.
Try all six signed axes through View and the signed gizmo endpoints. Hover the
general gizmo area to reveal circles/negative labels; check labels pass behind
arrows according to depth. Use the cube Reset view icon and its hover text. Tab to endpoints and activate by
keyboard. Overlapping endpoints always have a separate View menu path.

Use the 3D display Perspective switch, pan/zoom, Fit model and animated Reset
view. Reset should ease back over 180 ms and stop on user navigation. Rotate away
from ±Y to exercise the pole case. Interrupt a view transition with navigation
and repeat under the OS reduced-motion preference. A projection switch should
keep apparent model size and the target. Fit should keep the chosen orientation.
Geometry orientation, assigned faces, the mesh, solved data and analysis
revision must remain unchanged. Check hit-target comfort with mouse/trackpad,
especially where endpoints overlap; drag/cancel must not trigger a face pick.

- Owner approved hover/depth behavior, Perspective switch, and graphical animated
  Reset view on 2026-09-07–08; revised UI accepted 2026-09-08.
- Owner response (2026-09-08): “Manual check passes.” Final requested polish:
  restore Solve accent color and align menus beside the title, status at right.
