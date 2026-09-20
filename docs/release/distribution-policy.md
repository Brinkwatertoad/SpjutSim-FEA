# Distribution policy

SpjutSim FEA's first-party code, including the copied UI foundation files, is
licensed under **GPL-2.0-or-later**. The copyright holder approved this license
on 2026-09-06 and the final policy and artifact list on 2026-09-07.
The owner renewed publication approval on 2026-09-13 after accepting the stable
pane gutter correction and requesting deployment of the current FEA revision.
The updated manifest changes hashes for the copied scrollbar helper, UI tokens,
and UI foundation provenance. Dependencies and licenses are unchanged.

Releases include the corresponding application and upstream source, build
instructions, and license notices. Third-party materials retain their own
licenses and exceptions. See [LICENSE](../../LICENSE),
[the artifact manifest](artifact-manifest.json), and
[the release procedure](SOURCE.md).

On 2026-09-20 the owner approved adding a compact, modular CGAL/WASM repair
component with license compliance and a replaceable interface. The combined
application now uses **GPL-3.0-or-later** distribution terms, exercising the
existing GPL-2.0-or-later source grant. First-party files are not relicensed.
CGAL/Boost sources, notices and pinned build instructions accompany distribution.
This records dependency approval, not independent legal review or publication
approval. Final review of the changed artifact set remains pending.

The distribution audit reads this approval record:

```json
{
  "schema_version": 1,
  "path": "gpl-source",
  "status": "approved",
  "license": "GPL-3.0-or-later",
  "approver": "Brinkwatertoad",
  "date": "2026-09-20",
  "approval_reference": "Owner approved modular CGAL/WASM dependency subject to small install size and license compliance in the STL workflow conversation, 2026-09-20",
  "scope": "Combined application with CGAL adapter; first-party source remains GPL-2.0-or-later",
  "legal_review": "No independent legal review",
  "final_review": {
    "status": "pending",
    "reference": "Prior artifact approval does not cover the new repair dependency; no release or publication requested."
  }
}
```
