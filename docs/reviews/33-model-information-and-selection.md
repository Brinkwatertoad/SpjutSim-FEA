# Plan 33: Model information and face access implementation review

**Status:** Implemented; automated verification recorded, owner acceptance pending.
**Date:** 2026-09-22. **Branch:** `features/project-workflow-30-34`.

Model displays dimensions, validated CAD volume and mass from active density before solving. Pick-through, hide/isolate and Show all operate on Model/Mesh faces. Existing assignment rows reveal and locate assigned faces; no full face catalog is added.

## Evidence

Focused browser harnesses: model-information, face-access, project-cad, result-presentation and report-workflow.

Analytical box/cylinder volume/mass and SI/USCS conversion checks pass. Real cylinder/through-hole picking exercises occluded faces and hidden-face exclusion. Visibility is presentation-only and resets on model replacement.

The [shared verification record](30-34-verification.md) records environment,
complete-suite results, allocation analysis, measured observations and exclusions.
[Project format](../project-format.md) defines durable/recovery boundaries.

## Limits and walkthrough

Feature-edge polylines are temporarily hidden during isolation because they have no per-face ownership. Result surfaces are not hidden by these controls. Large-model picking and owner tiny-face/keyboard interaction remain review work.

Follow the [plan's owner walkthrough](../plans/33-model-information-and-selection.md#owner-walkthrough).
Owner response: **not yet supplied**. Do not infer acceptance from automated passes.
