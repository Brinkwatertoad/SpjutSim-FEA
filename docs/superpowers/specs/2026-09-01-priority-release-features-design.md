# Priority Release Features Design

**Status:** Approved design for implementation planning  
**Date:** 2026-09-01  
**Scope:** Priority authoring, import, viewport, constraint, migration, and appearance work required for the SpjutSim FEA release

## Goal

Extend the existing local-first FEA vertical slice with additional CAD formats,
model orientation, component-based translational supports, rigid-body stability
diagnostics, improved viewport communication, animated deformation, compact setup
editing, transactional setup transfer between models, and portable SpjutSim color
schemes.

This is alpha software with no compatibility obligation. Replace superseded
internal contracts directly. Do not add legacy readers, schema migrations,
aliases, or fallback normalization for the existing support representation.

## Release strategy

Implement the work contract-first so later UI and rendering features consume
stable application state:

1. Compact setup inspector and unified authoring selection.
2. Geometry formats and orientation.
3. Component-based translational supports and six-mode stability diagnostics.
4. Distributed 3D glyphs and the screen-fixed axis triad.
5. Deformation animation.
6. Transactional replacement-model remapping.
7. UI Kit-compatible color schemes and complete release verification.

The contracts should leave a clean seam for a future versioned project-document
system, but project save/load, command history, and general document migration
are outside this release.

## Architecture

`AnalysisDocument` remains the authoritative application state. Extend it with
explicit geometry-source metadata, a rigid model transform, component-based
support constraints, rigid-mode diagnostics, deformation-animation presentation
state, and active appearance preferences. Engineering state remains outside the
generic `/web/ui` helpers.

A format-neutral geometry contract handles STEP, IGES, and OpenCASCADE BREP.
Gmsh/OpenCASCADE remains the only import backend. Downstream code receives a
source format, opaque face identifiers, SI geometry metadata, and typed preview
buffers; it must not branch on Gmsh types or STEP-specific behavior.

Model orientation is a rigid transform with no scaling or reflection. Preview
rendering applies the transform directly. Meshing receives the same transform
and returns solver coordinates in the oriented global frame. Orientation
changes invalidate mesh and results but preserve material, supports, loads, and
face assignments. Face identifiers remain attached to the same CAD surfaces.

Loads, gravity, and support components are defined in global coordinates and do
not rotate with the part. Pressure remains surface-normal and therefore follows
the rotated surface.

A pure constraint-stability module evaluates the authored translational
constraints against the six infinitesimal rigid-body modes. The preview result
is advisory; the post-mesh result uses the actual constrained nodes. Native
solver/preconditioner diagnostics remain authoritative.

Rendering logic should produce testable scene descriptions for surface glyphs,
deformation animation, and the axis triad. `ViewportController` owns Three.js
materialization, updates, and disposal, not engineering decisions.

Replacement import is transactional. The active analysis remains intact while
a draft geometry and remapping session exist separately. Material and
geometry-independent settings transfer automatically. Each face-bound support
or load is mapped to new faces or explicitly dropped before acceptance.

Color-scheme compatibility follows the SpjutSim UI Kit portable scheme
document contract: `format: "spjutsim-color-schemes"`, version `3`. FEA-only
roles live under `extensions.fea`; numerical result contour maps remain separate
from interface themes.

## Import formats

The release accepts:

- STEP: `.step`, `.stp`
- IGES: `.iges`, `.igs`
- OpenCASCADE BREP: `.brep`

STL and OBJ remain deferred. They do not provide the durable CAD-face semantics
needed by the current support/load model and require a separate surface-patch
identity design.

The import request and retained source use neutral names such as `sourceBytes`
and `sourceFormat`. The geometry worker writes a temporary file with the correct
extension before invoking OpenCASCADE. Every format uses the same validation:
exactly one usable closed solid, valid bounds and volume where available,
enumerated opaque faces, preview triangles, face ranges, feature edges, and
actionable stable diagnostics.

The original source bytes and format remain available for remeshing. Direct
`file://` execution and disposable mesher-worker behavior remain mandatory.

## Model orientation

