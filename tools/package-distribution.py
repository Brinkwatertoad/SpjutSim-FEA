#!/usr/bin/env python3
"""Stage web assets with exact corresponding source; never publishes anything.

Use --fetch-sources to download pinned upstream archives to the ignored cache.
Without it, packaging is offline and fails if an archive is absent or changed.
"""

import argparse
import gzip
import html
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('distribution_audit', ROOT / 'tools/audit-distribution.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
PART_BYTES = 20 * 1024 * 1024


def record(root, path):
    return {'path': path.relative_to(root).as_posix(), 'sha256': audit.sha256(path)}


def split_archive(path, name, output):
    parts = []
    with path.open('rb') as stream:
        while block := stream.read(PART_BYTES):
            part = output / 'sources' / f'{name}.tar.gz.part-{len(parts) + 1:03d}'
            part.write_bytes(block)
            parts.append(record(output, part))
    return {'sha256': audit.sha256(path), 'parts': parts}


def stage(root, output, fetch_sources=False):
    manifest = audit.audit(root)
    # A fixed ignored parent keeps source inventory independent of the output.
    if not output.resolve().is_relative_to((root / 'build').resolve()):
        raise ValueError('output must be inside the candidate build/ directory')
    if output.exists():
        raise ValueError(f'output already exists; select a fresh output directory: {output}')
    cache = root / 'build/distribution-inputs'
    cache.mkdir(parents=True, exist_ok=True)
    upstream = {}
    for name, component in manifest['components'].items():
        archive = component['source'].get('archive')
        if not archive:
            continue
        if not name.replace('-', '').isalnum():
            raise ValueError('unsafe source component name')
        path = cache / f'{name}.tar.gz'
        if not path.exists() and fetch_sources:
            temporary = path.with_suffix('.partial')
            try:
                with urllib.request.urlopen(archive['url'], timeout=120) as source, temporary.open('wb') as target:
                    shutil.copyfileobj(source, target)
                if audit.sha256(temporary) != archive['sha256']:
                    raise ValueError(f'source archive SHA-256 mismatch: {name}')
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
        if not path.is_file() or audit.sha256(path) != archive['sha256']:
            raise ValueError(f'source archive missing or SHA-256 mismatch: {path}; use --fetch-sources for missing archives')
        upstream[name] = path
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent, prefix='distribution-') as temp:
        stage_root = Path(temp) / 'web'
        shutil.copytree(root / 'web', stage_root)
        (stage_root / 'sources').mkdir()
        bundle = {
            'schema_version': 1,
            'artifact_manifest_sha256': audit.sha256(root / audit.MANIFEST),
            'web_files': [record(root / 'web', p) for p in sorted((root / 'web').rglob('*')) if p.is_file()],
            'archives': {},
        }
        app_tar = Path(temp) / 'application.tar.gz'
        with app_tar.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode='w|', format=tarfile.PAX_FORMAT) as archive:
                for path in audit.source_paths(root):
                    info = archive.gettarinfo(str(path), 'SpjutSim-FEA/' + path.relative_to(root).as_posix())
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ''
                    info.mode = 0o755 if path.stat().st_mode & 0o111 else 0o644
                    with path.open('rb') as source:
                        archive.addfile(info, source)
        for name, path in {'application': app_tar, **upstream}.items():
            bundle['archives'][name] = split_archive(path, name, stage_root)
        items = []
        for name, archive in bundle['archives'].items():
            links = ' '.join(f'<a href="{html.escape(Path(p["path"]).name)}">Part {i + 1}</a>'
                             for i, p in enumerate(archive['parts']))
            items.append(f'<li>{html.escape(name)}: {links}<br>SHA-256: <code>{archive["sha256"]}</code></li>')
        index = stage_root / 'sources/index.html'
        index.write_text('<!doctype html><html lang="en"><meta charset="utf-8">'
                         '<meta name="viewport" content="width=device-width, initial-scale=1">'
                         '<title>SpjutSim FEA corresponding source</title><h1>Corresponding source</h1>'
                         '<p>These sources accompany this exact application build. Download every part for each archive, '
                         'concatenate parts in numeric order, and extract the resulting tar.gz file. '
                         'Build instructions are in SpjutSim-FEA/docs/release/SOURCE.md inside the application archive.</p>'
                         '<pre>cat application.tar.gz.part-* &gt; application.tar.gz\ntar -xzf application.tar.gz</pre>'
                         '<ul>' + ''.join(items) + '</ul><p><a href="manifest.json">File hashes</a> · '
                         '<a href="../licenses/index.html">Licenses</a></p></html>\n', encoding='utf-8')
        bundle['source_index'] = record(stage_root, index)
        (stage_root / 'sources/manifest.json').write_text(json.dumps(bundle, indent=2) + '\n')
        audit.audit_release(root, stage_root, manifest)
        stage_root.rename(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--fetch-sources', action='store_true')
    args = parser.parse_args()
    try:
        output = stage(args.root, args.output or args.root / 'build/distribution/web', args.fetch_sources)
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError) as error:
        print(f'distribution packaging failed: {error}', file=sys.stderr)
        return 1
    print(f'Staged audited application and corresponding source at {output}. No publication performed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
