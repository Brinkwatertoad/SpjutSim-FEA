# STL surface repair

Owner-authorized import follow-up, implemented inline on the existing feature
branch. Keep all existing import/meshing methods and source validation.

1. Separate strict source decoding from solid validation without weakening parse.
   Add a worker-only local repair module: exact duplicates/zero-area faces,
   isolated stray faces, consistent outward winding, and small strictly convex
   planar boundary loops. Never move vertices, weld, discard components or join
   parts. Limit hole diameter to a reviewed fraction of the model diagonal.
2. Add a versioned, cancellable `stl-repair` request returning validated candidate
   bytes and a bounded change report. Reparse serialized output through every
   existing solid check. Keep 16 MiB/200k-triangle/120-second work limits.
3. Offer repair after relevant import diagnostics. Preview the repaired source
   through the normal review, require explicit import, retain original bytes and
   report through replacement/regrouping, and support discard/download original.
   Reject stale repair responses and mismatched candidate fingerprints.
4. Test repair kernels, limits and refusals; worker/client/controller contracts;
   real UI cancellation/review; repaired-source mesh/analytical solve; supplied
   gargoyle diagnosis; file/HTTP packaging and the complete applicable suites.
5. Update product contracts, build hashes and evidence; review the complete diff.

Local repairs are the stated recommended scope pending optional user steering.
Approximate whole-shape rebuilding and new geometry dependencies are excluded.

Completed inline. Implementation, limits and verification are recorded in
[the repair review](../reviews/29-stl-surface-repair.md).
