import copy
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "validation_records.py"


def load_module():
    spec = importlib.util.spec_from_file_location("validation_records", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def valid_record():
    return {
        "schemaVersion": 1,
        "caseId": "cantilever-bending",
        "caseRevision": 1,
        "geometrySha256": "a" * 64,
        "units": {
            "length": "m",
            "force": "N",
            "stress": "Pa",
            "energy": "J",
        },
        "solver": {
            "name": "CalculiX",
            "version": "2.22",
            "independent": True,
            "inputPath": "benchmarks/reference/calculix/cantilever-bending/case.inp",
            "inputSha256": "b" * 64,
            "rawOutputPath": "benchmarks/reference/calculix/cantilever-bending/case.dat",
            "rawOutputSha256": "c" * 64,
            "elementFormulation": "C3D10",
            "extractionMethod": "node set TIP and global ALL reaction sum",
        },
        "levels": [
            {
                "index": 0,
                "targetSizeM": 0.2,
                "nodeCount": 100,
                "elementCount": 40,
                "degreeOfFreedomCount": 300,
                "maximumDisplacementM": 1.0e-4,
                "strainEnergyJ": 0.5,
                "rawVonMisesMaxPa": 1.0e6,
            },
            {
                "index": 1,
                "targetSizeM": 0.14,
                "nodeCount": 200,
                "elementCount": 100,
                "degreeOfFreedomCount": 600,
                "maximumDisplacementM": 1.01e-4,
                "strainEnergyJ": 0.505,
                "rawVonMisesMaxPa": 1.02e6,
            },
        ],
        "convergence": {
            "status": "converged",
            "maximumDisplacementRelativeChange": 0.01,
            "strainEnergyRelativeChange": 0.01,
        },
        "comparisons": [
            {
                "metric": "tip-displacement",
                "probeId": "free-end-center",
                "fieldKind": "displacement",
                "spjutsimValue": 1.01e-4,
                "referenceValue": 1.0e-4,
                "relativeError": 0.01,
                "maximumRelativeError": 0.03,
                "passed": True,
            }
        ],
        "passed": True,
    }


class ValidationRecordTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_accepts_complete_independent_converged_record(self):
        self.assertEqual(
            [], self.module.validate_record(valid_record(), ROOT, check_files=False)
        )

    def test_rejects_nonfinite_and_wrong_units(self):
        record = valid_record()
        record["levels"][1]["strainEnergyJ"] = float("nan")
        record["units"]["stress"] = "MPa"
        errors = self.module.validate_record(record, ROOT, check_files=False)
        self.assertTrue(any("finite" in error for error in errors))
        self.assertTrue(any("units.stress" in error for error in errors))

    def test_rejects_loose_tolerance_and_inconsistent_pass(self):
        record = valid_record()
        record["comparisons"][0]["maximumRelativeError"] = 0.04
        record["comparisons"][0]["relativeError"] = 0.05
        errors = self.module.validate_record(record, ROOT, check_files=False)
        self.assertTrue(any("0.03" in error for error in errors))
        self.assertTrue(any(".passed is inconsistent" in error for error in errors))

    def test_rejects_smoothed_stress_and_unknown_probe(self):
        record = valid_record()
        comparison = record["comparisons"][0]
        comparison.update({
            "metric": "local-stress",
            "fieldKind": "smoothed-stress",
            "probeId": "missing-probe",
            "maximumRelativeError": 0.05,
        })
        manifest = {
            "caseId": "cantilever-bending",
            "revision": 1,
            "probes": [{"id": "free-end-center"}],
        }
        errors = self.module.validate_record(
            record, ROOT, manifest=manifest, check_files=False
        )
        self.assertTrue(any("raw-recovery-stress" in error for error in errors))
        self.assertTrue(any("missing-probe" in error for error in errors))

    def test_rejects_geometry_hash_that_differs_from_manifest(self):
        record = valid_record()
        manifest = {
            "caseId": "cantilever-bending",
            "revision": 1,
            "geometry": {"sha256": "b" * 64},
            "probes": [{"id": "free-end-center"}],
        }
        errors = self.module.validate_record(
            record, ROOT, manifest=manifest, check_files=False
        )
        self.assertTrue(any("geometrySha256" in error for error in errors))

    def test_rejects_passing_claim_without_two_converged_levels(self):
        record = valid_record()
        record["levels"] = record["levels"][:1]
        record["convergence"]["status"] = "unconverged"
        errors = self.module.validate_record(record, ROOT, check_files=False)
        self.assertTrue(any("two mesh levels" in error for error in errors))
        self.assertTrue(any("convergence.status" in error for error in errors))

    def test_accepts_global_convergence_with_unresolved_peak_stress(self):
        record = valid_record()
        record["convergence"] = {
            "status": "converged-stress-unresolved",
            "globalConverged": True,
            "stressStable": False,
        }
        self.assertEqual(
            [], self.module.validate_record(record, ROOT, check_files=False)
        )

    def test_repository_records_validate_through_cli(self):
        result = subprocess.run(
            ["python3", "tools/validate-validation-records.py"],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("validation record", result.stdout)

    def test_benchmark_step_generator_is_deterministic(self):
        generator = ROOT / "tools" / "generate-validation-geometry.py"
        with tempfile.TemporaryDirectory() as left, tempfile.TemporaryDirectory() as right:
            subprocess.run(["python3", str(generator), left], check=True, cwd=ROOT)
            subprocess.run(["python3", str(generator), right], check=True, cwd=ROOT)
            left_files = sorted(pathlib.Path(left).glob("*.step"))
            right_files = sorted(pathlib.Path(right).glob("*.step"))
            self.assertEqual(
                ["cantilever-prism.step", "notched-prism.step"],
                [path.name for path in left_files],
            )
            self.assertEqual(
                [path.read_bytes() for path in left_files],
                [path.read_bytes() for path in right_files],
            )
            self.assertIn("FACETED_BREP", left_files[0].read_text())

    def test_validation_browser_harness_covers_all_case_ids(self):
        html = (ROOT / "tests/browser/validation-benchmark-tests.html").read_text()
        script = (ROOT / "tests/browser/validation-benchmark-tests.js").read_text()
        for case_id in (
            "axial-traction",
            "cantilever-bending",
            "uniform-pressure",
            "gravity-reaction",
            "notched-prism-stress",
        ):
            self.assertIn(case_id, script)
        self.assertIn("gmsh-runtime-source-part-001.js", html)
        self.assertIn("fem-runtime-source.js", html)
        self.assertIn("__spjutsimValidationEvidence", script)
        self.assertIn("XMLHttpRequest", script)
        self.assertIn("validation/cases/", script)

    def test_calculix_deck_generator_is_deterministic(self):
        generator = ROOT / "tools" / "generate-calculix-reference.py"
        with tempfile.TemporaryDirectory() as left, tempfile.TemporaryDirectory() as right:
            subprocess.run(["python3", str(generator), left], check=True, cwd=ROOT)
            subprocess.run(["python3", str(generator), right], check=True, cwd=ROOT)
            left_files = sorted(pathlib.Path(left).glob("*/case.inp"))
            right_files = sorted(pathlib.Path(right).glob("*/case.inp"))
            self.assertEqual(5, len(left_files))
            self.assertEqual(
                [path.read_bytes() for path in left_files],
                [path.read_bytes() for path in right_files],
            )
            self.assertTrue(all(b"*ELEMENT, TYPE=C3D8" in path.read_bytes() for path in left_files))

    def test_normalized_record_builder_is_deterministic(self):
        builder = ROOT / "tools" / "build-validation-records.py"
        evidence = ROOT / "benchmarks/validation/spjutsim-browser-evidence.json"
        with tempfile.TemporaryDirectory() as left, tempfile.TemporaryDirectory() as right:
            subprocess.run(
                ["python3", str(builder), "--evidence", str(evidence), "--output", left],
                check=True,
                cwd=ROOT,
            )
            subprocess.run(
                ["python3", str(builder), "--evidence", str(evidence), "--output", right],
                check=True,
                cwd=ROOT,
            )
            left_files = sorted(pathlib.Path(left).glob("*.json"))
            right_files = sorted(pathlib.Path(right).glob("*.json"))
            self.assertEqual(5, len(left_files))
            self.assertEqual(
                [path.read_bytes() for path in left_files],
                [path.read_bytes() for path in right_files],
            )
            self.assertTrue(all(json.loads(path.read_text())["passed"] for path in left_files))

    def test_cli_rejects_tampered_record(self):
        record = copy.deepcopy(valid_record())
        record["solver"]["independent"] = False
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "record.json"
            path.write_text(json.dumps(record), encoding="utf-8")
            result = subprocess.run(
                [
                    "python3",
                    "tools/validate-validation-records.py",
                    "--record",
                    str(path),
                    "--no-file-checks",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
        self.assertNotEqual(0, result.returncode)
        self.assertIn("independent", result.stderr)


if __name__ == "__main__":
    unittest.main()
