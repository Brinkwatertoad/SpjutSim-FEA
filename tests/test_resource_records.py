import copy
import importlib.util
import json
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
        "repetition": 1,
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

    def test_release_rejects_unsuccessful_repetitions(self):
        original = json.loads((ROOT / 'benchmarks/resource/matrix-v2.json').read_text())
        for outcome in ('failed', 'cancelled', 'preflight-blocked'):
            with self.subTest(outcome=outcome):
                records = copy.deepcopy(original)
                records[0]['solve']['outcome'] = outcome
                self.assertEqual([], self.module.validate_record(records[0]))
                errors = self.module.validate_matrix(records, require_release_coverage=True)
                self.assertTrue(any('successful solve' in error for error in errors))

    def test_passed_solve_must_meet_its_residual_tolerance(self):
        record = valid_record()
        record['solve']['finalRelativeResidual'] = 0.5
        self.assertTrue(any('residual' in error for error in self.module.validate_record(record)))
        record['solve']['finalRelativeResidual'] = 1e-8
        self.assertEqual([], self.module.validate_record(record))

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
        self.assertTrue(any("repetitions 1, 2, and 3" in error for error in errors))

    def test_matrix_rejects_duplicate_repetition_numbers(self):
        records = [copy.deepcopy(valid_record()) for _ in range(3)]
        errors = self.module.validate_matrix(records)
        self.assertTrue(any("repetitions 1, 2, and 3" in error for error in errors))

    def test_release_matrix_requires_every_case_in_supported_browser_modes(self):
        records = [copy.deepcopy(valid_record()) for _ in range(3)]
        errors = self.module.validate_matrix(records, require_release_coverage=True)
        self.assertTrue(any("missing release coverage" in error for error in errors))

        records = []
        modes = (("Chromium", "file://"), ("Chromium", "cross-origin-isolated-http"), ("Firefox", "file://"))
        definitions = (("axial-tet10-25k", "axial", "tet10"),
                       ("cantilever-tet10-75k", "cantilever", "tet10"),
                       ("mixed-scale-tet10-150k", "mixed-scale", "tet10"),
                       ("poor-quality-tet4", "poor-quality", "tet4"))
        for browser, mode in modes:
            for case_id, kind, element_type in definitions:
                for repetition in range(1, 4):
                    record = valid_record()
                    record["browser"].update(name=browser, launchMode=mode)
                    record["case"].update(id=case_id, kind=kind, elementType=element_type)
                    record["repetition"] = repetition
                    records.append(record)
        self.assertEqual([], self.module.validate_matrix(records, require_release_coverage=True))

    def test_summary_uses_worst_memory_and_median_time(self):
        records = []
        for wall, peak in ((100, 20_000_000), (300, 24_000_000), (200, 22_000_000)):
            record = valid_record()
            record["solve"]["wallTimeMs"] = wall
            record["observed"]["wasmMemoryHighWaterBytes"] = peak
            record["observed"]["wasmMemoryByPhaseBytes"]["postprocess"] = peak
            records.append(record)
        summary = self.module.summarize_matrix(records)
        self.assertEqual(200, summary["cases"]["axial-tet10-25k"]["medianWallTimeMs"])
        self.assertEqual(24_000_000, summary["cases"]["axial-tet10-25k"]["worstWasmMemoryHighWaterBytes"])
        self.assertEqual(1.5, summary["recommendedSafetyMultiplier"])

    def test_summary_does_not_lower_existing_multiplier_floor(self):
        records = [valid_record()]
        records[0]["observed"]["wasmMemoryHighWaterBytes"] = 20_000_000
        records[0]["observed"]["wasmMemoryByPhaseBytes"]["postprocess"] = 20_000_000
        summary = self.module.summarize_matrix(records, margin=0.1)
        self.assertEqual(1.5, summary["recommendedSafetyMultiplier"])


if __name__ == "__main__":
    unittest.main()
