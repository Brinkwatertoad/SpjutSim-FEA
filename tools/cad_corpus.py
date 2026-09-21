"""Structural and hash validation for the fixed CAD regression corpus."""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
from typing import Any


FORMATS = {"step", "iges", "brep"}
CLASSIFICATIONS = {"accepted", "rejected"}
ERROR_CODES = {
    "INVALID_IMPORT_REQUEST", "GEOMETRY_IMPORT_FAILED", "GEOMETRY_NO_SOLID",
    "MULTIPLE_SOLIDS_UNSUPPORTED", "GEOMETRY_NOT_CLOSED", "IGES_UNITS_UNSUPPORTED",
}
REQUIRED_CATEGORIES = {"tiny", "thin", "hole", "fillet", "curved", "mixed-scale"}


def read_manifest(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def valid_range(value: Any, *, positive: bool = False) -> bool:
    return (
        isinstance(value, list) and len(value) == 2
        and all(isinstance(item, (int, float)) and not isinstance(item, bool) and math.isfinite(item) for item in value)
        and value[0] <= value[1] and (not positive or value[0] > 0)
    )


def validate_manifest(manifest: Any, root: pathlib.Path) -> list[str]:
    if not isinstance(manifest, dict):
        return ["manifest must be an object"]
    errors = []
    if manifest.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    entries = manifest.get("entries")
    if not isinstance(entries, list):
        return errors + ["entries must be an array"]
    ids = set()
    paths = set()
    valid_counts = {fmt: 0 for fmt in FORMATS}
    rejected_count = 0
    categories = set()
    for index, entry in enumerate(entries):
        prefix = f"entries[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{prefix} must be an object")
            continue
        fixture_id = entry.get("id")
        if not isinstance(fixture_id, str) or not fixture_id:
            errors.append(f"{prefix}.id is required")
        elif fixture_id in ids:
            errors.append(f"{prefix}.id is duplicated")
        ids.add(fixture_id)
        relative = entry.get("path")
        if not isinstance(relative, str) or not relative:
            errors.append(f"{prefix}.path is required")
        elif relative in paths:
            errors.append(f"{prefix}.path is duplicated")
        else:
            paths.add(relative)
            candidate = (root / relative).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                errors.append(f"{prefix}.path escapes the repository")
            else:
                if not candidate.is_file():
                    errors.append(f"{prefix}.path does not exist")
                elif hashlib.sha256(candidate.read_bytes()).hexdigest() != entry.get("sha256"):
                    errors.append(f"{prefix}.sha256 does not match")
        fmt = entry.get("format")
        if fmt not in FORMATS:
            errors.append(f"{prefix}.format is unsupported")
        if not isinstance(entry.get("license"), str) or not entry.get("license"):
            errors.append(f"{prefix}.license is required")
        if not isinstance(entry.get("provenance"), str) or not entry.get("provenance"):
            errors.append(f"{prefix}.provenance is required")
        if entry.get("sourceUnits") not in {"m", "mm"}:
            errors.append(f"{prefix}.sourceUnits is unknown")
        expected = entry.get("expected")
        classification = expected.get("classification") if isinstance(expected, dict) else None
        if classification not in CLASSIFICATIONS:
            errors.append(f"{prefix}.expected.classification is unknown")
            continue
        if classification == "accepted":
            valid_counts[fmt] = valid_counts.get(fmt, 0) + 1
            categories.add(entry.get("category"))
            for name in ("solidCount", "faceCount", "volumeM3", "boundsDiagonalM"):
                if not valid_range(expected.get(name), positive=name in ("volumeM3", "boundsDiagonalM")):
                    errors.append(f"{prefix}.expected.{name} is not a valid range")
            mesh = entry.get("mesh")
            if not isinstance(mesh, dict) or mesh.get("elementType") not in {"tet4", "tet10"}:
                errors.append(f"{prefix}.mesh contract is invalid")
            else:
                if not (isinstance(mesh.get("minSizeM"), (int, float)) and mesh.get("minSizeM") > 0 and mesh.get("maxSizeM") >= mesh.get("minSizeM")):
                    errors.append(f"{prefix}.mesh size range is invalid")
                for name in ("nodeCount", "elementCount", "gammaMinimum", "gammaP05", "maximumEdgeRatio"):
                    if not valid_range(mesh.get(name), positive=name in ("nodeCount", "elementCount", "maximumEdgeRatio")):
                        errors.append(f"{prefix}.mesh.{name} is not a valid range")
            if entry.get("remeshFaceIds") is not True:
                errors.append(f"{prefix}.remeshFaceIds must be true")
        else:
            rejected_count += 1
            if expected.get("stage") != "import" or expected.get("code") not in ERROR_CODES:
                errors.append(f"{prefix} rejection stage/code is unknown")
    if len(entries) < 50:
        errors.append("corpus requires at least 50 entries")
    for fmt, minimum in (("step", 18), ("iges", 8), ("brep", 8)):
        if valid_counts[fmt] < minimum:
            errors.append(f"corpus requires at least {minimum} accepted {fmt} entries")
    if rejected_count < 16:
        errors.append("corpus requires at least 16 rejected entries")
    if not REQUIRED_CATEGORIES <= categories:
        errors.append("corpus is missing required geometry categories")
    return errors


