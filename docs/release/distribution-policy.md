# Distribution policy

SpjutSim FEA's first-party code, including the copied UI foundation files, is
licensed under **GPL-2.0-or-later**. The copyright holder approved this license
on 2026-09-06 and the final policy and artifact list on 2026-09-07.
The owner renewed publication approval on 2026-10-10, explicitly requesting the
color-scheme corrections, commit/sync, and publication of the current FEA work
using the existing procedure. They also requested automatic corresponding-source
updates as part of publishing while retained licenses require them. The updated
manifest records the UI integration provenance and automatic packaging recipe.
Dependencies and licenses are unchanged. This publication authorization does
not mark the separate v1 owner walkthrough and numerical acceptance complete.

Releases include the corresponding application and upstream source, build
instructions, and license notices. Third-party materials retain their own
licenses and exceptions. See [LICENSE](../../LICENSE),
[the artifact manifest](artifact-manifest.json), and
[the release procedure](SOURCE.md).

On October 28, 2026, the owner requested deployment of the approved shared UI revisions. The artifact inventory now records the selected generated 0.8.0 runtime separately from retained 0.7.1 references, removes retired local copies, and includes exact application/upstream sources. Dependencies, licenses and numerical artifacts are unchanged.

The distribution audit reads this approval record:

```json
{
  "schema_version": 1,
  "path": "gpl-source",
  "status": "approved",
  "license": "GPL-2.0-or-later",
  "approver": "Brinkwatertoad",
  "date": "2026-09-06",
  "approval_reference": "Task 19 owner licensing approval, 2026-09-06",
  "scope": "First-party FEA source, including the copied UI foundation files",
  "legal_review": "No independent legal review",
  "final_review": {
    "status": "approved",
    "approver": "Brinkwatertoad",
    "date": "2026-10-28",
    "reference": "Owner requested deployment of the approved shared UI revisions in this conversation; Statics excluded. Existing GPL/source policy, upstream pins and kernel artifacts unchanged.",
    "artifact_manifest_sha256": "a7dda309f61bc454a603108e9501d92804594cc4d79c35e664d9add807a1c6e6"
  }
}
```