Model controls provide two operations:

1. Rotate around global X, Y, or Z by a user-entered angle. The default angle is
   90 degrees, and the user can apply either sign.
2. Orient one selected surface so its outward normal aligns with +X, -X, +Y,
   -Y, +Z, or -Z.

The orientation transform composes deterministically and remains orthonormal.
The selected-face operation uses the area-weighted outward normal. If the face
is sufficiently non-planar that a stable area-weighted direction is not
representative, use the deterministic representative surface normal and warn
the user before application. Reject a degenerate or non-finite normal with a
stable error code.

The shortest rotation aligns a valid face normal to the target direction. For
the antiparallel case, choose a deterministic perpendicular axis. Orientation
updates transformed bounds and invalidates mesh, preflight, and results.

## Supports and stability

Solid tetrahedral nodes retain their three translational degrees of freedom.
The release does not add rotational nodal DOFs, rigid-face multipoint
constraints, or rotational support inputs.

Each support independently enables any nonempty subset of global X, Y, and Z
translation. An enabled component has a prescribed displacement value in
meters; zero is the usual restraint. The UI offers `Fixed` as a shortcut that
enables X, Y, and Z with zero values, but the engineering contract has one
component-based support representation rather than separate fixed and
prescribed-displacement variants.

Users may therefore create X-only, Y-only, Z-only, any two-axis combination,
or all-axis supports. Nonzero prescribed values are allowed on every enabled
axis. Duplicate equal constraints are consolidated. Conflicting values on the
same solver DOF are preflight errors.

Rigid-body stability analysis constructs the six infinitesimal global modes at
the constrained points:

- Tx, Ty, Tz
- Rx, Ry, Rz

For each enabled component at each constrained point, add the corresponding
linear observation of those modes. Determine numerical rank with a small,
deterministic, scale-aware decomposition and tolerance. Report axis-aligned
modes as constrained or free when the null space permits that classification.
When remaining modes are coupled combinations, report the coupled freedom
rather than presenting a false per-axis answer.

Before mesh generation, use deterministic samples of selected CAD preview
surfaces and label the result provisional. After mesh generation, recompute
from the actual unique constrained mesh nodes and use that result in preflight.
Apparently free rigid modes create a visible warning. The solver still detects
singularity or loss of positive definiteness and provides the final diagnostic.

## Surface glyphs

Loads and supports render as sets of glyphs distributed across each selected
surface. Placement uses deterministic, area-aware triangle sampling rather than
the face bounding-box center. Target density is based on surface area and
viewport-relative spacing with explicit minimum and maximum counts. Every
nondegenerate selected face receives at least one glyph.

For every load arrow, the arrow tip touches the sampled surface point. Its shaft
extends opposite the applied direction. Pressure arrows point inward along the
local surface normal. Total-force arrows share the normalized global force
direction while their tips lie on the surface. Glyph count and size are visual
only and never encode load magnitude.

All load, gravity, and other vector arrows in the 3D view use a thin cylindrical
shaft and a conical head. Supports use the same semantic primitive family and
include compact axis cues so X/Y/Z component combinations are distinguishable.
Default load color is red; default support color is green. All colors resolve
through semantic theme roles rather than hard-coded renderer constants.

Repeated updates dispose replaced geometry and materials. Sampling and scene
description modules do not depend on Three.js, which permits deterministic
contract testing.

## Viewport axis triad

A small XYZ triad occupies a fixed viewport corner. It rotates with the camera
orientation but does not translate with the model or remain at the global
origin. X, Y, and Z use configurable semantic axis colors and concise labels.

The triad uses a dedicated overlay scene or equivalent camera-relative layer so
model pan, fit, and zoom do not move it. It remains legible against every
supported canvas background and does not intercept model picking.

## Deformation animation

The interaction matches SpjutSim Truss-2D:

- an animation enable/disable control;
- an adjustable exaggeration scale and `xN` readout;
- a 2400 ms cosine cycle from undeformed to maximum exaggeration and back;
- automatic stop when deformation display is hidden or results become stale.

