"""Validate a generated report package using only the Python standard library.

Usage: python3 tests/validate_report_docx.py report.docx [downloaded.docx ...]
"""
import posixpath
import struct
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
WP = '{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'


def validate(path):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, 'CRC failure'
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate package parts'
        xml = {name: ET.fromstring(archive.read(name)) for name in names
               if name.endswith(('.xml', '.rels'))}
        document = xml['word/document.xml']
        assert document.tag == W + 'document'
        assert len(document.findall('.//' + W + 'tbl')) >= 3, 'Editable tables missing'
        text = '\n'.join(element.text or '' for element in document.iter(W + 't'))
        for label in ('Original part size', 'Young', 'Applied force', 'Convergence', 'Solve time'):
            assert label in text, f'Missing report content: {label}'
        for name, root in xml.items():
            if not name.endswith('.rels'):
                continue
            base = '' if name == '_rels/.rels' else posixpath.dirname(posixpath.dirname(name))
            for relationship in root:
                target = posixpath.normpath(posixpath.join(base, relationship.attrib['Target']))
                assert target in names, f'Dangling relationship {target}'
        relationships = {r.attrib['Id']: r.attrib['Target']
                         for r in xml['word/_rels/document.xml.rels']}
        figures = document.findall('.//' + WP + 'inline')
        assert len(figures) in (4, 5), 'Wrong capture count'
        for figure in figures:
            reference = figure.find('.//' + A + 'blip').attrib[R + 'embed']
            png = archive.read('word/' + relationships[reference])
            assert png[:8] == b'\x89PNG\r\n\x1a\n'
            width, height = struct.unpack('>II', png[16:24])
            extent = figure.find(WP + 'extent').attrib
            cx, cy = int(extent['cx']), int(extent['cy'])
            assert abs(cx / cy - width / height) < 1e-5, 'Image distorted'
            assert cx <= 5943600 and cy <= 6858000, 'Image exceeds page'
        print(f'{path}: valid package, {len(figures)} embedded captures')


if __name__ == '__main__':
    start = time.perf_counter()
    for filename in sys.argv[1:]:
        validate(filename)
    print(f'Passed {len(sys.argv)-1}/{len(sys.argv)-1}; {time.perf_counter()-start:.3f} s')
