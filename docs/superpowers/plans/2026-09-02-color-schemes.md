# Color schemes implementation plan

**Goal:** Apply persistent UI Kit-compatible factory and imported color schemes to the full FEA interface and Three.js semantic roles.

**Architecture:** Keep the copied UI Kit version-3 library contract unchanged. An FEA adapter supplies factory schemes, completes imported documents with required `fea` extension colors, maps resolved roles to CSS custom properties, and owns best-effort local persistence. A compact Appearance settings tab selects, imports, and exports schemes.

## Tasks

1. [x] Add contract tests for factory ordering, FEA extension fallback, portable v3 import/export, persistence fallback, and CSS application.
2. [x] Add FEA Classic, Light Mode, Dark Mode, and Vivid factory schemes using the shared eight authored roles.
3. [x] Map shared/derived roles and FEA load/support/X/Y/Z extensions to application CSS variables so viewport theme observation updates Three.js resources.
4. [x] Add Appearance settings controls for scheme selection and `.spjutsim-color-scheme.json` import/export.
5. [x] Update documentation, run the complete release gate, review, and commit.
