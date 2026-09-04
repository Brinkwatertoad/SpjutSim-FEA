#!/usr/bin/env python3
"""Normalize browser convergence evidence and CalculiX text references."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import re


ROOT = pathlib.Path(__file__).resolve().parents[1]
UNITS = {"length": "m", "force": "N", "stress": "Pa", "energy": "J"}


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative_error(actual: float, reference: float) -> float:
    return abs(actual - reference) / abs(reference)


def read_nodes(deck: str) -> dict[int, tuple[float, float, float]]:
    block = deck.split("*NODE\n", 1)[1].split("*ELEMENT", 1)[0]
    result = {}
    for line in block.splitlines():
        values = [part.strip() for part in line.split(",")]
        if len(values) == 4:
            result[int(values[0])] = tuple(float(value) for value in values[1:])
    return result


def printed_displacements(raw: str) -> dict[int, tuple[float, float, float]]:
    block = raw.split("displacements (vx,vy,vz) for set XMAX", 1)[1]
    block = block.split("\n\n forces ", 1)[0].split("\n\n total force ", 1)[0]
    result = {}
    for line in block.splitlines():
        values = line.split()
        if len(values) == 4 and values[0].isdigit():
            result[int(values[0])] = tuple(float(value) for value in values[1:])
    return result


def displacement_at(deck: str, raw: str, point: list[float], component: int) -> float:
    nodes = read_nodes(deck)
    displacements = printed_displacements(raw)
    node = min(
        displacements,
        key=lambda item: sum((nodes[item][axis] - point[axis]) ** 2 for axis in range(3)),
    )
    return abs(displacements[node][component])


def total_reaction(raw: str, set_name: str, component: int) -> float:
    pattern = rf"total force \(fx,fy,fz\) for set {set_name}.*?\n\s*\n\s*([^\n]+)"
    match = re.search(pattern, raw, re.DOTALL)
    if not match:
        raise ValueError(f"missing total reaction for {set_name}")
    return abs(float(match.group(1).split()[component]))


def raw_von_mises_values(raw: str) -> list[float]:
    block = raw.split("stresses (elem, integ.pnt.,sxx,syy,szz,sxy,sxz,syz)", 1)[1]
    values = []
    for line in block.splitlines():
        parts = line.split()
        if len(parts) != 8 or not parts[0].isdigit():
            continue
        sxx, syy, szz, sxy, sxz, syz = (float(value) for value in parts[2:])
        values.append(math.sqrt(
            0.5 * ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2)
            + 3 * (sxy ** 2 + sxz ** 2 + syz ** 2)
        ))
    if not values:
        raise ValueError("missing PROBE stress output")
    return values


def comparison(metric, probe, field, actual, reference, limit, source):
    error = relative_error(abs(actual), abs(reference))
    return {
        "metric": metric,
        "probeId": probe,
        "fieldKind": field,
        "spjutsimValue": abs(actual),
        "referenceValue": abs(reference),
        "referenceSource": source,
        "relativeError": error,
        "maximumRelativeError": limit,
        "passed": error <= limit,
    }


def build_record(case: dict, manifest: dict, reference_root: pathlib.Path) -> dict:
    case_id = case["caseId"]
    directory = reference_root / case_id
    deck_path = directory / "case.inp"
    raw_path = directory / "case.dat"
    deck = deck_path.read_text(encoding="ascii")
    raw = raw_path.read_text(encoding="ascii")
    final = case["levels"][-1]
    calc = "CalculiX 2.21 C3D8"
    comparisons = []

    if case_id in ("axial-traction", "uniform-pressure"):
        displacement = abs(final["displacementProbe"]["vectorM"][0])
        calc_displacement = displacement_at(deck, raw, [1, 0.5, 0.5], 0)
        comparisons.extend([
            comparison("axial-displacement", "loaded-face-center", "displacement", displacement, calc_displacement, 0.01, calc),
            comparison("reaction-balance", "support-resultant", "reaction", final["totalReactionN"][0], 1000, 0.001, calc),
            comparison("strain-energy", "loaded-face-center", "strain-energy", final["strainEnergyJ"], 0.5 * 1000 * calc_displacement, 0.03, calc),
        ])
        if case_id == "axial-traction":
            comparisons.append(comparison("axial-stress", "axial-interior", "raw-recovery-stress", final["rawVonMisesMaxPa"], sum(raw_von_mises_values(raw)) / 8, 0.01, calc))
    elif case_id == "cantilever-bending":
        displacement = abs(final["displacementProbe"]["vectorM"][2])
        calc_displacement = displacement_at(deck, raw, [4, 0.125, 0.25], 2)
        beam_theory = 1000 * 4 ** 3 / (3 * 1e9 * (0.25 * 0.5 ** 3 / 12))
        comparisons.extend([
            comparison("tip-displacement", "free-end-center", "displacement", displacement, calc_displacement, 0.03, calc),
            comparison("tip-displacement", "free-end-center", "displacement", displacement, beam_theory, 0.03, "Euler-Bernoulli closed form"),
            comparison("strain-energy", "free-end-center", "strain-energy", final["strainEnergyJ"], 0.5 * 1000 * calc_displacement, 0.03, calc),
        ])
    elif case_id == "gravity-reaction":
        comparisons.append(comparison("reaction-balance", "support-resultant", "reaction", final["totalReactionN"][2], 9810, 0.001, "CalculiX reaction plus constrained-node body load"))
    elif case_id == "notched-prism-stress":
        comparisons.extend([
            comparison("local-stress", "notch-interior", "raw-recovery-stress", final["rawStressProbe"]["valuePa"], raw_von_mises_values(raw)[-1], 0.05, "CalculiX raw PROBE integration point nearest the declared probe"),
            comparison("reaction-balance", "notch-interior", "reaction", final["totalReactionN"][0], total_reaction(raw, "XMIN", 0), 0.001, calc),
        ])
    else:
        raise ValueError(f"unknown validation case {case_id}")

    levels = []
    for index, level in enumerate(case["levels"]):
        normalized = dict(level)
        normalized["index"] = index
        levels.append(normalized)
    convergence = dict(case["convergence"])
    passed = len(levels) >= 2 and convergence.get("globalConverged") is True and all(item["passed"] for item in comparisons)
    geometry = manifest["geometry"]
    if case.get("caseRevision") != manifest["revision"]:
        raise ValueError(f"{case_id} evidence revision does not match its manifest")
    return {
        "schemaVersion": 1,
        "caseId": case_id,
        "caseRevision": manifest["revision"],
        "geometrySha256": geometry["sha256"],
        "units": UNITS,
        "fieldIdentities": {
            "displacement": "result.displacementM",
            "rawStress": "result.recoverySampleFields.vonMisesPa",
            "smoothedStress": "result.elementFields.vonMisesPa",
            "stressComparison": "rawStress",
        },
        "definition": {"material": manifest["material"], "load": manifest["load"], "supports": manifest["supports"]},
        "solver": {
            "name": "CalculiX CrunchiX",
            "version": "2.21",
            "independent": True,
            "inputPath": str(deck_path.relative_to(ROOT)),
            "inputSha256": sha256(deck_path),
            "rawOutputPath": str(raw_path.relative_to(ROOT)),
            "rawOutputSha256": sha256(raw_path),
            "elementFormulation": "C3D8 full integration",
            "extractionMethod": "XMAX node displacement, constrained reaction totals, and raw PROBE integration-point stress; see reference README",
        },
        "levels": levels,
        "convergence": convergence,
        "comparisons": comparisons,
        "passed": passed,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", type=pathlib.Path, default=ROOT / "benchmarks/validation/spjutsim-browser-evidence.json")
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "benchmarks/validation/records")
    args = parser.parse_args()
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    for case in evidence["cases"]:
        manifest = json.loads((ROOT / "benchmarks/validation/cases" / f"{case['caseId']}.json").read_text(encoding="utf-8"))
        record = build_record(case, manifest, ROOT / "benchmarks/reference/calculix")
        (args.output / f"{case['caseId']}.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
