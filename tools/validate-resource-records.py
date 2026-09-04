#!/usr/bin/env python3
"""Validate committed schema-v2 browser resource evidence."""

from __future__ import annotations

import argparse
import json
import pathlib

from resource_records import validate_matrix


ROOT = pathlib.Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("matrix", nargs="?", type=pathlib.Path,
                        default=ROOT / "benchmarks/resource/matrix-v2.json")
    args = parser.parse_args()
    records = json.loads(args.matrix.read_text(encoding="utf-8"))
    errors = validate_matrix(records)
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Validated {len(records)} resource measurement records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
