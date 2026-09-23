# Plan 30: Portable projects implementation review

**Status:** Implemented; automated verification recorded, owner acceptance pending.
**Date:** 2026-09-22. **Branch:** `features/project-workflow-30-34`.

Versioned bounded stored-ZIP files preserve CAD, setup, assignment identity, orientation and counters. Opens stage a fresh CAD import and install atomically. Optional arrays have aggregate bounds, hashes and mesh/result compatibility checks.

## Evidence

Focused browser harnesses: project-file, project-workflow, project-interface, project-cad and report-workflow.

Real STEP/IGES/BREP round trips include rotations. Reopened STEP is meshed and solved against 1 kPa axial stress and −1,000 N equilibrium. Tests cover rejected mapping/corruption, cancellation, late edits, dirty revisions and setup-only cache fallback.

The [shared verification record](30-34-verification.md) records environment,
complete-suite results, allocation analysis, measured observations and exclusions.
[Project format](../project-format.md) defines durable/recovery boundaries.

## Limits and walkthrough

Cached convergence results from a different mesh cannot be bundled with the installed mesh. Save setup-only or regenerate/solve the current mesh. Maximum-size process memory and the owner bracket walkthrough remain open.

Follow the [plan's owner walkthrough](../plans/30-portable-projects.md#owner-walkthrough).
Owner response: **not yet supplied**. Do not infer acceptance from automated passes.
