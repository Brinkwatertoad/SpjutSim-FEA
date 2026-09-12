#!/usr/bin/env python3
"""Generate public-domain faceted STEP prisms used by validation benchmarks."""

from __future__ import annotations

import argparse
import math
import pathlib


def number(value: float) -> str:
    if abs(value) < 1e-15:
        value = 0.0
    return f"{value:.12g}"


def vector(values: tuple[float, float, float]) -> str:
    return ",".join(number(value) for value in values)


def faceted_prism(name: str, polygon: list[tuple[float, float]], height: float) -> str:
    entities: list[tuple[int, str]] = []
    next_id = 20

    def add(body: str) -> int:
        nonlocal next_id
        entity_id = next_id
        next_id += 1
        entities.append((entity_id, body))
        return entity_id

    bottom = [add(f"CARTESIAN_POINT('',({number(x)},{number(y)},0.))") for x, y in polygon]
    top = [add(f"CARTESIAN_POINT('',({number(x)},{number(y)},{number(height)}))") for x, y in polygon]
    face_ids: list[int] = []

    def add_face(vertices: list[int], origin: int, normal, reference) -> None:
        loop = add("POLY_LOOP('',(" + ",".join(f"#{value}" for value in vertices) + "))")
        bound = add(f"FACE_OUTER_BOUND('',#{loop},.T.)")
        normal_id = add(f"DIRECTION('',({vector(normal)}))")
        reference_id = add(f"DIRECTION('',({vector(reference)}))")
        placement = add(f"AXIS2_PLACEMENT_3D('',#{origin},#{normal_id},#{reference_id})")
        plane = add(f"PLANE('',#{placement})")
        face_ids.append(add(f"FACE_SURFACE('',(#{bound}),#{plane},.T.)"))

    add_face(list(reversed(bottom)), bottom[0], (0.0, 0.0, -1.0), (1.0, 0.0, 0.0))
    add_face(top, top[0], (0.0, 0.0, 1.0), (1.0, 0.0, 0.0))
    for index, (x0, y0) in enumerate(polygon):
        following = (index + 1) % len(polygon)
        x1, y1 = polygon[following]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        add_face(
            [bottom[index], bottom[following], top[following], top[index]],
            bottom[index],
            (dy / length, -dx / length, 0.0),
            (dx / length, dy / length, 0.0),
        )

    shell_id = add("CLOSED_SHELL('',(" + ",".join(f"#{value}" for value in face_ids) + "))")
    brep_id = add(f"FACETED_BREP('{name}',#{shell_id})")
    context_id = add(
        "(GEOMETRIC_REPRESENTATION_CONTEXT(3)"
        "GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#14))"
        "GLOBAL_UNIT_ASSIGNED_CONTEXT((#15,#16,#17))"
        "REPRESENTATION_CONTEXT('',''))"
    )
    representation_id = add(f"FACETED_BREP_SHAPE_REPRESENTATION('',(#{brep_id}),#{context_id})")
    header = [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('Generated SpjutSim validation fixture'),'2;1');",
        f"FILE_NAME('{name}.step','2026-09-03T00:00:00',('SpjutSim FEA'),('SpjutSim FEA'),'','SpjutSim FEA','');",
        "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));",
        "ENDSEC;",
        "DATA;",
        "#1=APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies');",
        "#2=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',1994,#1);",
        "#3=PRODUCT_CONTEXT('',#1,'mechanical');",
        f"#4=PRODUCT('{name}','{name}','generated validation fixture',(#3));",
        "#5=PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('','',#4,.NOT_KNOWN.);",
        "#6=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');",
        "#7=PRODUCT_DEFINITION('','',#5,#6);",
        "#8=PRODUCT_DEFINITION_SHAPE('','',#7);",
        f"#9=SHAPE_DEFINITION_REPRESENTATION(#8,#{representation_id});",
        "#14=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-9),#15,'','');",
        "#15=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT($,.METRE.));",
        "#16=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));",
        "#17=(NAMED_UNIT(*)SOLID_ANGLE_UNIT()SI_UNIT($,.STERADIAN.));",
    ]
    body = [f"#{entity_id}={value};" for entity_id, value in entities]
    return "\n".join(header + body + ["ENDSEC;", "END-ISO-10303-21;", ""])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "cantilever-prism.step": faceted_prism(
            "cantilever-prism", [(0, 0), (4, 0), (4, 0.25), (0, 0.25)], 0.5
        ),
        "notched-prism.step": faceted_prism(
            "notched-prism",
            [
                (0, 0), (3, 0), (3, 1), (1.8, 1), (1.8, 0.7),
                (1.2, 0.7), (1.2, 1), (0, 1),
            ],
            0.2,
        ),
    }
    for filename, content in fixtures.items():
        (args.output / filename).write_text(content, encoding="ascii")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
