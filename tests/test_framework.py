import hashlib
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class FrameworkTests(unittest.TestCase):
    def test_no_frontend_package_manifest(self):
        self.assertFalse((ROOT / 'package.json').exists())

    def test_direct_local_scripts_are_classic(self):
        html = (ROOT / 'web/index.html').read_text()
        self.assertNotIn('type="module"', html)
        self.assertNotIn('src="http', html)
        self.assertIn('vendor/three/three.min.js', html)

    def test_vendored_three_global_build_is_pinned(self):
        artifact = ROOT / 'web/vendor/three/three.min.js'
        content = artifact.read_bytes()
        self.assertIn(b'SPDX-License-Identifier: MIT', content[:200])
        self.assertIn(b'.THREE={}', content)
        self.assertEqual(
            hashlib.sha256(content).hexdigest(),
            '8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271',
        )

    def test_ui_snapshot_and_worker_shells_exist(self):
        self.assertTrue((ROOT / 'web/ui/shell-behaviors.js').exists())
        self.assertTrue((ROOT / 'workers/mesher-worker.js').exists())
        self.assertTrue((ROOT / 'workers/solver-worker.js').exists())

    def test_local_runtime_generation_matches_checked_in_artifacts(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        checked_in = ROOT / 'web/generated/local-runtime'
        with tempfile.TemporaryDirectory() as directory:
            output_dir = pathlib.Path(directory) / 'local-runtime'
            subprocess.run(
                ['python3', str(generator), '--output-dir', str(output_dir)],
                check=True,
                cwd=ROOT,
            )
            for filename in ('mesher-worker-source.js', 'solver-worker-source.js'):
                generated = (output_dir / filename).read_text(encoding='utf-8')
                self.assertEqual(generated, (checked_in / filename).read_text(encoding='utf-8'))
                self.assertIn('Worker protocol: 1', generated)
                self.assertIn('WORKER_PROTOCOL_VERSION = 1', generated)

    def test_local_runtime_generation_rejects_stale_protocol(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        with tempfile.TemporaryDirectory() as directory:
            source_dir = pathlib.Path(directory) / 'workers'
            source_dir.mkdir()
            for filename in ('mesher-worker.js', 'solver-worker.js'):
                content = (ROOT / 'workers' / filename).read_text(encoding='utf-8')
                (source_dir / filename).write_text(
                    content.replace('WORKER_PROTOCOL_VERSION = 1', 'WORKER_PROTOCOL_VERSION = 2'),
                    encoding='utf-8',
                )
            result = subprocess.run(
                [
                    'python3', str(generator), '--source-root', str(source_dir),
                    '--output-dir', str(pathlib.Path(directory) / 'output'),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('protocol is 2, expected 1', result.stderr)

if __name__ == '__main__':
    unittest.main()
