# Priority gate: Improve selection and analysis authoring

## Outcome

Remove the current friction in face selection, support/load creation, and
material setup before continuing the numerical-feature roadmap. The viewport
has conventional deselection behavior, repeated support/load entry requires no
manual naming or type reselection, and the material tool provides reviewed
built-ins plus reusable user-defined materials.

## Implementation plan

1. **Selection clearing**
   - Extend viewport picking to distinguish a true primary-button background
     click from a camera drag and report a no-hit click to the UI/controller.
   - Clear `selectedFaceIds` on that background click and on an unconsumed
     application-level `Escape`, respecting modal/menu dismissal priority.
   - Keep clearing selection transient: do not remove analysis items, cancel an
     edit, invalidate results, or interfere with result probing.

2. **Support/load authoring flow**
   - Move each generated-item list below its add/edit form and feedback; keep
     gravity outside the face-load list.
   - Remove required name inputs. Generate `Support N` and `Load N` in the
     controller from independent monotonic sequences, retaining names through
     edits and never reusing deleted numbers.
   - Track the last add-mode support and load types separately. Editing may
     temporarily show an item's type, but add mode restores the remembered
     choice instead of resetting to fixed/pressure.
   - Preserve selection round-tripping from list items and current analysis
     invalidation behavior.

3. **Material catalog**
   - Add a small first-party catalog module with stable IDs and validated
     `IsotropicMaterial` payloads for Steel A36, Aluminum 6061-T6, PLA, ABS,
     ASA, PETG, TPU, and Nylon.
   - Follow the reviewed SpjutSim-Truss library architecture where it fits this
     single-material application: immutable factory records, stable IDs,
     base-SI normalization, optional Source/Source URL/Notes metadata, a
     separately validated User layer, generated `user.material.*` IDs, guarded
     local-storage reads, and copied document snapshots. Do not bring over the
     Truss section library, CSV workflow, factory overrides/hiding, or
     member-reference machinery.
   - Seed Steel A36 from the Truss record (`E = 200 GPa`, tensile yield
     `250 MPa`, ultimate tensile `400 MPa`, density `7850 kg/m³`) and Aluminum
     6061-T6 from its Truss record (`E = 69 GPa`, tensile yield `276 MPa`,
     ultimate tensile `310 MPa`, density `2700 kg/m³`). Preserve only properties
     actually present in those records; obtain reviewed Poisson's ratios and
     any additional FEA properties separately.
   - Obtain and record project-reviewed sources for PLA, ABS, ASA, PETG, TPU,
     and Nylon. The active Truss catalog contains none of these and its material
     schema does not define Poisson's ratio, so no requested preset is enabled
     until its complete FEA record has been reviewed. Do not invent missing
     numeric values or apply a partial record's provenance to added fields.
   - Default the chooser to Custom. Selecting a built-in previews its complete
     values and limitations, then applies a copied material snapshot through
     the existing controller validation/invalidation path.
   - Add browser-local persistence for named custom entries with schema/version
     validation, duplicate-name protection, explicit replace/remove actions,
     and actionable storage-failure feedback. A storage failure must not stop
     the material from being applied to the current analysis.
   - Show the linear-isotropic and variability warnings required by `spec.md`,
     particularly for printed polymers and TPU.

4. **Focused verification and final review**
   - Add browser regressions for empty-viewport click, `Escape`, drag
     suppression, and interaction-priority behavior.
   - Add authoring tests for DOM ordering, auto-name sequences, edit behavior,
     and independently remembered types.
   - Add catalog tests for all built-ins, exact reviewed metal seeds,
     field-level provenance, snapshot isolation, custom save/replace/remove,
     corrupt/unsupported stored data, and storage failure.
   - Run the analysis-authoring, preview-selection, viewport-navigation, and
     direct-local startup suites, then the complete applicable browser/native
     suite. Review the complete diff for invalidation, accessibility, direct
     `file://` behavior, and unintended generated/vendor changes.

## SpjutSim-Truss reference findings

The private `Brinkwatertoad/2D-Truss-Solver` repository was reviewed at commit
`42d9b00650f47297bd6dc3bf0e8ab3087590d303`. Its
[`engineering-libraries.js`](https://github.com/Brinkwatertoad/2D-Truss-Solver/blob/42d9b00650f47297bd6dc3bf0e8ab3087590d303/engineering-libraries.js)
and library-management design establish the patterns above. Its factory catalog
contains Steel A36 and Aluminum 6061-T6 records useful as partial FEA seeds, but
its active factory catalog contains no PLA, ABS, ASA, PETG, TPU, or Nylon records
and its active material schema does not include Poisson's ratio. A legacy
`Material_properties.csv` contains Poisson ratios for three metals, but the
Truss specification explicitly leaves its provenance, normalization, units, and
redistribution audit unfinished. It also conflicts with the active catalog—for
example, its Steel A36 ultimate tensile value is `480 MPa` rather than the active
record's `400 MPa`, and its Aluminum 6061-T6 strengths differ substantially.
That CSV is excluded as a source. The prior repository-access dependency is
resolved; sourcing the missing FEA-specific properties remains an explicit
catalog-data task.

## Done when

All three requested workflows satisfy the updated `spec.md`; the focused and
complete applicable tests pass in both supported launch modes; and no built-in
material is exposed with placeholder or unreviewed properties.
