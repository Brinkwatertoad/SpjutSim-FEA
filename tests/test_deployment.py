import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MAX_STATIC_ASSET_BYTES = 25 * 1024 * 1024


class DeploymentTests(unittest.TestCase):
    def test_wrangler_serves_web_on_preview_and_the_production_custom_domain(self):
        config = json.loads((ROOT / 'wrangler.jsonc').read_text(encoding='utf-8'))
        self.assertEqual(config['name'], 'spjutsim-fea')
        self.assertTrue(config['workers_dev'])
        self.assertEqual(config['assets']['directory'], './web')
        self.assertEqual(config['routes'], [{
            'pattern': 'fea.spjutsim.com',
            'custom_domain': True,
        }])

    def test_public_assets_fit_cloudflare_static_hosting(self):
        oversized = [
            path.relative_to(ROOT / 'web').as_posix()
            for path in (ROOT / 'web').rglob('*')
            if path.is_file() and path.stat().st_size > MAX_STATIC_ASSET_BYTES
        ]
        self.assertEqual(oversized, [])

    def test_cloudflare_headers_allow_local_wasm_workers_and_isolate_http(self):
        headers = (ROOT / 'web/_headers').read_text(encoding='utf-8')
        self.assertIn("script-src 'self' 'wasm-unsafe-eval'", headers)
        self.assertIn("worker-src 'self' blob:", headers)
        self.assertIn('Cross-Origin-Opener-Policy: same-origin', headers)
        self.assertIn('Cross-Origin-Embedder-Policy: require-corp', headers)
        self.assertIn('X-Content-Type-Options: nosniff', headers)


if __name__ == '__main__':
    unittest.main()
