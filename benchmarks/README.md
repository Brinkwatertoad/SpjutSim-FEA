# Resource benchmark records

Copy `resource-measurement-template.json` for each representative Tet4 or Tet10
browser run. Record the exact preflight and solver-statistics values returned by
the application, plus browser/version and wall time. External process peak
memory is optional because browser process accounting differs by platform.

The current multiplier remains 1.5 and the single-threaded WASM cap remains
3.5 GiB. Change either only when a supported-browser measurement matrix
demonstrates a safe fit.
