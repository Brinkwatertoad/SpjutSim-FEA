#!/usr/bin/env python3
"""Summarize a validated browser resource matrix for policy selection."""

from __future__ import annotations

import argparse
import json
import pathlib

from resource_records import summarize_matrix, validate_matrix


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("matrix", type=pathlib.Path)
    parser.add_argument("--margin", type=float, default=0.25)
    args = parser.parse_args()
    records = json.loads(args.matrix.read_text(encoding="utf-8"))
    errors = validate_matrix(records)
    if errors:
        print("\n".join(errors))
        return 1
    print(json.dumps(summarize_matrix(records, args.margin), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
