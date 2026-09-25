# Plan 35 review

- Status: **Pending owner review**; implementation and automated verification complete.
- Branch: `feature/35-local-directions-and-supports` (based on `41f8be2`). Native foundation: `a85ad2b`; application integration: `b393fe4`; verification and protocol-5 integration: `fc0c6ee`. The following documentation commit records this evidence.
- Environment: Ubuntu 24.04 / WSL Linux x86_64, GCC 13.3.0, CMake Release, Emscripten 3.1.74, Chromium 151.0.7922.34. Direct `file://` with local-file access and cross-origin-isolated `http://127.0.0.1:8000/`.
- Owner response/date: **Not yet received.** No release/publication authorization is inferred.

## Delivered behavior

Support and component-force editors offer global XYZ, a user-defined rectangular
frame that stays global, and a planar CAD frame that follows model orientation.
The editor preserves entered local components and shows resolved global directions
or force. Origins follow the selected length units while saved values remain SI.

Planar sliding/symmetry presets constrain local Z (the signed outward normal) to
zero and leave both tangential translations free. The explanation states the
symmetry assumption and that loads are not automatically scaled. Choose components
supports nonzero local prescribed values. Curved/unrecognized faces are rejected;
CAD Plane classification is required in addition to preview coplanarity.

Frames participate in drafts, cancellation, suppression, undo/redo, remeshing,
project save/reopen, recovery fingerprints, replacement review, glyphs, summaries,
and both report formats. Manual frames stay global after geometry rotation.
CAD frames remain canonical and resolve through the current geometry orientation.
Replacement maps CAD-attached assignments to exactly one planar face or explicitly
drops them, with rebuilt directions previewed before Apply. Older global-only
projects remain readable; new producer IDs prevent older apps from erasing local
meaning. Worker protocol 5 rejects older worker schemas.

Native constraints use per-node orthonormal bases and a symmetric congruence,
followed by symmetric elimination. Displacements and reactions return in global
coordinates. Dependent consistent conditions are consolidated; incompatible
conditions fail. Global-only solves allocate no bases and bypass the transform.
No penalty stiffness, axis approximation, extra global matrix, application
dependency, or native dependency on Gmsh was introduced.

## Verification and numerical evidence

- 77 Python tests pass, including reproducible worker wrappers and distribution audit.
- 10 native CTest executables pass. New tests cover rotation, nonzero local
  prescriptions, overlapping global/local constraints, dependent equal/conflicting
  conditions, numerical overflow, tangential underconstraint, C-ABI validation,
  direct matrix symmetry, and congruence energy preservation.
- All 44 ordinary browser harnesses pass on the final source. This includes the
  three new local-frame/workflow/UI harnesses and existing authoring, history,
  project/recovery, report/DOCX, constraint/solver, meshing, and viewport suites.
- The local workflow, local editor, worker protocol, and real project/CAD workflows
  also pass in HTTP mode. The local editor passes at 2× DPI, including choosing
  sliding before picking its face, origin-unit conversion, Cancel, and replacement
  review/cancellation. Screenshots were inspected for usable controls and layout.
- The 50-entry CAD corpus and five-case Tet10 validation matrix pass in HTTP mode.
  The existing normalized Section 16 records were regenerated from this run;
  `python3 tools/validate-validation-records.py` accepts all five records.
- Resource smoke cases pass in direct file and HTTP modes. This is a smoke check,
  not a replacement for the full multi-browser release resource matrix.
- Rebuilding FEM WASM and the three generated wrappers twice produces identical
  SHA-256 hashes. The artifact manifest includes the new first-party native files
  and refreshed build-input/runtime hashes; publication approval remains pending.

[Local numerical and basis benchmark records](../../benchmarks/validation/local-directions.json)
bind the evidence to source/runtime hashes. Native Tet4/Tet10 full and symmetry
half-bars cover both global and rotated frames, with explicit total loads of
1000 N and 500 N under equal 1000 Pa traction. Expected energies are 0.0005 J and
0.00025 J. Maximum native displacement error is below 4e-18 m and equilibrium
residual below 2e-12. Browser rotated Tet4/Tet10 cubes meet 1e-11 m displacement,
0.01 Pa stress, and 1e-7 relative equilibrium thresholds; signed global reactions
and all six signed-face arrows are checked. Nonzero prescriptions and conflicts
on intersecting meshed faces are exercised through real WASM.

The basis benchmark measures 100,000 affected nodes. Payload is 104 bytes per
node on this host, plus tree storage counted by memory preflight; global-only
input allocates no basis entries. Exact timings are in the record and are a
single-host measurement, not a portable performance guarantee. CSR topology
and exact nnz are unchanged by the transform.

## Reproduce and owner walkthrough

Run the README Python/CMake/CTest commands. Open
`tests/browser/local-frame-tests.html`, `local-support-ui-tests.html`, and
`local-support-workflow-tests.html` from the repository's browser-test directory.
The real workflow exposes `window.localSupportEvidence`; the native
`fem_local_symmetry_test` executable prints JSON lines for numerical and timing
records. Existing validation/resource/corpus harnesses retain their usual commands.

1. Import the unit cube, rotate it 37° about Z, and apply Planar sliding on an
   inclined face. Check the global normal preview, green direction arrows, and
   free tangential modes in the constraint display.
2. Use three orthogonal planar symmetry supports and a 1000 N local-Z force on
   the opposite axial face. With E = 1 GPa and ν = 0.25, expect 1e-6 m axial
   extension and approximately 1000 Pa axial/von Mises stress.
3. Rotate the model again, remesh, solve, save, and reopen. CAD directions should
   follow the part. A manual rectangular force frame should stay global.
4. Try a cylinder wall with Planar sliding, then incompatible prescriptions on
   intersecting cube faces. Expect actionable rejection, not a solved result.
5. Replace the CAD, review the newly mapped planar frame arrows, then Cancel;
   the original assignments should remain. Repeat and Apply if the mapping is right.

Known scope limits: planar CAD references only; no contact, friction, cylindrical
sliding, springs, or rigid connectors. Rectangular axes must be orthonormal and
right handed. Symmetry requires suitable geometry/loading selected by the user.
Full release browser/resource acceptance and owner walkthrough remain separate gates.

## Owner usability follow-up

The owner requested immediate edits/Undo, compact-row removal, rotation-based
frame entry, quieter information disclosures, and a library closely matching
SpjutSim Truss. See [implementation and verification](35-immediate-setup.md).
These changes supersede the earlier Apply/Cancel authoring walkthrough; numerical
frame contracts and the recorded numerical acceptance evidence are unchanged.
Owner acceptance of the revised interface remains pending.
