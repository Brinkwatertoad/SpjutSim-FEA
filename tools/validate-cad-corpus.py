#!/usr/bin/env python3
"""Audit the committed CAD corpus manifest and fixture hashes."""

from __future__ import annotations

import pathlib
import sys

from cad_corpus import read_manifest, validate_manifest, validate_report


ROOT = pathlib.Path(__file__).resolve().parents[1]


def main() -> int:
    path = ROOT / "tests/fixtures/corpus-v1.json"
    manifest = read_manifest(path)
    errors = validate_manifest(manifest, ROOT)
    report_path = ROOT / "benchmarks/cad-corpus/chromium-152.json"
    if report_path.is_file():
        errors.extend(validate_report(read_manifest(report_path), manifest))
    if errors:
        for error in errors:
            print(f"{path}: {error}", file=sys.stderr)
        return 1
    print(f"Validated {len(manifest['entries'])} CAD corpus entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
