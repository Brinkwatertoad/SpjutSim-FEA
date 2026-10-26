# Canonical palette and editor adoption — 2026-10-26

Spec tracking: not required: implementation ownership migration; product requirements, appearance, formats and preference keys are preserved.

The owner approved completing the remaining Integration 2 palette/editor duplication in Circuits and FEA, with before/after review and explicit approval for any intentional appearance change. Preserve unrelated app work. This batch uses ordinary disposable clones at Circuits 3699a0749e7b51bfee64bccaf65e02a3051b7310 and FEA 5bf2eca5973ca7892576e852881915b5c25bce8b; the original active app checkouts remain untouched.

- [x] Compare current implementations. Circuits' local library is byte-identical to canonical palette source. FEA's editor differs only in optional empty sections, which its complete role catalog does not use. FEA's palette presentation differs and remains app-owned.
- [x] Replace duplicate script loading with the already installed committed runtime artifact d64194e185d2371fd7394e33df88e482e10e6a1a122d75cc7a0a3399505b4085. Remove duplicate implementations and update real tool/test loaders, without compatibility stubs.
- [x] Keep FEA control/hover/selection derivation, contrast threshold, final override precedence and full-canvas validation in its existing adapter. Retain factory schemes, storage, import/export transactions, preview semantics and 3D color application.
- [x] Add failing-before/passing-after FEA regressions and compare 1,024 deterministic palettes/overrides against the pre-migration resolver.
- [x] Run complete applicable native and Kit gates, compare matching palette and ordinary workspace states, verify file/HTTP startup and record limitations.
- [x] Complete one final diff review and prepare exact app patches/evidence for owner review. No deployment or release tag is included.

The canonical runtime source and generated lock/files are unchanged; this promotes actual execution of existing pinned files. Registry adoption metadata identifies only Circuits and FEA as newly adopting these components. Truss, Statics, Math, website assets and 3D navigation have no changes in this batch. Never label this as completion of all Integration 2 or Integration 3 work.

Verification: Kit checks pass; FEA 56/56 harnesses in 128.515s; Circuits full gate in 204.649s (61/61 fast subtests, 14/14 native suites, 983/983 UI tests, 12/12 Chromium/WebKit digital workflows). Both apps pass direct-file startup/reload. Visual audit: 17 palette/editor states plus 12 workspace/menu states; 28/29 exact pixel matches and zero measured geometry/style changes. One FEA edited-palette view retains 29 raw rounded-edge pixels with maximum channel delta 2/255; no masks or tolerances hide them. Owner review is pending.