def validate_report(report: Any, manifest: Any) -> list[str]:
    if not isinstance(report, dict) or not isinstance(manifest, dict):
        return ["report and manifest must be objects"]
    errors = []
    expected_entries = {entry["id"]: entry for entry in manifest.get("entries", [])}
    rows = report.get("entries")
    if report.get("schemaVersion") != 1 or report.get("corpusId") != manifest.get("corpusId"):
        errors.append("report identity does not match manifest")
    if not isinstance(rows, list):
        return errors + ["report entries must be an array"]
    if report.get("entryCount") != len(rows) or report.get("agreementCount") != len(rows):
        errors.append("report does not claim complete agreement")
    initial_memory = report.get("runtime", {}).get("wasmMemoryBytes")
    peak_memory = report.get("peakMesherWasmBytes")
    if not isinstance(peak_memory, int) or peak_memory <= 0 or not isinstance(initial_memory, int) or peak_memory < initial_memory:
        errors.append("report peak mesher WASM memory is invalid")
    if {row.get("id") for row in rows if isinstance(row, dict)} != set(expected_entries):
        errors.append("report fixture IDs do not match manifest")
    for row in rows:
        if not isinstance(row, dict) or row.get("id") not in expected_entries:
            continue
        entry = expected_entries[row["id"]]
        expected = entry["expected"]
        if row.get("outcome") != expected["classification"]:
            errors.append(f"{row['id']} outcome does not match")
            continue
        if row["outcome"] == "rejected":
            diagnostic = row.get("diagnostic", {})
            if diagnostic.get("code") != expected.get("code") or diagnostic.get("stage") != expected.get("stage"):
                errors.append(f"{row['id']} diagnostic does not match")
            continue
        geometry = row.get("geometry", {})
        mesh = row.get("mesh", {})
        for observed, declared, label in (
            (geometry.get("faceCount"), expected.get("faceCount"), "faceCount"),
            (geometry.get("volumeM3"), expected.get("volumeM3"), "volumeM3"),
            (geometry.get("boundsDiagonalM"), expected.get("boundsDiagonalM"), "boundsDiagonalM"),
            (mesh.get("nodeCount"), entry["mesh"].get("nodeCount"), "nodeCount"),
            (mesh.get("elementCount"), entry["mesh"].get("elementCount"), "elementCount"),
            (mesh.get("gammaMinimum"), entry["mesh"].get("gammaMinimum"), "gammaMinimum"),
            (mesh.get("gammaP05"), entry["mesh"].get("gammaP05"), "gammaP05"),
            (mesh.get("maximumEdgeRatio"), entry["mesh"].get("maximumEdgeRatio"), "maximumEdgeRatio"),
        ):
            if not isinstance(observed, (int, float)) or not in_range(observed, declared):
                errors.append(f"{row['id']} {label} is outside its manifest range")
        if not isinstance(mesh.get("minimumJacobian"), (int, float)) or mesh.get("minimumJacobian") <= 0:
            errors.append(f"{row['id']} minimumJacobian must be positive")
    return errors


def in_range(value: float, declared: Any) -> bool:
    return valid_range(declared) and declared[0] <= value <= declared[1]
