#!/usr/bin/env python3
"""Generate original CC0 STL feasibility fixtures without CAD dependencies."""
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT / "tests/fixtures/stl"


def box(x=1, y=1, z=1, offset=0):
    points = [(offset + a*x, b*y, c*z) for a, b, c in
              [(0,0,0),(1,0,0),(1,1,0),(0,1,0),
               (0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
    return [[points[i] for i in face] for face in
            [(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),
             (1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]]


def cylinder(segments):
    ring = [(0.5*math.cos(2*math.pi*i/segments),
             0.5*math.sin(2*math.pi*i/segments)) for i in range(segments)]
    # Quantize once so ASCII and binary represent exactly the same geometry.
    ring = [struct.unpack('<2f', struct.pack('<2f', *p)) for p in ring]
    triangles = []
    for i in range(segments):
        a, b = ring[i], ring[(i+1) % segments]
        lo, hi = (*a, 0), (*a, 1)
        next_lo, next_hi = (*b, 0), (*b, 1)
        triangles.extend([[(0,0,0), next_lo, lo], [(0,0,1), hi, next_hi],
                          [lo, next_lo, next_hi], [lo, next_hi, hi]])
    return triangles


def encode(triangles, binary=False):
    if binary:
        return b'solid binary fixture'.ljust(80, b' ') + struct.pack('<I', len(triangles)) + b''.join(
            struct.pack('<12fH', 0, 0, 0, *(v for p in t for v in p), 0) for t in triangles)
    lines = ['solid fixture']
    for triangle in triangles:
        lines.extend(['facet normal 0 0 0', 'outer loop'])
        lines.extend('vertex ' + ' '.join(format(v, '.17g') for v in p) for p in triangle)
        lines.extend(['endloop', 'endfacet'])
    return ('\n'.join(lines + ['endsolid fixture', ''])).encode('ascii')


def generate():
    cube = box()
    cases = [
        ('cube-ascii.stl', cube, False, 'valid', [1,1,1], 1),
        ('cube-binary.stl', cube, True, 'valid', [1,1,1], 1),
        ('thin-plate.stl', box(z=0.02), True, 'valid', [1,1,0.02], 0.02),
        ('disconnected.stl', cube + box(offset=2), True, 'STL_DISCONNECTED', None, None),
        ('open.stl', cube[:-1], False, 'STL_OPEN_SURFACE', None, None),
        ('nonmanifold.stl', cube + [cube[0]], True, 'STL_NONMANIFOLD', None, None),
        ('reversed.stl', [list(reversed(t)) for t in cube], True, 'STL_INWARD_WINDING', None, None),
        ('inconsistent.stl', [list(reversed(cube[0]))] + cube[1:], False, 'STL_INCONSISTENT_WINDING', None, None),
        ('degenerate.stl', cube + [[(0,0,0)]*3], True, 'STL_DEGENERATE_TRIANGLE', None, None),
    ]
    for segments in (16, 32, 64):
        cases.append((f'cylinder-{segments}.stl', cylinder(segments), True, 'valid', [1,1,1],
                      segments*0.125*math.sin(2*math.pi/segments)))
    DESTINATION.mkdir(parents=True, exist_ok=True)
    records = []
    for name, triangles, binary, expected, dimensions, volume in cases:
        data = encode(triangles, binary)
        (DESTINATION / name).write_bytes(data)
        records.append(dict(file=name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data),
                            triangles=len(triangles), encoding='binary' if binary else 'ascii',
                            expected=expected, dimensions=dimensions, volume=volume))
    for name, data in [('truncated.stl', encode(cube, True)[:-1]),
                       ('count-overflow.stl', b'X'*80 + struct.pack('<I', 0xffffffff)),
                       ('malformed.stl', b'solid bad\nfacet normal 0 0 0\nendsolid bad\n')]:
        (DESTINATION / name).write_bytes(data)
        records.append(dict(file=name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data),
                            expected='STL_MALFORMED'))
    (DESTINATION / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')


if __name__ == '__main__':
    generate()
