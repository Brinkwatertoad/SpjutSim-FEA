import importlib.util
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "cad_corpus.py"


def load_module():
    spec = importlib.util.spec_from_file_location("cad_corpus", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CadCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_release_manifest_and_files_are_valid(self):
        manifest = self.module.read_manifest(ROOT / "tests/fixtures/corpus-v1.json")
        self.assertEqual([], self.module.validate_manifest(manifest, ROOT))

    def test_committed_browser_report_agrees_with_manifest(self):
        manifest = self.module.read_manifest(ROOT / "tests/fixtures/corpus-v1.json")
        report = self.module.read_manifest(ROOT / "benchmarks/cad-corpus/chromium-152.json")
        self.assertEqual([], self.module.validate_report(report, manifest))

    def test_release_mix_has_required_coverage(self):
        manifest = self.module.read_manifest(ROOT / "tests/fixtures/corpus-v1.json")
        entries = manifest["entries"]
        valid = [entry for entry in entries if entry["expected"]["classification"] == "accepted"]
        rejected = [entry for entry in entries if entry["expected"]["classification"] == "rejected"]
        counts = {fmt: sum(entry["format"] == fmt for entry in valid) for fmt in ("step", "iges", "brep")}
        self.assertGreaterEqual(len(entries), 50)
        self.assertGreaterEqual(counts["step"], 18)
        self.assertGreaterEqual(counts["iges"], 8)
        self.assertGreaterEqual(counts["brep"], 8)
        self.assertGreaterEqual(len(rejected), 16)
        categories = {entry["category"] for entry in valid}
        self.assertTrue({"tiny", "thin", "hole", "fillet", "curved", "mixed-scale"} <= categories)

    def test_manifest_cli_passes(self):
        result = subprocess.run(
            ["python3", "tools/validate-cad-corpus.py"], cwd=ROOT,
            text=True, capture_output=True,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("50 CAD corpus entries", result.stdout)

    def test_browser_runner_is_wired_to_manifest(self):
        html = (ROOT / "tests/browser/cad-corpus-tests.html").read_text()
        script = (ROOT / "tests/browser/cad-corpus-tests.js").read_text()
        self.assertIn("corpus-v1.json", script)
        self.assertIn("new api.MesherClient", script)
        self.assertIn("__spjutsimCadCorpusReport", script)
        self.assertIn("gmsh-runtime-source-part-001.js", html)


if __name__ == "__main__":
    unittest.main()
