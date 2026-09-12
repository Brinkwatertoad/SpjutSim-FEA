# M21: Workspace review

- Status: **Accepted 2026-09-08**.
- Implementation, browser, commands and shared solved fixture:
  [combined packet](21-23-review.md).
- Regression: sequence 500×400 → 1440×500 → 1440×900 previously left the canvas
  820 px high in a 458 px workspace. The initialized canvas now stays within
  its available row. Test also covers both panes collapsed, Results-only,
  narrow drawers, 2× DPI, keyboard splitters, focus return, malformed preferences
  and denied storage.
- Before: [1440×500](evidence/21-before-1440-500.png),
  [500×400](evidence/21-before-500-400.png), captured from the unchanged base commit.
- After, solved: [1440×500](evidence/21-23-solved-1440-500.png),
  [1440×900](evidence/21-23-solved-1440-900.png),
  [1000×700](evidence/21-23-solved-1000-700.png),
  [850×600](evidence/21-23-solved-850-600.png),
  [500×400](evidence/21-23-solved-500-400.png).

Resize at the five sizes above; try 125% and 200% browser zoom. Toggle each
pane, resize using pointer and focused splitter arrow keys/Home/End, and
collapse while focus is inside it. Reopen Results after closing it and changing
the camera. The choice should persist through redraws. At narrow widths, only
one pane is active; below 680 px dismiss the drawer to see the full canvas.
Check that gizmo, legend/probe and upper controls stay within their regions.

Expected: no page overflow, independent scrolling, usable model space and focus
returned to the corresponding toggle. Width preferences survive reload; empty
Results starts collapsed. Short-window controls and the result/probe stack may
scroll within their reserved areas. Compact drawers may temporarily cover the
canvas while open; 500×400 is robustness coverage, not mobile support.

- Owner requested the separate action bar on 2026-09-07, then Truss disclosure
  triangles and Solve beside Results on 2026-09-08; revised UI accepted 2026-09-08.
- Owner response (2026-09-08): “Manual check passes.” Final requested polish:
  restore Solve accent color and align menus beside the title, status at right.
