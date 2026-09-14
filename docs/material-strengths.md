# Polymer yield starting points

Reviewed 2026-09-13. The owner selected documented bulk defaults for the newly
added strengths. These are editable reference values, not certified allowables
or an FDM material qualification. Each field retains its own source in the catalog.

| Added field | Default | Evidence |
| --- | --- | --- |
| PLA tensile yield | 62 MPa | [NatureWorks Ingeo 3052D datasheet](https://www.natureworksllc.com/~/media/files/natureworks/technical-documents/technical-data-sheets/technicaldatasheet_3052d_injection-molding_pdf.pdf), p. 1, injection-molding grade, ASTM D638 typical yield |
| PLA compressive yield | 70.8 MPa | [Song et al., Materials & Design 123 (2017), 154–164](https://doi.org/10.1016/j.matdes.2017.03.051), [accepted manuscript](https://spiral.imperial.ac.uk/server/api/core/bitstreams/c34d2e00-a3ba-486b-8d40-77599a169575/content), table 4, row 16: moulded reference PLA at 1.25 × 10⁻⁵ s⁻¹; yield 70.80 MPa, distinct from maximum stress 73.86 MPa |
| ABS compressive yield | 46.1 MPa | [Dundar et al., Polymers and Polymer Composites (2021)](https://doi.org/10.1177/0967391120916619), table 2: bulk ABS uniaxial compression at 10⁻⁴ s⁻¹, ASTM D695-15 testing |

PLA's tensile and compressive defaults come from different grades/test conditions.
The ABS study reports true stress; its value is a small-strain screening input,
not an exact constitutive yield calibration. Existing elastic, density, ultimate,
and ABS tensile values are retained with their previous provenance; these catalog
entries are mixed-source generic starting points, not a matched material dataset.
Temperature, loading rate, processing and conditioning affect polymer properties.
Printed parts additionally depend on orientation, bonding, infill and defects.

The existing scalar von Mises yield FoS uses the lower available tensile/compressive
yield. Thus PLA uses 62 MPa; ABS retains its controlling 26.84 MPa tensile yield.
Ultimate strengths never substitute for yield. This linear-isotropic screen does
not model polymer pressure dependence, anisotropy, creep or post-yield response.
