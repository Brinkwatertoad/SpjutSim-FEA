# Material library

The FEA library reuses `engineering-library-ui.js` from the local SpjutSim Truss
checkout at commit `5e5222fd2dd51f858cb791dafd623929c4b90742`. The unchanged shared
component is checked in as `web/js/ui/engineering-library.js`
(SHA-256 `4f04986a798b17b7a94dc8e1f9eff8e85aa53fd4b3021d1fd3dded362fc7759f`); its layout is ported
in `web/css/material-library.css`, using FEA theme variables. FEA-specific data,
validation, property units, and record editing live in `material-library-ui.js`.
No runtime connection to another checkout or external service is required.

The material dropdown has a Save icon followed by an Edit in library icon on the
same row. Save writes the current properties directly: it updates the selected
user entry (including after inline edits), or creates a uniquely named custom copy
of a built-in, retaining its metadata. Invalid input does not overwrite a record.
Edit in library opens the selected entry in the full editor; an unsaved custom
material opens a new entry seeded from the project. Project reopen and Undo resolve
the selector from the project snapshot rather than persisting a live library link.

The library uses FEA danger styling for Delete and accent styling for Use and
Save & Use. Its editor footer follows Truss: Cancel on the left, then a spacer,
Save and Save & Use on the right.

Material library opens a searchable table with Add, Copy & Modify, Edit, Delete,
and Use. Edit exposes all properties (including blank optional strengths), family,
standard, source, source URL, notes, and per-property source links. Factory records
are immutable: Edit displays their full record; Copy & Modify creates a user record.
Save modifies the reusable library; Use and Save & Use immediately assign an
independent project material snapshot. Project Undo does not modify library records.

Printed-material variability notes and model limitations stay in catalog metadata,
visible in the full editor. They are not repeated in the normal assignment panel.
Sources survive copy, editing unrelated fields, and browser-storage reload.
Untouched fields retain their original SI values instead of round-tripping through
display units, including when switching unit preferences before saving, avoiding
numerical drift and accidental citation removal. A
changed numerical property loses its inherited per-property citation; its new
source can be recorded in Source/Source URL and Notes. Links are opened only for
HTTP(S) URLs. Browser-storage failures leave records usable during the session and
show an explicit persistence error.

## Future cross-app exchange

Cross-app material import is not implemented. Keep an explicit adapter between the
shared record vocabulary and the existing FEA SI contract:

| Truss record | FEA material / metadata | Canonical units |
| --- | --- | --- |
| `id`, `name` | catalog ID, `material.name` | text |
| `E` | `material.youngsModulusPa` | Pa |
| `density` | `material.densityKgM3` | kg/m³ |
| `yieldStrength` | `material.tensileYieldPa` | Pa |
| `ultimateStrength` | `material.ultimateTensilePa` | Pa |
| `family`, `standard` | corresponding metadata fields | text |
| `source`, `sourceUrl`, `notes` | corresponding metadata fields | text |

FEA additionally requires `poissonsRatio`, and supports compressive strengths,
per-property provenance, and model-limitations text. Never invent a missing
Poisson ratio or turn a tensile allowable into a compressive allowable during
future imports. Shared numerical fields must use SI, independently of display
units. Import design must address ID namespaces, conflicts and unsupported fields
explicitly; the current nested FEA storage format is not a Truss interchange file.
The current schema-1 material storage remains backward compatible through optional
metadata fields. Legacy user records still load.

The reusable UI also supports section tabs and CSV/bulk actions in Truss. FEA does
not expose those actions until it has the corresponding validated data contracts.