At time `t`, animation supplies a normalized multiplier in `[0, 1]`; displayed
positions remain `x + animationMultiplier * deformationScale * u`. The active
effective scale remains visible. Animation is presentation-only and does not
change engineering state, results, or analysis revision.

Honor reduced-motion preferences by defaulting animation off. Pause while the
document is hidden. Cancel the animation-frame loop when disabled, when the
viewport is disposed, or when a non-deformed presentation becomes active.

## Compact setup inspector

The compact setup inspector is the highest-priority release feature and the
primary way to understand and revisit authored setup. The whole left pane is
named Setup; do not nest a second Setup panel within it. Keep ordinary model,
material, support, and load setup visible together without scrolling through
separate authoring sections.

The inspector contains:

- Model, including source format, orientation, and CAD import/replacement;
- Material, immediately below Model;
- Supports;
- Loads, including gravity when enabled.

Use compact grouped rows with stable item identifiers. The Model row includes
the source name/format and orientation summary; the Material row includes its
name and primary properties. Each support row
shows its X/Y/Z constrained components, prescribed values when nonzero, and face
count. Each simple load row shows pressure or force type, its value/vector with
units, and face count. Gravity appears as a load row when enabled. A typical
model with a material, a few supports, and a few simple loads must fit in the
normal tools-pane viewport without requiring page scrolling.

Selecting a support or surface load selects and highlights its faces and opens
that item's editor directly beneath or within the selected inspector row. The
user can modify, save, cancel, or delete the item there without finding a
separate section farther down the tools pane. Clicking an empty Model row opens
CAD import; after import, Model opens import/replacement and orientation actions
in the same region. Material independently opens the existing material editor.
Provide compact add
actions for supports and loads that open the corresponding editor in place.

The existing authoring controls may be reused internally, but there must be one
rendered source for each editable value and one controller command path. Do not
maintain duplicated inspector and legacy-form drafts. Once the inspector owns a
workflow, remove or collapse the superseded scattered section so the tools pane
does not present two competing editing surfaces.

The list reports support component summaries and the current Tx/Ty/Tz/Rx/Ry/Rz
stability assessment. Keyboard selection, focus visibility, accessible names,
and live status updates are required.

## Replacement-model migration

When an analysis already contains setup, importing a replacement offers a
`Replace and transfer setup` workflow. The existing analysis stays active and
unchanged until the user accepts the completed transfer.

The migration view displays old and new models side by side. It processes each
face-bound support/load in stable document order:

1. Highlight the item's old faces and show its type/components/value.
2. Let the user select corresponding faces on the new model.
3. Validate and record that mapping, or require an explicit `Drop` action.
4. Advance to the next item while preserving earlier draft mappings.

Material, gravity, mesh settings, solve settings, appearance preferences, and
orientation preferences transfer automatically where meaningful. Mesh,
preflight, results, transient selection, and convergence state never transfer.
Mapped pressure remains surface-normal. Global total-force, gravity, and
support component directions retain their numeric global values.

Before acceptance, show a summary of transferred and dropped items and any
validation errors. Acceptance atomically installs the new geometry and mapped
setup, then invalidates dependent mesh/results. Cancellation, import failure,
incomplete mapping, or invalid target faces discards only the draft and leaves
the original analysis usable.

## Color schemes

Copy and retain the UI Kit portable color-scheme contract as first-party source,
consistent with the repository's existing UI-foundation policy. Add an FEA-owned
adapter that defines factory schemes, persistence, application to CSS/Three.js,
and FEA extension defaults.

Include the current FEA appearance as one factory option plus selected existing
SpjutSim schemes from the current UI Kit/Circuits sources. Preserve the shared
eight authored roles and derived-role behavior. Store one active scheme ID and
one versioned library overlay. Resolve a stored ID through the active library so
missing or hidden schemes fall back safely.

FEA-only extension roles include at least:

- load;
- support;
- axis X;
- axis Y;
- axis Z.

Portable imports that omit these extensions receive deterministic host
fallbacks, including red loads and green supports. Imported/exported files use
the portable version-3 JSON document and `.spjutsim-color-scheme.json` naming.
Browser-storage failure must not prevent the active in-memory scheme from being
used.

