# M22: Result clarity review

- Status: **Accepted 2026-09-08**.
- Implementation, browser, checks and both solved cases:
  [combined packet](21-23-review.md).
- Example: [constrained peak marker and headline](evidence/22-constrained-peak.png).
- Boundary range regression: values `[10,20,30,999]`, boundary `[0,1,2]` yield
  surface maximum 30; the interior 999 remains in the engineering arrays.
  Shared nodes, signed fields, invalid boundaries, nonfinite data, metadata
  contradictions, uncapped/capped FoS, zero stress and small numbers are covered.

Use the uniform case and then the fixed-face constrained case. Identify the
number used for yield FoS, confirm the color key ends at the sample peak even
when the surface does not reach that color, and expand “How to read these results” to check the two averaging stages.
Locate peak: the marker identifies the actual undeformed interior recovery
sample and remains visible through the surface. Camera orientation is retained;
the target moves to the sample. The nearby face hint is never called the sample
location. For the constrained fixture the sample is at
`[0.03783671867096515, 0.988759229615907, 0.011240770384093074]` m.

Review the convergence/singularity context and scientific notation for tiny
reactions. Remove yield strength, recheck/solve, and confirm FoS is unavailable
while stress remains available. The old peak location must disappear after
engineering edits or when switching result objects.

Raw samples and the smoothing algorithm are unchanged. Boundary-only contour
range/locations and FoS postprocessing are new claims; historical reports that
used whole-node display extrema do not certify these corrected display values.
The five numerical validation cases were rerun, while exact base/current array
comparisons cover Tet4 and both Tet10 examples in the packet. A sampled maximum
is not an exact continuum maximum, and one solve does not establish safety.

- Owner approved the quiet zero-to-model-sample-peak legend on 2026-09-07.
  Hover exposes the smoothed surface maximum; revised UI accepted 2026-09-08.
- Owner response (2026-09-08): “Manual check passes.” Final requested polish:
  restore Solve accent color and align menus beside the title, status at right.
