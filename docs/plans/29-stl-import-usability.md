# STL import usability and capacity follow-up

Continue on `feat/28-29-stl-import`, implementing the owner's request inline.
No new dependencies, automatic repair, or redistribution of supplied STL files.

1. Exercise a valid 200,000-triangle source through import and a simplified
   simulation mesh. Raise parser/model limits together; retain 16 MiB, 512
   surfaces, 2 million intersection candidates and 120-second worker deadlines.
2. Make units and dimensions the primary review flow. Automatically review on
   unit selection, put existing surface/grouping controls in advanced options,
   and provide explicit original-triangle recovery after reconstruction failure.
   Preserve review invalidation, cancellation and assignment transfer.
3. Show source complexity before review when the binary header provides it,
   and warn before meshing detailed STL models without claiming a calibrated ETA.
4. Reproduce the supplied gargoyle's topology failure separately from capacity.
   Keep validation strict and give an actionable repair diagnostic.
5. Run focused regressions, complete applicable suites and file/HTTP startup;
   review the final diff and update product contracts and measured evidence.

Default surface choice: original STL preview, with reconstruction/remeshing
opt-in; no automatic mode fallback. Optional clarification received no response
before implementation; the recommended default was stated before proceeding.

Implemented and verified; measured outcomes and limitations are recorded in
[the review packet](../reviews/29-stl-import-usability.md).
