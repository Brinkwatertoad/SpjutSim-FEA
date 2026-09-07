# UI foundation provenance

The files under `web/ui/` were copied from SpjutSim-UI-Kit as first-party project source, following its reference-merge model.

- Source: https://github.com/Brinkwatertoad/SpjutSim-UI-Kit
- Version: 0.7.1
- Peeled commit: `541c607c4b48520ed0e14b93106ec54ad3852461`
- Imported: 2026-08-25

On 2026-09-06 the copyright holder approved GPL-2.0-or-later for these copies
as part of SpjutSim FEA. See `LICENSE` and `docs/release/distribution-policy.md`.
This grant does not change the separate UI Kit repository's license. The
release manifest hashes the current FEA-owned copies; later FEA adaptations
are included in the corresponding application source.

The application owns all FEA state, commands, persistence, viewport rendering, and results. Generic UI helpers remain presentation/interaction-only.
