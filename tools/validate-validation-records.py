#!/usr/bin/env python3
"""Validate committed normalized validation records."""

from __future__ import annotations

import argparse
import pathlib
import sys

from validation_records import read_json, validate_record


ROOT = pathlib.Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", action="append", type=pathlib.Path)
    parser.add_argument("--no-file-checks", action="store_true")
    args = parser.parse_args()
    paths = args.record or sorted((ROOT / "benchmarks/validation/records").glob("*.json"))
    failures = 0
    for path in paths:
        record = read_json(path)
        manifest_path = ROOT / "benchmarks/validation/cases" / f"{record.get('caseId')}.json"
        manifest = read_json(manifest_path) if manifest_path.is_file() else None
        if manifest is None:
            failures += 1
            print(f"{path}: no manifest for case/revision", file=sys.stderr)
            continue
        errors = validate_record(
            record,
            ROOT,
            manifest=manifest,
            check_files=not args.no_file_checks,
        )
        if errors:
            failures += 1
            for error in errors:
                print(f"{path}: {error}", file=sys.stderr)
    if failures:
        return 1
    print(f"Validated {len(paths)} validation record(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
