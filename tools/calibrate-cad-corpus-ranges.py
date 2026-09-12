#!/usr/bin/env python3
"""Tighten corpus ranges around a pinned successful browser report."""

from __future__ import annotations

import argparse
import json
import math
import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[1]


def centered(value: float, fraction: float, floor: float = 0) -> list[float]:
    padding = max(abs(value) * fraction, 1e-15)
    return [max(floor, value - padding), value + padding]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "benchmarks/cad-corpus/chromium-152.json")
    parser.add_argument("--manifest", type=pathlib.Path, default=ROOT / "tests/fixtures/corpus-v1.json")
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    observations = {entry["id"]: entry for entry in report["entries"] if entry["outcome"] == "accepted"}
    for entry in manifest["entries"]:
        observed = observations.get(entry["id"])
        if not observed:
            continue
        geometry = observed["geometry"]
        mesh = observed["mesh"]
        entry["expected"]["faceCount"] = [geometry["faceCount"], geometry["faceCount"]]
        entry["expected"]["volumeM3"] = centered(geometry["volumeM3"], 1e-6)
        entry["expected"]["boundsDiagonalM"] = centered(geometry["boundsDiagonalM"], 1e-6)
        entry["mesh"]["nodeCount"] = [max(4, math.floor(mesh["nodeCount"] * 0.85)), math.ceil(mesh["nodeCount"] * 1.15)]
        entry["mesh"]["elementCount"] = [max(1, math.floor(mesh["elementCount"] * 0.85)), math.ceil(mesh["elementCount"] * 1.15)]
        entry["mesh"]["gammaMinimum"] = [max(0, mesh["gammaMinimum"] * 0.5), min(1, mesh["gammaMinimum"] * 1.5 + 1e-12)]
        entry["mesh"]["gammaP05"] = [max(0, mesh["gammaP05"] * 0.75), min(1, mesh["gammaP05"] * 1.25 + 1e-12)]
        entry["mesh"]["maximumEdgeRatio"] = [1, mesh["maximumEdgeRatio"] * 1.5]
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
