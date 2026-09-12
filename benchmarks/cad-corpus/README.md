# CAD corpus browser evidence

`chromium-152.json` is the 2026-09-04 HTTP-mode report from Chrome Headless
Shell 152.0.7977.82 using the embedded serial Gmsh 5.0.0/OpenCASCADE runtime.
All 50 manifest classifications agree: 34 valid files imported, meshed twice,
kept stable CAD FaceIds, and had positive sampled Jacobians; 16 intentional
failures returned their declared structured code and stage.

The accepted matrix's lowest gamma was 0.0005707 in the 20 mm thin STEP plate;
its fifth percentile was 0.3289 and all Jacobians were positive. The existing
0.1 gamma warning correctly calls attention to its 15 locally poor elements
without treating the usable mesh as invalid, so Task 17 retains the threshold.
Invalid or near-zero Jacobians remain hard errors. Total observed case time was
about 53.3 seconds; peak observed mesher WASM memory was 64 MiB. These mesher values
do not calibrate solver-memory thresholds.


`chromium-152-stl.json` is the M29 direct-file run in Chromium 152.0.7977.75.
It supplements the historical report with 18 CC0 STL fixtures (six valid and
twelve rejected), preserving all original 50 CAD expectations. All 68 agree.
Each case uses a fresh worker; the harness reloads after 24 cases with a
manifest-checked session checkpoint. Chromium deferred collection of terminated
worker objects in an uninterrupted 68-case run; the batched run passes without
forced GC. Source/topology limits and analytical STL solves are documented in
`docs/reviews/29-stl-workflow.md`. This is development evidence, not M29 or v1
owner acceptance.
