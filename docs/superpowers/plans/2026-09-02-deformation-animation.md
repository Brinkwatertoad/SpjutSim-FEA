# Deformation Animation Implementation Plan

**Goal:** Add Truss-compatible, presentation-only animation from undeformed to the selected exaggerated deformation and back.

**Architecture:** A pure 2400 ms cosine multiplier helper feeds a small UI-owned requestAnimationFrame lifecycle. The selected deformation scale remains controller presentation state; animation sends only a transient multiplier directly to the viewport, whose effective position formula is `x + multiplier * scale * u`.

### Task 1: Pure animation and viewport multiplier

1. [x] Add failing tests for multiplier values 1, 0.5, 0, 0.5, 1 across the cycle and for effective result positions.
2. [x] Add a transient viewport animation multiplier that never mutates analysis state or revision.
3. [x] Reset the multiplier to one when animation stops.

### Task 2: Compact controls and lifecycle

1. [x] Add a Play/Stop toggle, range scale, and `xN` readout beside result-view controls.
2. [x] Default animation off, including under reduced motion; run a requestAnimationFrame loop only in Deformation view with current results.
3. [x] Stop when leaving Deformation, results become stale, controls disable, or viewport/UI disposes; pause while the document is hidden.
4. [x] Add browser tests for state, scale readout, mode transitions, reduced motion, and revision invariance.

### Task 3: Documentation and verification

1. [x] Update README, `spec.md`, and master-plan progress.
2. [x] Run Python, native, browser, and direct-file release checks; commit.
