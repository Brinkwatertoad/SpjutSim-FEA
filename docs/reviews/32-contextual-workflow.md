# Plan 32: Contextual workflow implementation review

**Status:** Implemented; automated verification recorded, owner acceptance pending.
**Date:** 2026-09-22. **Branch:** `features/project-workflow-30-34`.

One contextual interface exposes mesh options directly on the Mesh row; Tet10 remains default. View-menu commands remain at the viewport. Apply and Save to material library are distinct. Nearby field errors, duplicate/suppress assignments, a fully prepared offline cube, dismissible viewport guide and Help reenable and explicit Mesh and solve are implemented.

## Evidence

Focused browser harnesses: contextual-workflow, assignment-draft, grouped-authoring, solve-workflow, solve-checks-ui, project-interface, project-resume, viewport-navigation and workspace-layout.

Tests cover suppression in solver/rank/history, duplicate independence, suppressed edits, prescribed-displacement readiness, failed-Apply focus, library-save separation, meshing cancellation/late replies and direct-local command paths.

The [shared verification record](30-34-verification.md) records environment,
complete-suite results, allocation analysis, measured observations and exclusions.
[Project format](../project-format.md) defines durable/recovery boundaries.

## Limits and walkthrough

The local example is one explained cube, not a model gallery. Automated viewport/theme checks are not novice discovery, physical zoom or assistive-technology acceptance. Toolbar arrangement and result mode interaction are retained.

Follow the [plan's owner walkthrough](../plans/32-contextual-workflow.md#owner-walkthrough).
Owner response: **not yet supplied**. Do not infer acceptance from automated passes.
