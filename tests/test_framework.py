import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class FrameworkTests(unittest.TestCase):
    def test_no_frontend_package_manifest(self):
        self.assertFalse((ROOT / 'package.json').exists())

    def test_direct_local_scripts_are_classic(self):
        html = (ROOT / 'web/index.html').read_text()
        self.assertNotIn('type="module"', html)
        self.assertNotIn('src="http', html)

    def test_ui_snapshot_and_worker_shells_exist(self):
        self.assertTrue((ROOT / 'web/ui/shell-behaviors.js').exists())
        self.assertTrue((ROOT / 'workers/mesher-worker.js').exists())
        self.assertTrue((ROOT / 'workers/solver-worker.js').exists())

if __name__ == '__main__':
    unittest.main()
