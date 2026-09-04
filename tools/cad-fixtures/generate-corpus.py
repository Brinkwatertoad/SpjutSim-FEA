#!/usr/bin/env python3
"""Generate the CC0 SpjutSim v1 CAD regression corpus and manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile


SHAPES = {
    "box": ("basic", 0.35, "Box(1)={0,0,0,1,0.8,0.6};"),
    "tiny-box": ("tiny", 0.0004, "Box(1)={0,0,0,0.001,0.0008,0.0006};"),
    "thin-plate": ("thin", 0.03, "Box(1)={0,0,0,1.2,0.8,0.02};"),
    "slender-bar": ("mixed-scale", 0.08, "Box(1)={0,0,0,2.5,0.08,0.05};"),
    "cylinder": ("curved", 0.25, "Cylinder(1)={0,0,0,0,0,1,0.4};"),
    "sphere": ("curved", 0.25, "Sphere(1)={0,0,0,0.5};"),
    "ellipsoid": ("curved", 0.18, "Sphere(1)={0,0,0,0.5}; Dilate {{0,0,0},{1.6,0.7,0.4}} { Volume{1}; }"),
    "through-hole": ("hole", 0.18, "Box(1)={0,0,0,1,1,0.3}; Cylinder(2)={0.5,0.5,-0.1,0,0,0.5,0.18}; BooleanDifference(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "blind-hole": ("hole", 0.16, "Box(1)={0,0,0,1,1,0.5}; Cylinder(2)={0.5,0.5,0.25,0,0,0.4,0.2}; BooleanDifference(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "annulus": ("hole", 0.16, "Cylinder(1)={0,0,0,0,0,0.4,0.5}; Cylinder(2)={0,0,-0.1,0,0,0.6,0.25}; BooleanDifference(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "fillet-box": ("fillet", 0.18, "Box(1)={0,0,0,1,0.7,0.5}; f()=Boundary{Volume{1};}; e()=Abs(Unique(Boundary{Surface{f()};})); Fillet{1}{e()}{0.08}"),
    "rounded-column": ("fillet", 0.2, "Cylinder(1)={0,0,0,0,0,0.8,0.35}; Sphere(2)={0,0,0.8,0.35}; BooleanUnion(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "cross-union": ("thin", 0.12, "Box(1)={-0.8,-0.15,-0.1,1.6,0.3,0.2}; Box(2)={-0.15,-0.8,-0.1,0.3,1.6,0.2}; BooleanUnion(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "mixed-boss": ("mixed-scale", 0.08, "Box(1)={0,0,0,1.5,0.8,0.2}; Cylinder(2)={0.75,0.4,0.15,0,0,0.25,0.06}; BooleanUnion(3)={Volume{1};Delete;}{Volume{2};Delete;};"),
    "cone": ("curved", 0.2, "Cone(1)={0,0,0,0,0,1,0.5,0.15};"),
    "torus": ("curved", 0.18, "Torus(1)={0,0,0,0.6,0.18};"),
    "loft": ("curved", 0.16, "Circle(1)={0,0,0,0.45}; Curve Loop(1)=1; Circle(2)={0.1,0.05,0.6,0.25}; Curve Loop(2)=2; Circle(3)={-0.05,0,1.1,0.35}; Curve Loop(3)=3; ThruSections(1)={1:3};"),
    "offset-box": ("basic", 0.3, "Box(1)={-1.2,0.4,-0.3,0.7,1.1,0.9};"),
}

FORMAT_SHAPES = {
    "step": list(SHAPES),
    "iges": ["box", "tiny-box", "thin-plate", "cylinder", "cone", "through-hole", "fillet-box", "mixed-boss"],
    "brep": ["box", "tiny-box", "thin-plate", "cylinder", "sphere", "through-hole", "fillet-box", "mixed-boss"],
}


def canonicalize(path: pathlib.Path) -> None:
    data = path.read_text(encoding="latin-1")
    data = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", "2026-09-04T00:00:00", data)
    data = re.sub(r"\d{8}\.\d{6}", "20260904.000000", data)
    data = "\n".join(line.rstrip() for line in data.splitlines()) + "\n"
    path.write_text(data, encoding="latin-1", newline="\n")


def run_export(gmsh: pathlib.Path, body: str, fmt: str, output: pathlib.Path) -> None:
    source = 'SetFactory("OpenCASCADE");\nGeometry.OCCTargetUnit="M";\n' + body + "\n"
    if fmt == "iges":
        entities = "Surface{:}" if "Rectangle(" in body and "Volume" not in body else "Volume{:}"
        source += f"Dilate {{{{0,0,0}},{{1000,1000,1000}}}} {{ {entities}; }}\n"
    with tempfile.NamedTemporaryFile("w", suffix=".geo", encoding="ascii") as handle:
        handle.write(source)
        handle.flush()
        subprocess.run(
            [str(gmsh), handle.name, "-0", "-format", fmt, "-o", str(output)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=os.environ,
        )
    canonicalize(output)


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def accepted_entry(path: pathlib.Path, root: pathlib.Path, fmt: str, shape: str) -> dict:
    category, size, _ = SHAPES[shape]
    element_type = "tet10" if shape in ("sphere", "through-hole", "fillet-box") else "tet4"
    return {
        "id": f"{fmt}-{shape}", "path": path.relative_to(root).as_posix(), "sha256": digest(path),
        "format": fmt, "license": "CC0-1.0", "provenance": "Project-authored by tools/cad-fixtures/generate-corpus.py; Gmsh 4.12.1/OpenCASCADE 7.6 export",
        "sourceUnits": "mm" if fmt == "iges" else "m", "category": category,
        "expected": {"classification": "accepted", "stage": "mesh", "solidCount": [1, 1], "faceCount": [1, 64], "volumeM3": [1e-15, 1000], "boundsDiagonalM": [1e-6, 100]},
        "mesh": {"preset": "custom", "elementType": element_type, "minSizeM": size / 4, "maxSizeM": size,
                 "nodeCount": [4, 250000], "elementCount": [1, 1000000], "gammaMinimum": [0, 1], "gammaP05": [0, 1], "maximumEdgeRatio": [1, 1000000]},
        "remeshFaceIds": True,
    }


def rejected_entry(path: pathlib.Path, root: pathlib.Path, fmt: str, fixture_id: str, code: str, category: str) -> dict:
    return {
        "id": fixture_id, "path": path.relative_to(root).as_posix(), "sha256": digest(path), "format": fmt,
        "license": "CC0-1.0", "provenance": "Project-authored deliberate rejection fixture", "sourceUnits": "m", "category": category,
        "expected": {"classification": "rejected", "stage": "import", "code": code},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gmsh", required=True, type=pathlib.Path)
    parser.add_argument("--root", default=pathlib.Path(__file__).resolve().parents[2], type=pathlib.Path)
    args = parser.parse_args()
    root = args.root.resolve()
    output = root / "tests/fixtures/cad-corpus"
    output.mkdir(parents=True, exist_ok=True)
    for stale in output.iterdir():
        if stale.is_file() and stale.suffix.lower() in {".step", ".iges", ".brep"}:
            stale.unlink()
    entries = []
    for fmt, shapes in FORMAT_SHAPES.items():
        for shape in shapes:
            path = output / f"{shape}.{fmt}"
            run_export(args.gmsh, SHAPES[shape][2], fmt, path)
            entries.append(accepted_entry(path, root, fmt, shape))

    for fmt in ("step", "iges", "brep"):
        multi = output / f"two-solids.{fmt}"
        run_export(args.gmsh, "Box(1)={0,0,0,1,1,1}; Box(2)={2,0,0,1,1,1};", fmt, multi)
        multi_code = "GEOMETRY_NO_SOLID" if fmt == "iges" else "MULTIPLE_SOLIDS_UNSUPPORTED"
        entries.append(rejected_entry(multi, root, fmt, f"{fmt}-two-solids", multi_code, "multiple-solids"))
        shell = output / f"open-shell.{fmt}"
        run_export(args.gmsh, "Rectangle(1)={0,0,0,1,1};", fmt, shell)
        entries.append(rejected_entry(shell, root, fmt, f"{fmt}-open-shell", "GEOMETRY_NO_SOLID", "open-shell"))
        for index in range(3):
            malformed = output / f"malformed-{index + 1}.{fmt}"
            malformed.write_text(f"SpjutSim deliberate malformed {fmt} fixture {index + 1}\n", encoding="ascii")
            malformed_code = "IGES_UNITS_UNSUPPORTED" if fmt == "iges" else "GEOMETRY_NO_SOLID"
            entries.append(rejected_entry(malformed, root, fmt, f"{fmt}-malformed-{index + 1}", malformed_code, "malformed"))
    empty = output / "empty.step"
    empty.write_bytes(b"")
    entries.append(rejected_entry(empty, root, "step", "step-empty", "INVALID_IMPORT_REQUEST", "empty"))
    manifest = {
        "schemaVersion": 1, "corpusId": "spjutsim-cad-v1", "generatedAt": "2026-09-04",
        "generator": "tools/cad-fixtures/generate-corpus.py", "licensePolicy": "Project-authored CC0-1.0 only",
        "entries": entries,
    }
    (root / "tests/fixtures/corpus-v1.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(entries)} CAD corpus entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
