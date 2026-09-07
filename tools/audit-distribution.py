#!/usr/bin/env python3
"""Audit local artifacts; --release-root also checks the staged source distribution.

This checks recorded evidence, not legal sufficiency. Publication additionally
requires --require-approved and the owner's final review of the manifest.
"""

import argparse
from contextlib import contextmanager
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile
import tempfile
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'docs/release/artifact-manifest.json'
POLICY = 'docs/release/distribution-policy.md'
COVERED_ROOTS = ('web/vendor', 'web/wasm', 'web/generated', 'web/ui', 'web/licenses')
LICENSE = 'GPL-2.0-or-later'


def source_paths(root):
    """Source release scope, including dirty/new files but no build caches or VCS."""
    excluded = {'build', '.git', '.wrangler', '__pycache__', '.DS_Store'}
    for directory, directories, files in os.walk(root):
        directories[:] = sorted(name for name in directories if name not in excluded)
        for name in sorted(files):
            if name in excluded or name.endswith('.pyc'):
                continue
            path = Path(directory) / name
            local_path(root, path.relative_to(root).as_posix())
            yield path


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def local_path(root, name):
    if (not isinstance(name, str) or not name or '\\' in name or
            PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
            str(PurePosixPath(name)) != name):
        raise ValueError(f'unsafe path: {name!r}')
    path = root / name
    if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink():
        raise ValueError(f'unsafe path: {name!r}')
    return path


def read_json(path, label):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise ValueError(f'{label} missing or invalid: {path}') from error


def read_policy(root):
    try:
        text = (root / POLICY).read_text(encoding='utf-8')
        match = re.search(r'^```json\n(.*?)\n```', text, re.M | re.S)
        return json.loads(match.group(1)) if match else {}
    except (OSError, ValueError) as error:
        raise ValueError('distribution policy missing or invalid') from error


def check_record(root, record):
    path = local_path(root, record['path'])
    if not path.is_file():
        raise ValueError(f'missing file: {record["path"]}')
    expected = record['sha256']
    if not re.fullmatch(r'[0-9a-f]{64}', expected) or sha256(path) != expected:
        raise ValueError(f'SHA-256 mismatch: {record["path"]}')


