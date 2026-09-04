import copy
import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "resource_records.py"


def load_module():
    spec = importlib.util.spec_from_file_location("resource_records", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def valid_record():
    phases = {
        "initial": 16_777_216,
        "inputLoaded": 18_000_000,
        "graphPreflight": 20_000_000,
        "assembly": 24_000_000,
        "solve": 25_000_000,
        "postprocess": 26_000_000,
    }
    return {
        "schemaVersion": 2,
        "recordedAt": "2026-09-04T12:00:00-04:00",
        "application": {"gitCommit": "a" * 40, "solverRuntimeSha256": "b" * 64},
        "browser": {"name": "Chromium", "version": "152.0", "launchMode": "file://"},
        "system": {"os": "Linux", "architecture": "x86_64", "logicalCores": 8, "memoryBytes": 16 * 2**30},
        "case": {"id": "axial-tet10-25k", "kind": "axial", "elementType": "tet10", "nodeCount": 25_000,
                 "elementCount": 14_000, "degreeOfFreedomCount": 75_000, "exactNnz": 3_200_000},
        "preflight": {"modelVersion": 1, "allocations": {"meshBytes": 1, "graphBytes": 2},
                      "modeledPeakBytes": 20_000_000, "safetyMultiplier": 1.5,
                      "predictedPeakBytes": 30_000_000, "wasmHeapCapBytes": 3_758_096_384},
        "observed": {"wasmMemoryByPhaseBytes": phases, "wasmMemoryHighWaterBytes": 26_000_000,
                     "jsHeapPeakBytes": None, "externalProcessPeakBytes": 29_000_000,
                     "mesherSolverOverlap": False},
        "solve": {"outcome": "passed", "preconditioner": "jacobi", "relativeTolerance": 1e-8,
                  "maximumIterations": 0, "iterations": 120, "finalRelativeResidual": 3e-9,
                  "phaseDurationMs": {"input": 10, "preflight": 20, "assembly": 30, "solve": 40, "postprocess": 15},
                  "wallTimeMs": 120},
        "cancellation": {"meshLatencyMs": 25, "solveLatencyMs": 30, "editAfterCancelPassed": True},
    }


class ResourceRecordTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_accepts_complete_conservative_schema_v2_record(self):
        self.assertEqual([], self.module.validate_record(valid_record()))

    def test_rejects_underprediction_and_nonmonotonic_high_water(self):
        record = valid_record()
        record["preflight"]["predictedPeakBytes"] = 25_000_000
        record["observed"]["wasmMemoryByPhaseBytes"]["assembly"] = 19_000_000
        errors = self.module.validate_record(record)
        self.assertTrue(any("underpredicts" in error for error in errors))
        self.assertTrue(any("monotonic" in error for error in errors))

    def test_rejects_missing_provenance_and_worker_overlap(self):
        record = valid_record()
        del record["application"]["solverRuntimeSha256"]
        record["observed"]["mesherSolverOverlap"] = True
        errors = self.module.validate_record(record)
        self.assertTrue(any("solverRuntimeSha256" in error for error in errors))
        self.assertTrue(any("overlap" in error for error in errors))

    def test_matrix_requires_three_repetitions_per_case_and_mode(self):
        records = [copy.deepcopy(valid_record()) for _ in range(2)]
        errors = self.module.validate_matrix(records)
        self.assertTrue(any("three repetitions" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
