"""Exercise fail-closed release checks on small, independent candidate trees."""

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import tarfile
import io


ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT / 'tools/audit-distribution.py'


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.files = {
            'LICENSE': 'SPDX-License-Identifier: GPL-2.0-or-later\nGNU GENERAL PUBLIC LICENSE\nVersion 2, June 1991\n',
            'NOTICE': 'Copyright holder; no warranty. See LICENSE.\n',
            'web/licenses/GPL-2.0.txt': 'GNU GENERAL PUBLIC LICENSE\nVersion 2, June 1991\n',
            'src/runtime.c': 'int value(void) { return 1; }\n',
            'tools/build.sh': '#!/bin/sh\ncc src/runtime.c\n',
            'web/vendor/runtime.js': 'var value = 1;\n',
            'web/index.html': '<script src="vendor/runtime.js"></script>\n',
        }
        for path, text in self.files.items():
            self.write(path, text)
        self.policy = {
            'schema_version': 1, 'path': 'gpl-source', 'status': 'approved',
            'license': 'GPL-2.0-or-later', 'approver': 'Owner',
            'date': '2026-09-06', 'approval_reference': 'Owner approval in task conversation',
            'scope': 'First-party FEA and copied UI foundation',
            'legal_review': 'No independent legal review claimed',
            'final_review': {'status': 'pending'},
        }
        self.manifest = {
            'schema_version': 1, 'distribution_license': 'GPL-2.0-or-later',
            'components': {'runtime': {
                'project': 'Example', 'version': '1', 'license': 'GPL-2.0-or-later',
                'source': {'url': 'https://example.org/source', 'revision': '1'},
                'source_files': [self.record('src/runtime.c')],
                'build_recipe': self.record('tools/build.sh'),
                'modifications': 'None',
                'notices': [self.record('LICENSE'), self.record('NOTICE'),
                            self.record('web/licenses/GPL-2.0.txt')],
            }},
            'artifacts': [dict(self.record('web/vendor/runtime.js'), components=['runtime']),
                          dict(self.record('web/licenses/GPL-2.0.txt'), components=['runtime'])],
        }
        self.save()

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def record(self, path):
        return {'path': path, 'sha256': hashlib.sha256((self.root / path).read_bytes()).hexdigest()}

    def save(self):
        self.write('docs/release/distribution-policy.md', '# Policy\n\n```json\n' +
                   json.dumps(self.policy) + '\n```\n')
        self.write('docs/release/artifact-manifest.json', json.dumps(self.manifest))

    def run_audit(self, *args):
        return subprocess.run(['python3', str(AUDITOR), '--root', str(self.root), *args],
                              capture_output=True, text=True)

    def assert_rejected(self, message, *args):
        result = self.run_audit(*args)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn(message, result.stderr)
        self.assertNotIn('Traceback', result.stderr)

    def test_valid_candidate_passes_artifact_audit_but_pending_review_blocks_release(self):
        result = self.run_audit()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_rejected('final review', '--require-approved')

    def test_final_review_is_bound_to_exact_artifact_manifest(self):
        self.policy['final_review'] = {
            'status': 'approved', 'approver': 'Owner', 'date': '2026-09-06',
            'reference': 'Explicit review approval',
            'artifact_manifest_sha256': self.record('docs/release/artifact-manifest.json')['sha256'],
        }
        self.save()
        result = self.run_audit('--require-approved')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.manifest['components']['runtime']['modifications'] = 'Changed provenance'
        self.save()
        self.assert_rejected('final review', '--require-approved')

    def test_missing_or_blocked_owner_decision_fails_closed(self):
        (self.root / 'docs/release/distribution-policy.md').unlink()
        self.assert_rejected('policy')
        self.policy['status'] = 'blocked'
        self.save()
        self.assert_rejected('owner decision')

    def test_hash_drift_and_missing_notices_sources_or_recipes_are_rejected(self):
        for path in ('web/vendor/runtime.js', 'LICENSE', 'src/runtime.c', 'tools/build.sh'):
            with self.subTest(path=path):
                original = (self.root / path).read_text()
                self.write(path, original + 'changed')
                self.assert_rejected('SHA-256')
                (self.root / path).unlink()
                self.assert_rejected('missing')
                self.write(path, original)

    def test_unlisted_payloads_and_unknown_component_rejected(self):
        self.write('web/wasm/extra.bin', 'unreviewed')
        self.assert_rejected('unlisted')
        (self.root / 'web/wasm/extra.bin').unlink()
        self.manifest['artifacts'][0]['components'] = ['unknown']
        self.save()
        self.assert_rejected('component')

    def test_missing_provenance_or_policy_license_mismatch_rejected(self):
        del self.manifest['components']['runtime']['source']
        self.save()
        self.assert_rejected('source')
        self.manifest['distribution_license'] = 'MIT'
        self.save()
        self.assert_rejected('license')

    def test_remote_runtime_urls_rejected_but_documentation_links_allowed(self):
        for snippet in ('<script src="https://cdn.example/a.js"></script>',
                        '<link rel="stylesheet" href="//cdn.example/a.css">',
                        '<base href="https://cdn.example/">',
                        '<img srcset="local.png 1x, https://cdn.example/a.png 2x">',
                        '<script>xhr.open("GET", "https://example.org/data")</script>',
                        '<script>fetch("https://example.org/data")</script>'):
            with self.subTest(snippet=snippet):
                self.write('web/index.html', snippet)
                self.assert_rejected('remote')
        self.write('web/index.html', '<a href="https://example.org/source">Source</a>')
        self.assertEqual(self.run_audit().returncode, 0)

    def test_manifest_cannot_escape_tree_or_hide_duplicate_artifacts(self):
        self.manifest['artifacts'].append(self.manifest['artifacts'][0])
        self.save()
        self.assert_rejected('duplicate')
        self.manifest['artifacts'].pop()
        self.manifest['artifacts'][0]['path'] = '../outside.js'
        self.save()
        self.assert_rejected('unsafe path')

    def test_malformed_manifest_has_actionable_error(self):
        self.write('docs/release/artifact-manifest.json', '{')
        self.assert_rejected('manifest')

    def test_refresh_updates_only_listed_hashes_and_does_not_approve_release(self):
        self.write('web/vendor/runtime.js', 'var value = 2;\n')
        result = self.run_audit('--refresh-hashes')
        self.assertEqual(result.returncode, 0, result.stderr)
        updated = json.loads((self.root / 'docs/release/artifact-manifest.json').read_text())
        self.assertEqual(updated['artifacts'][0]['sha256'], self.record('web/vendor/runtime.js')['sha256'])
        self.assert_rejected('final review', '--require-approved')
        self.write('web/vendor/unreviewed.js', 'var extra;')
        self.assert_rejected('unlisted', '--refresh-hashes')

    def test_packager_rejects_notice_that_differs_from_pinned_upstream_archive(self):
        archive_path = self.root / 'build/distribution-inputs/runtime.tar.gz'
        archive_path.parent.mkdir(parents=True)
        with tarfile.open(archive_path, 'w:gz') as archive:
            data = b'Original upstream notice\n'
            member = tarfile.TarInfo('upstream/LICENSE')
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        component = self.manifest['components']['runtime']
        component['source']['archive'] = {'url': 'https://example.invalid/pinned.tar.gz',
                                        'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest()}
        component['notices'][0]['upstream_path'] = 'LICENSE'
        self.save()
        result = subprocess.run(['python3', str(ROOT / 'tools/package-distribution.py'),
                                 '--root', str(self.root)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('upstream notice', result.stderr)

    def test_package_contains_exact_sources_and_rejects_staged_drift(self):
        packager = ROOT / 'tools/package-distribution.py'
        output = self.root / 'build/distribution/web'
        result = subprocess.run(['python3', str(packager), '--root', str(self.root),
                                 '--output', str(output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_audit('--release-root', str(output))
        self.assertEqual(result.returncode, 0, result.stderr)
        bundle = json.loads((output / 'sources/manifest.json').read_text())
        parts = bundle['archives']['application']['parts']
        data = b''.join((output / p['path']).read_bytes() for p in parts)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            self.assertEqual(archive.extractfile('SpjutSim-FEA/src/runtime.c').read(),
                             b'int value(void) { return 1; }\n')
        # Even an unlisted first-party source edit must invalidate the staged
        # corresponding source, independently of the artifact hashes.
        self.write('new-source.c', 'int added;\n')
        self.assert_rejected('incomplete', '--release-root', str(output))
        (self.root / 'new-source.c').unlink()
        self.write('web/vendor/runtime.js', 'var value = 2;\n')
        self.assert_rejected('SHA-256', '--release-root', str(output))
        self.write('web/vendor/runtime.js', self.files['web/vendor/runtime.js'])
        (output / parts[0]['path']).write_bytes(b'corrupt')
        self.assert_rejected('SHA-256', '--release-root', str(output))

    def test_packager_refuses_missing_or_wrong_upstream_archive_without_network(self):
        self.manifest['components']['runtime']['source']['archive'] = {
            'url': 'https://example.invalid/pinned.tar.gz', 'sha256': '0' * 64}
        self.save()
        result = subprocess.run(['python3', str(ROOT / 'tools/package-distribution.py'),
                                 '--root', str(self.root)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('source archive', result.stderr)


class RepositoryDistributionTests(unittest.TestCase):
    def test_checked_in_candidate_matches_release_manifest(self):
        result = subprocess.run(['python3', str(AUDITOR)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