Result contour colors are not theme roles. They retain field-specific numerical
meaning and a legend.

## Error handling

Add stable diagnostic codes and actionable messages for:

- unsupported extension or mismatched source format;
- empty or invalid source bytes;
- import failure and unsupported solid topology;
- invalid/non-finite orientation angle;
- degenerate or ambiguous face normal;
- support with no enabled component;
- non-finite prescribed displacement;
- conflicting prescribed values;
- provisional or confirmed underconstraint;
- missing or invalid replacement mapping;
- incomplete migration and explicitly dropped items;
- invalid/corrupt theme documents or unavailable persistence.

No solver fallback, item drop, geometry healing action, constraint conflict, or
theme substitution may be silent.

## Testing

Use test-driven development for every nontrivial behavior.

Pure browser tests cover format detection, neutral geometry contracts, rigid
transform composition, face-normal alignment, support validation, constraint
projection, rigid-mode rank classification, deterministic glyph placement,
animation timing, scheme projection, and migration transactions.

Gmsh-backed browser tests import representative STEP, IGES, and BREP solids and
verify one-solid enforcement, face mapping, orientation, remeshing, and the
direct-local packaging path.

Solver tests cover one-, two-, and three-axis supports, combined surfaces that
remove rotations, free and coupled rigid modes, duplicate equal constraints,
and conflicting prescribed values.

Renderer tests verify surface-contacting arrows, spacing/count bounds,
cylinder/cone primitives, semantic colors, axis-triad camera rotation, repeated
resource disposal, and animation-loop shutdown.

Migration tests cover complete mappings, explicit drops, incomplete mappings,
cancellation, import failure, invalid target faces, review summaries, and atomic
acceptance.

Theme tests exercise the portable version-3 contract, bundled schemes, active
selection, corrupt/unavailable persistence, FEA extension fallbacks, default red
loads, and default green supports.

Accessibility verification covers keyboard setup selection/editing, animation
controls, reduced motion, status announcements, side-by-side migration focus,
and readable semantic colors.

Before handoff, run the complete Python suite, native C++ build/CTest, every
applicable browser suite, Gmsh import/mesh fixtures, WASM solve/result tests, and
direct `file://` startup checks. Rebuild checked-in worker wrappers whenever
their worker sources change. Review the complete diff for data-contract drift,
main-thread mesh work, resource leaks, memory regressions, accessibility,
unintended generated/vendor changes, and deviations from this design.

## Documentation changes

Update `spec.md` to make STEP/IGES/BREP, component translational supports,
rigid-mode diagnostics, model orientation, setup transfer, improved glyphs,
axis triad, deformation animation, and portable themes release requirements.
Keep STL/OBJ, direct rotational constraints, and the full persisted project
document deferred.

Add prioritized implementation plans to `docs/plans/` and update
`docs/plans/README.md`. Update `README.md` when test commands, fixtures,
generated-runtime steps, or supported formats change.

## Release acceptance additions

The priority release work is accepted only when:

- STEP, IGES, and BREP pass the agreed single-solid regression fixtures;
- orientation operations produce consistent preview and solver coordinates;
- global force/gravity/support directions remain unchanged by model rotation;
- every nonempty X/Y/Z support combination reaches the solver correctly;
- provisional and post-mesh rigid-mode diagnostics identify known constrained
  and underconstrained fixtures;
- load arrows contact and distribute across selected surfaces;
- load/support default colors are red/green and all 3D arrows use cylinders and
  cones;
- the camera-relative XYZ triad remains fixed in a viewport corner;
- deformation animation matches the approved Truss-2D timing and lifecycle;
- the compact setup inspector is the first delivered slice, keeps ordinary
  model/material/support/load information visible together without page
  scrolling, and selects and edits every required item in place;
- replacement migration is cancellable and atomic, and supports explicit item
  drops with a review summary;
- portable schemes work across the included factory choices and imported files;
- direct-local launch, worker isolation, typed-array transfers, and existing FEA
  numerical acceptance behavior remain intact.
