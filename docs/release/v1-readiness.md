# v1.0 readiness evidence

Status: **Unreleased — M21–M27 accepted; Plans 28–34 implemented/verified;
CAD-only scope verified. Owner review of 30–34, implementation of 35–37, final M38 acceptance and Task 20
exact-candidate audit remain open.**

The acceptance audit records the production Tet10 `file://` vertical slice,
five-case analytical/reference matrix, 50-part CAD corpus, and supported-browser
resource matrix as passing. Reproducible records are under `benchmarks/`;
`v1-acceptance-audit.md` describes their scope and browser versions.

The historical distribution gate passed: the owner approved GPL-2.0-or-later on 2026-09-06
and the final policy/artifact list on 2026-09-07. The source-accompanied stage
passed the exact-manifest audit at that checkpoint. Changes to the artifact
manifest require a fresh final release review; the CAD-only package is audited
separately without claiming renewed publication approval.

The owner removed STL from main and v1 on 2026-09-20; the archived work is
on [the archived branch](https://github.com/Brinkwatertoad/SpjutSim-FEA/tree/features/stl-import).
Complete the pre-v1 sequence in [the plan index](../plans/README.md), obtain
M38 integrated acceptance, then
run Task 20 against the final candidate, including the rebuilt Gmsh artifact,
before claiming v1.0 readiness. Task 19's focused rebuild/startup checks do
not replace the complete candidate acceptance matrix.

See `distribution-policy.md`, `artifact-manifest.json`, `SOURCE.md`, and
`reproducibility.md`. Website deployment must serve the staged source-accompanied
package.

No unchecked gate in `spec.md` section 26 should be interpreted as passing.

Post-v1 Plans 39–46 are prepared continuation plans and are not v1 release gates.

Plans 30–34 working-tree verification is recorded in [the batch review](../reviews/30-34-verification.md). This is not an exact release-candidate audit.