def refresh_hashes(root):
    """Refresh reviewed entries only; never discover/approve new dependencies."""
    manifest = read_json(root / MANIFEST, 'artifact manifest')
    records = list(manifest['artifacts'])
    for component in manifest['components'].values():
        records.extend(component.get('source_files', []))
        records.extend(component['notices'])
        records.append(component['build_recipe'])
    for record in records:
        record['sha256'] = sha256(local_path(root, record['path']))
    (root / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


def remote(value):
    return bool(re.match(r'(?:[a-z][a-z0-9+.-]*:)?//', value.strip(), re.I))


class ResourceParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            values = value.split(',') if value and key == 'srcset' else [value]
            if value and (key in ('src', 'srcset', 'poster', 'data') or
                          (tag in ('link', 'base') and key == 'href')) and any(remote(v) for v in values):
                raise ValueError('forbidden remote HTML resource')


def check_runtime_urls(root):
    # Literal network entry points are forbidden. This is intentionally not a JS
    # interpreter; computed URLs additionally require the offline browser check.
    network = re.compile(
        r'\b(?:fetch|import|importScripts|Worker|SharedWorker|WebSocket|EventSource)\s*\(\s*'
        r'[\'"`]\s*(?:(?:https?|wss?):)?//', re.I)
    xhr = re.compile(r'\.open\s*\(\s*[\'\"](?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[\'\"]'
                     r'\s*,\s*[\'\"](?:https?:)?//', re.I)
    css = re.compile(r'(?:url\(\s*|@import\s*)[\'\"]?(?:https?:)?//', re.I)
    for directory in ('web', 'workers'):
        for path in (root / directory).rglob('*'):
            if path.suffix not in ('.js', '.mjs', '.html', '.css'):
                continue
            text = path.read_text(encoding='utf-8')
            if path.suffix == '.html':
                ResourceParser().feed(text)
            if network.search(text) or xhr.search(text) or (path.suffix in ('.css', '.html') and css.search(text)):
                raise ValueError(f'forbidden remote runtime URL: {path.relative_to(root)}')


def audit(root, require_approved=False):
    policy = read_policy(root)
    manifest = read_json(root / MANIFEST, 'artifact manifest')
    if policy.get('schema_version') != 1 or manifest.get('schema_version') != 1:
        raise ValueError('unsupported policy/manifest schema')
    if policy.get('status') != 'approved' or policy.get('path') != 'gpl-source':
        raise ValueError('owner decision absent or blocked; GPL source approval required')
    if policy.get('license') != LICENSE or manifest.get('distribution_license') != LICENSE:
        raise ValueError('policy/manifest license mismatch')
    for field in ('approver', 'date', 'approval_reference', 'scope', 'legal_review'):
        if not isinstance(policy.get(field), str) or not policy[field].strip():
            raise ValueError(f'owner decision missing {field}')
    root_license = (root / 'LICENSE').read_text(encoding='utf-8') if (root / 'LICENSE').is_file() else ''
    if (f'SPDX-License-Identifier: {LICENSE}' not in root_license or
            'GNU GENERAL PUBLIC LICENSE' not in root_license or
            'No license is granted' in root_license):
        raise ValueError('root license missing or inconsistent with GPL approval')
    components = manifest['components']
    if not isinstance(components, dict) or not components:
        raise ValueError('manifest components missing')
    for name, component in components.items():
        for field in ('project', 'version', 'license', 'modifications'):
            if not isinstance(component.get(field), str) or not component[field].strip():
                raise ValueError(f'component {name} missing {field}')
        source = component.get('source', {})
        if not source.get('revision') or urlsplit(source.get('url', '')).scheme != 'https':
            raise ValueError(f'component {name} missing pinned source provenance')
        archive = source.get('archive')
        if archive and (urlsplit(archive['url']).scheme != 'https' or
                        not re.fullmatch(r'[0-9a-f]{64}', archive['sha256'])):
            raise ValueError(f'component {name} invalid source archive')
        if not component.get('source_files') and not archive:
            raise ValueError(f'component {name} missing source files or archive')
        for record in component.get('source_files', []):
            check_record(root, record)
        if not component.get('notices'):
            raise ValueError(f'component {name} missing notices')
        for record in component['notices']:
            check_record(root, record)
        if not component.get('build_recipe'):
            raise ValueError(f'component {name} missing build recipe')
        check_record(root, component['build_recipe'])
    listed = set()
    for record in manifest['artifacts']:
        if record['path'] in listed:
            raise ValueError(f'duplicate artifact: {record["path"]}')
        listed.add(record['path'])
        check_record(root, record)
        if not record.get('components') or any(name not in components for name in record['components']):
            raise ValueError(f'artifact has unknown or missing component: {record["path"]}')
    actual = {path.relative_to(root).as_posix() for directory in COVERED_ROOTS
              for path in (root / directory).rglob('*') if path.is_file()}
    unlisted = actual - listed
    if unlisted:
        raise ValueError('unlisted generated/vendor/UI/notice files: ' + ', '.join(sorted(unlisted)))
    check_runtime_urls(root)
    if require_approved:
        review = policy.get('final_review', {})
        if (review.get('status') != 'approved' or not review.get('approver') or
                not review.get('date') or not review.get('reference') or
                review.get('artifact_manifest_sha256') != sha256(root / MANIFEST)):
            raise ValueError('final review of this artifact manifest is pending or stale')
    return manifest


@contextmanager
def open_source_archive(release_root, archive):
    # Spool to disk so validation never needs a complete source archive in RAM.
    with tempfile.TemporaryFile() as combined:
        for part in archive['parts']:
            with local_path(release_root, part['path']).open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    combined.write(block)
        combined.seek(0)
        with tarfile.open(fileobj=combined, mode='r|gz') as source_tar:
            yield source_tar


def audit_release(root, release_root, manifest):
    bundle = read_json(release_root / 'sources/manifest.json', 'release source manifest')
    if bundle.get('schema_version') != 1 or bundle.get('artifact_manifest_sha256') != sha256(root / MANIFEST):
        raise ValueError('release source manifest does not match candidate')
    deployed = bundle['web_files']
    expected = {p.relative_to(root / 'web').as_posix() for p in (root / 'web').rglob('*') if p.is_file()}
    if {r['path'] for r in deployed} != expected or len(deployed) != len(expected):
        raise ValueError('release web file inventory differs from candidate')
    for record in deployed:
        check_record(root / 'web', record)
        check_record(release_root, record)
    expected_archives = {name: c['source']['archive'] for name, c in manifest['components'].items()
                         if c['source'].get('archive')}
    expected_archives['application'] = None
    archives = bundle['archives']
    if set(archives) != set(expected_archives):
        raise ValueError('release source archives missing or unexpected')
    paths = {r['path'] for r in deployed} | {'sources/manifest.json', 'sources/index.html'}
    for name, archive in archives.items():
        digest = hashlib.sha256()
        if not archive['parts']:
            raise ValueError(f'missing source archive parts: {name}')
        for part in archive['parts']:
            if part['path'] in paths:
                raise ValueError('duplicate release source path')
            paths.add(part['path'])
            check_record(release_root, part)
            with local_path(release_root, part['path']).open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
        expected_hash = expected_archives[name]['sha256'] if expected_archives[name] else archive['sha256']
        if digest.hexdigest() != expected_hash or archive['sha256'] != expected_hash:
            raise ValueError(f'source archive SHA-256 mismatch: {name}')
        if name != 'application':
            notices = {r['upstream_path']: r['sha256'] for r in manifest['components'][name]['notices']
                       if r.get('upstream_path')}
            if notices:
                seen = set()
                with open_source_archive(release_root, archive) as source_tar:
                    for member in source_tar:
                        relative = member.name.partition('/')[2]
                        if relative not in notices:
                            continue
                        if not member.isfile() or relative in seen:
                            raise ValueError(f'invalid upstream notice: {name}/{relative}')
                        seen.add(relative)
                        with source_tar.extractfile(member) as stream:
                            if hashlib.sha256(stream.read()).hexdigest() != notices[relative]:
                                raise ValueError(f'upstream notice differs from pinned source: {name}/{relative}')
                if seen != set(notices):
                    raise ValueError(f'missing upstream notice in pinned source: {name}')
    # Check the actual application sources, not just a self-reported archive hash.
    expected_sources = {'SpjutSim-FEA/' + p.relative_to(root).as_posix(): p for p in source_paths(root)}
    with open_source_archive(release_root, archives['application']) as source_tar:
        seen = set()
        for member in source_tar:
            if not member.isfile() or member.name in seen or member.name not in expected_sources:
                raise ValueError('unexpected application source archive member')
            seen.add(member.name)
            digest = hashlib.sha256()
            with source_tar.extractfile(member) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
            if digest.hexdigest() != sha256(expected_sources[member.name]):
                raise ValueError(f'application source differs from candidate: {member.name}')
        if seen != set(expected_sources):
            raise ValueError('application source archive incomplete')
    if bundle['source_index']['path'] != 'sources/index.html':
        raise ValueError('missing source index record')
    check_record(release_root, bundle['source_index'])
    actual = {p.relative_to(release_root).as_posix() for p in release_root.rglob('*') if p.is_file()}
    if actual != paths:
        raise ValueError('unlisted or missing staged release files')
    check_runtime_urls(release_root.parent)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--release-root', type=Path)
    parser.add_argument('--require-approved', action='store_true')
    parser.add_argument('--refresh-hashes', action='store_true',
                        help='explicitly update existing manifest hashes; final review becomes stale')
    args = parser.parse_args()
    try:
        if args.refresh_hashes:
            refresh_hashes(args.root)
        manifest = audit(args.root, args.require_approved)
        if args.release_root:
            audit_release(args.root, args.release_root, manifest)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, tarfile.TarError) as error:
        print(f'distribution audit failed: {error}', file=sys.stderr)
        return 1
    print('Distribution artifact audit passed.' +
          (' Staged source distribution verified.' if args.release_root else '') +
          (' Final owner review verified.' if args.require_approved else ' Publication still requires final owner review.'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
