# Resource benchmark records

Copy `resource-measurement-template.json` for each representative Tet4 or Tet10
browser run. Record the exact preflight and solver-statistics values returned by
the application, plus browser/version and wall time. External process peak
memory is optional because browser process accounting differs by platform.

The current multiplier remains the provisional, uncalibrated value of 1.5 and
the single-threaded WASM cap remains 3.5 GiB. The existing Chromium cube record
captures post-solve linear memory rather than peak memory, so it cannot fit or
validate the multiplier. Keep Task 13's calibration item open until a
representative Tet4/Tet10 supported-browser matrix captures peak WASM or
external process memory and the documented PCG cases have been measured.
