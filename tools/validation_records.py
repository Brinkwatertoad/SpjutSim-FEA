"""Dependency-free validation for committed FEA benchmark evidence."""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
from typing import Any


SI_UNITS = {"length": "m", "force": "N", "stress": "Pa", "energy": "J"}
MAXIMUM_TOLERANCES = {
    "axial-displacement": 0.01,
    "axial-stress": 0.01,
    "reaction-balance": 0.001,
    "tip-displacement": 0.03,
    "strain-energy": 0.03,
    "local-stress": 0.05,
}
HEX_DIGITS = frozenset("0123456789abcdef")


def _is_sha256(value: Any) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and set(value.lower()) <= HEX_DIGITS
    )


def _walk_numbers(value: Any, path: str = "record"):
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, (int, float)):
        yield path, value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield from _walk_numbers(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_numbers(child, f"{path}[{index}]")


def _check_file(
    root: pathlib.Path, relative_path: Any, expected_hash: Any, label: str
) -> list[str]:
    errors = []
    if not isinstance(relative_path, str) or not relative_path:
        return [f"{label} path is required"]
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return [f"{label} path escapes the repository"]
    if not candidate.is_file():
        return [f"{label} file does not exist: {relative_path}"]
    actual = hashlib.sha256(candidate.read_bytes()).hexdigest()
    if actual != expected_hash:
        errors.append(f"{label} SHA-256 mismatch: {relative_path}")
    return errors


def _has_accepted_global_convergence(convergence: Any) -> bool:
    if not isinstance(convergence, dict):
        return False
    if convergence.get("status") == "converged":
        return True
    return (
        convergence.get("status") == "converged-stress-unresolved"
        and convergence.get("globalConverged") is True
        and convergence.get("stressStable") is False
    )


def validate_record(
    record: Any,
    root: pathlib.Path,
    *,
    manifest: dict[str, Any] | None = None,
    check_files: bool = True,
) -> list[str]:
    errors: list[str] = []
    if not isinstance(record, dict):
        return ["record must be an object"]
    if record.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if not isinstance(record.get("caseId"), str) or not record.get("caseId"):
        errors.append("caseId is required")
    if not isinstance(record.get("caseRevision"), int) or record.get("caseRevision", 0) < 1:
        errors.append("caseRevision must be a positive integer")
    if not _is_sha256(record.get("geometrySha256")):
        errors.append("geometrySha256 must be a lowercase SHA-256")

    units = record.get("units")
    if not isinstance(units, dict):
        errors.append("units object is required")
    else:
        for quantity, unit in SI_UNITS.items():
            if units.get(quantity) != unit:
                errors.append(f"units.{quantity} must be {unit}")

    for path, number in _walk_numbers(record):
        if isinstance(number, float) and not math.isfinite(number):
            errors.append(f"{path} must be finite")

    solver = record.get("solver")
    if not isinstance(solver, dict):
        errors.append("solver provenance is required")
    else:
        for field in ("name", "version", "elementFormulation", "extractionMethod"):
            if not isinstance(solver.get(field), str) or not solver.get(field):
                errors.append(f"solver.{field} is required")
        if solver.get("independent") is not True:
            errors.append("solver.independent must be true")
        for field in ("inputSha256", "rawOutputSha256"):
            if not _is_sha256(solver.get(field)):
                errors.append(f"solver.{field} must be a SHA-256")
        if check_files:
            errors.extend(
                _check_file(
                    root,
                    solver.get("inputPath"),
                    solver.get("inputSha256"),
                    "solver input",
                )
            )
            errors.extend(
                _check_file(
                    root,
                    solver.get("rawOutputPath"),
                    solver.get("rawOutputSha256"),
                    "solver raw output",
                )
            )

    levels = record.get("levels")
    if not isinstance(levels, list):
        errors.append("levels must be an array")
        levels = []
    if record.get("passed") is True and len(levels) < 2:
        errors.append("a passing record requires at least two mesh levels")
    convergence = record.get("convergence")
    if not isinstance(convergence, dict):
        errors.append("convergence is required")
    elif record.get("passed") is True and not _has_accepted_global_convergence(convergence):
        errors.append("a passing record requires accepted global convergence.status")

    known_probes = None
    if manifest is not None:
        if manifest.get("caseId") != record.get("caseId"):
            errors.append("record caseId does not match manifest")
        if manifest.get("revision") != record.get("caseRevision"):
            errors.append("record caseRevision does not match manifest")
        geometry = manifest.get("geometry")
        if not isinstance(geometry, dict):
            errors.append("manifest geometry is required")
        elif geometry.get("sha256") != record.get("geometrySha256"):
            errors.append("record geometrySha256 does not match manifest")
        if check_files and isinstance(geometry, dict):
            errors.extend(
                _check_file(
                    root,
                    geometry.get("path"),
                    geometry.get("sha256"),
                    "benchmark geometry",
                )
            )
        known_probes = {
            probe.get("id")
            for probe in manifest.get("probes", [])
            if isinstance(probe, dict)
        }

    comparisons = record.get("comparisons")
    if not isinstance(comparisons, list) or not comparisons:
        errors.append("comparisons must be a non-empty array")
        comparisons = []
    comparison_passes = True
    for index, comparison in enumerate(comparisons):
        prefix = f"comparisons[{index}]"
        if not isinstance(comparison, dict):
            errors.append(f"{prefix} must be an object")
            comparison_passes = False
            continue
        metric = comparison.get("metric")
        allowed = MAXIMUM_TOLERANCES.get(metric)
        limit = comparison.get("maximumRelativeError")
        error = comparison.get("relativeError")
        if allowed is None:
            errors.append(f"{prefix}.metric is unknown")
        elif not isinstance(limit, (int, float)) or limit > allowed:
            errors.append(f"{prefix} tolerance must be <= {allowed}")
        if not isinstance(error, (int, float)) or not math.isfinite(error):
            errors.append(f"{prefix}.relativeError must be finite")
            comparison_passes = False
        else:
            expected_pass = isinstance(limit, (int, float)) and error <= limit
            if comparison.get("passed") is not expected_pass:
                errors.append(f"{prefix}.passed is inconsistent with its error and limit")
            comparison_passes = comparison_passes and expected_pass
        if metric in ("axial-stress", "local-stress") and comparison.get("fieldKind") != "raw-recovery-stress":
            errors.append(f"{prefix}.fieldKind must be raw-recovery-stress")
        probe_id = comparison.get("probeId")
        if not isinstance(probe_id, str) or not probe_id:
            errors.append(f"{prefix}.probeId is required")
        elif known_probes is not None and probe_id not in known_probes:
            errors.append(f"{prefix}.probeId {probe_id!r} is not in the case manifest")
    if record.get("passed") is not (
        comparison_passes
        and len(levels) >= 2
        and _has_accepted_global_convergence(convergence)
    ):
        errors.append("record.passed is inconsistent with convergence/comparisons")
    return errors


def read_json(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=lambda value: float(value))
