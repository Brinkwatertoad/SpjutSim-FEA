#!/usr/bin/env python3
"""Independently inspect a version-1 portable project with Python's ZIP reader."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def validate(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate ZIP entries'
        assert archive.testzip() is None, 'CRC failure'
        assert all(entry.compress_type == zipfile.ZIP_STORED for entry in archive.infolist()), 'Unexpected compression'
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['format'] == 'SpjutSim-FEA' and manifest['version'] == 1
        source = archive.read('source/cad.bin')
        assert hashlib.sha256(source).hexdigest() == manifest['source']['identity']
        total = 0
        arrays = 0
        sizes = {'Float64Array': 8, 'Float32Array': 4, 'Uint32Array': 4, 'Int32Array': 4, 'Uint8Array': 1}

        def inspect(value):
            nonlocal total, arrays
            if isinstance(value, dict) and '$array' in value:
                payload = archive.read(value['$array'])
                assert len(payload) == value['length'] * sizes[value['type']]
                assert hashlib.sha256(payload).hexdigest() == value['sha256']
                total += len(payload)
                arrays += 1
            elif isinstance(value, dict):
                for item in value.values():
                    inspect(item)
            elif isinstance(value, list):
                for item in value:
                    inspect(item)

        inspect(manifest.get('cache'))
        assert total <= 512 * 1024 * 1024
        return {'file': str(path), 'source_bytes': len(source), 'binary_arrays': arrays,
                'binary_bytes': total, 'entries': len(names), 'archive_bytes': Path(path).stat().st_size}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python3 tests/validate_project_file.py PROJECT.spjutsim-fea [...]')
    for filename in sys.argv[1:]:
        print(json.dumps(validate(filename)))
