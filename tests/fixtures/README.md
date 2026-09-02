# STEP import fixtures

`generated-unit-cube-m.step` is a hand-generated, public-domain STEP faceted
B-rep for a closed 1 m × 1 m × 1 m cube. It is maintained in this repository
as a regression fixture and has no third-party licensing restriction.

`generated-unit-cube-m.iges` and `generated-unit-cube-m.brep` are public-domain
OpenCASCADE exports of the same one-meter cube. The IGES file declares
millimeters and stores 1000-unit edges so explicit SI normalization is covered;
the unitless BREP fixture uses meter coordinates.

`invalid-step-text.step` is intentionally malformed input used to verify that
import errors are recoverable and user-facing.

`generated-two-unit-cubes-m.step` is a second public-domain generated fixture
containing two disconnected 1 m cubes, used to verify the single-solid limit.

`generated-cylinder-r0_5-h1-m.step` is a public-domain analytic STEP cylinder
with radius 0.5 m, height 1 m, volume `pi / 4 m^3`, three CAD faces, and two
true circular feature edges. `generated-sphere-r0_5-m.step` is a public-domain
analytic, multiply-curved sphere with radius 0.5 m, volume `pi / 6 m^3`, and
one CAD face. Both use millimetre STEP source units and are normalized to metres
by the import adapter.
