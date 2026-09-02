# Distributed Surface Glyphs and Axis Triad Implementation Plan

**Goal:** Replace centroid markers with deterministic surface-contacting glyph sets and add a camera-rotating XYZ triad fixed to a viewport corner.

**Architecture:** Extend the pure analysis-glyph module to produce area-aware sample descriptors independent of Three.js. The viewport consumes those descriptors with one reusable cylinder-and-cone primitive builder. A dedicated orthographic overlay scene renders a themed XYZ triad after the main scene with depth cleared, so camera rotation affects it while model pan/zoom do not.

**Constraints:** Glyph density and size are visual only; every usable face gets at least one sample; load tips touch the surface; pressure follows local inward normals; total force remains global; supports expose enabled global axes; default semantic load/support colors are red/green; all replacement resources are disposed.

### Task 1: Deterministic distributed surface sampling

1. Add failing pure tests for minimum/maximum counts, area-sensitive density, deterministic repeatability, on-triangle positions, curved local normals, and per-face coverage.
2. Implement area tables and deterministic low-discrepancy barycentric samples with viewport-relative spacing and explicit caps.
3. Emit one descriptor per sample for support, pressure, and total-force items; keep gravity singular.

### Task 2: Cylinder-and-cone viewport primitives

1. Add failing WebGL assertions for load tips, primitive geometry types, support axis cues, semantic colors, magnitude-independent size, and disposal.
2. Replace `ArrowHelper` and centroid support cones with thin cylinder-and-cone groups positioned from tail to surface tip.
3. Render enabled support X/Y/Z cues with the same primitive family and support color.

### Task 3: Fixed-corner XYZ triad

1. Add failing viewport tests for a separate overlay scene/camera, X/Y/Z labels and semantic colors, fixed overlay position, and camera-relative rotation.
2. Create the orthographic overlay and labeled axis primitives during viewport construction.
3. Render main scene, clear depth, then render the triad; update only its inverse camera quaternion and preserve picking isolation.
4. Rebuild triad materials when the color scheme changes and dispose them with the viewport.

### Task 4: Documentation and verification

1. Update `spec.md`, README, and master-plan progress with sampling caps, contact convention, semantic defaults, and triad behavior.
2. Run Python, native, all browser suites, and direct-file startup; review generated/vendor boundaries and commit.
