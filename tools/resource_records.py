"""Validation and analysis for browser resource benchmark records."""

from __future__ import annotations

import collections
import math
import statistics
from typing import Any


PHASES = ("initial", "inputLoaded", "graphPreflight", "assembly", "solve", "postprocess")
KINDS = {"axial", "cantilever", "mixed-scale", "poor-quality"}
LAUNCH_MODES = {"file://", "cross-origin-isolated-http"}


def _positive(value: Any, *, allow_zero: bool = False) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and (value >= 0 if allow_zero else value > 0)


def _hash(value: Any, length: int) -> bool:
    return isinstance(value, str) and len(value) == length and set(value.lower()) <= set("0123456789abcdef")


def validate_record(record: Any) -> list[str]:
    if not isinstance(record, dict):
        return ["record must be an object"]
    errors = []
    if record.get("schemaVersion") != 2:
        errors.append("schemaVersion must be 2")
    app = record.get("application", {})
    if not _hash(app.get("gitCommit"), 40):
        errors.append("application.gitCommit must be a Git SHA-1")
    if not _hash(app.get("solverRuntimeSha256"), 64):
        errors.append("application.solverRuntimeSha256 must be a SHA-256")
    browser = record.get("browser", {})
    for field in ("name", "version"):
        if not isinstance(browser.get(field), str) or not browser.get(field):
            errors.append(f"browser.{field} is required")
    if browser.get("launchMode") not in LAUNCH_MODES:
        errors.append("browser.launchMode is unsupported")
    system = record.get("system", {})
    for field in ("os", "architecture"):
        if not isinstance(system.get(field), str) or not system.get(field):
            errors.append(f"system.{field} is required")
    for field in ("logicalCores", "memoryBytes"):
        if not _positive(system.get(field)):
            errors.append(f"system.{field} must be positive")
    case = record.get("case", {})
    if case.get("kind") not in KINDS:
        errors.append("case.kind is unsupported")
    if case.get("elementType") not in {"tet4", "tet10"}:
        errors.append("case.elementType is unsupported")
    for field in ("nodeCount", "elementCount", "degreeOfFreedomCount", "exactNnz"):
        if not _positive(case.get(field)):
            errors.append(f"case.{field} must be positive")
    if _positive(case.get("nodeCount")) and case.get("degreeOfFreedomCount") != case["nodeCount"] * 3:
        errors.append("case.degreeOfFreedomCount must equal three times nodeCount")
    preflight = record.get("preflight", {})
    allocations = preflight.get("allocations")
    if not isinstance(allocations, dict) or not allocations or not all(_positive(v, allow_zero=True) for v in allocations.values()):
        errors.append("preflight.allocations must contain finite byte counts")
    for field in ("modeledPeakBytes", "safetyMultiplier", "predictedPeakBytes", "wasmHeapCapBytes"):
        if not _positive(preflight.get(field)):
            errors.append(f"preflight.{field} must be positive")
    if _positive(preflight.get("modeledPeakBytes")) and _positive(preflight.get("safetyMultiplier")):
        expected = math.ceil(preflight["modeledPeakBytes"] * preflight["safetyMultiplier"])
        if preflight.get("predictedPeakBytes") != expected:
            errors.append("preflight.predictedPeakBytes is inconsistent with the model")
    observed = record.get("observed", {})
    phase_values = observed.get("wasmMemoryByPhaseBytes", {})
    if not isinstance(phase_values, dict) or any(not _positive(phase_values.get(phase)) for phase in PHASES):
        errors.append("observed.wasmMemoryByPhaseBytes is incomplete")
    else:
        values = [phase_values[phase] for phase in PHASES]
        if values != sorted(values):
            errors.append("WASM high-water measurements must be monotonic")
        if observed.get("wasmMemoryHighWaterBytes") != max(values):
            errors.append("wasmMemoryHighWaterBytes must equal the phase maximum")
    if observed.get("mesherSolverOverlap") is not False:
        errors.append("mesher/solver memory overlap is forbidden")
    peak = max(filter(_positive, (observed.get("wasmMemoryHighWaterBytes"), observed.get("externalProcessPeakBytes"))), default=0)
    if _positive(preflight.get("predictedPeakBytes")) and peak > preflight["predictedPeakBytes"]:
        errors.append("predictedPeakBytes underpredicts the observed high-water")
    solve = record.get("solve", {})
    if solve.get("outcome") not in {"passed", "failed", "cancelled", "preflight-blocked"}:
        errors.append("solve.outcome is unsupported")
    if solve.get("preconditioner") != "jacobi":
        errors.append("solve.preconditioner must record the selected path")
    for field in ("relativeTolerance", "iterations", "finalRelativeResidual", "wallTimeMs"):
        if not _positive(solve.get(field), allow_zero=field in {"iterations", "finalRelativeResidual"}):
            errors.append(f"solve.{field} is invalid")
    durations = solve.get("phaseDurationMs")
    if not isinstance(durations, dict) or any(not _positive(durations.get(phase), allow_zero=True) for phase in ("input", "preflight", "assembly", "solve", "postprocess")):
        errors.append("solve.phaseDurationMs is incomplete")
    cancellation = record.get("cancellation", {})
    if any(not _positive(cancellation.get(field), allow_zero=True) for field in ("meshLatencyMs", "solveLatencyMs")):
        errors.append("cancellation latency measurements are required")
    if cancellation.get("editAfterCancelPassed") is not True:
        errors.append("edit-after-cancel recovery must pass")
    return errors


def validate_matrix(records: Any) -> list[str]:
    if not isinstance(records, list):
        return ["resource matrix must be an array"]
    errors = []
    groups = collections.Counter()
    for index, record in enumerate(records):
        errors.extend(f"records[{index}]: {error}" for error in validate_record(record))
        if isinstance(record, dict):
            groups[(record.get("browser", {}).get("name"), record.get("browser", {}).get("launchMode"), record.get("case", {}).get("id"))] += 1
    for group, count in groups.items():
        if count < 3:
            errors.append(f"{group} requires three repetitions")
    return errors


def summarize_matrix(records: list[dict[str, Any]], margin: float = 0.25) -> dict[str, Any]:
    """Return conservative calibration statistics without selecting best runs."""
    ratios = [record["observed"]["wasmMemoryHighWaterBytes"] / record["preflight"]["modeledPeakBytes"] for record in records]
    by_case: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for record in records:
        by_case[record["case"]["id"]].append(record)
    selected = max(1.0, math.ceil((max(ratios) + margin) * 10) / 10)
    return {
        "recordCount": len(records),
        "maximumWasmToModeledRatio": max(ratios),
        "recommendedSafetyMultiplier": selected,
        "margin": margin,
        "cases": {
            case_id: {
                "medianWallTimeMs": statistics.median(row["solve"]["wallTimeMs"] for row in rows),
                "worstWasmMemoryHighWaterBytes": max(row["observed"]["wasmMemoryHighWaterBytes"] for row in rows),
                "maximumIterations": max(row["solve"]["iterations"] for row in rows),
            }
            for case_id, rows in sorted(by_case.items())
        },
    }
