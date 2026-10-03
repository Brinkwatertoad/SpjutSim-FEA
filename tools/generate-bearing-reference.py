#!/usr/bin/env python3
"""Generate an independent CalculiX bearing deck from exported browser mesh JSON.

The reference integrates compression independently with 6x6 Gauss-Legendre
quadrature after a Duffy square-to-triangle map. The app uses a degree-five
triangle rule. Both normalize the same cosine distribution to the entered force.
SI units; native/Gmsh Tet10 edges 8/9 are swapped for CalculiX C3D10 ordering.
"""
import argparse
import json
import math
from pathlib import Path

GAUSS = ((.033765242898423975, .08566224618958517),
         (.16939530676686776, .1803807865240693),
         (.38069040695840155, .23395696728634552),
         (.6193095930415985, .23395696728634552),
         (.8306046932331322, .1803807865240693),
         (.966234757101576, .08566224618958517))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def integrate(data):
    positions = data['positions']
    faces = data['surfaceConnectivity']
    count = 6 if data['elementType'] == 'tet10' else 3
    force = data['load']['forceN']
    norm = math.hypot(*force)
    direction = [v/norm for v in force]
    forces = [[0., 0., 0.] for _ in range(len(positions)//3)]
    for start in range(0, len(faces), count):
        nodes = faces[start:start+count]
        coords = [positions[n*3:n*3+3] for n in nodes]
        for u, wu in GAUSS:
            for v, wv in GAUSS:
                l = [1-u-(1-u)*v, u, (1-u)*v]
                dl = ((-1., -1.), (1., 0.), (0., 1.))
                shape = l[:]
                deriv = [list(d) for d in dl]
                if count == 6:
                    shape = [x*(2*x-1) for x in l]
                    deriv = [[(4*l[n]-1)*d for d in dl[n]] for n in range(3)]
                    for i, j in ((0,1), (1,2), (2,0)):
                        shape.append(4*l[i]*l[j])
                        deriv.append([4*(dl[i][a]*l[j]+l[i]*dl[j][a]) for a in range(2)])
                tangents = [[sum(deriv[n][a]*(coords[n][b]-coords[0][b]) for n in range(count)) for b in range(3)] for a in range(2)]
                area = cross(*tangents)
                jacobian = math.hypot(*area)
                normal = [x/jacobian for x in area]
                cosine = max(0., -sum(x*y for x,y in zip(normal,direction)))
                weight = wu*wv*(1-u)*jacobian
                for n, node in enumerate(nodes):
                    for a in range(3):
                        forces[node][a] -= shape[n]*weight*cosine*normal[a]
    resultant = [sum(f[a] for f in forces) for a in range(3)]
    projection = sum(x*y for x,y in zip(resultant,direction))
    if not projection > 0:
        raise ValueError('Bearing reference has no loaded half-cylinder')
    return [[v*norm/projection for v in f] for f in forces]


def deck(data, forces):
    positions, elements = data['positions'], data['connectivity']
    count = 10 if data['elementType'] == 'tet10' else 4
    lines = ['** Independent cosine bearing reference; SI; Duffy 6x6 quadrature', '*NODE']
    for node in range(len(positions)//3):
        lines.append(f'{node+1}, ' + ', '.join(f'{v:.12g}' for v in positions[node*3:node*3+3]))
    lines.append(f'*ELEMENT, TYPE=C3D{count}, ELSET=EALL')
    for start in range(0,len(elements),count):
        nodes = elements[start:start+count]
        if count == 10:
            nodes[8], nodes[9] = nodes[9], nodes[8]
        lines.append(f'{start//count+1}, ' + ', '.join(str(n+1) for n in nodes))
    lines += ['*NSET, NSET=NALL, GENERATE', f'1, {len(positions)//3}, 1', '*SOLID SECTION, ELSET=EALL, MATERIAL=MAT', '*MATERIAL, NAME=MAT', '*ELASTIC', f"{data['material']['youngsModulusPa']:.12g}, {data['material']['poissonsRatio']:.12g}", '*BOUNDARY']
    lines += [f'{node+1}, 1, 3, 0' for node in data['supports']]
    lines += ['*STEP', '*STATIC', '*CLOAD']
    lines += [f'{node+1}, {a+1}, {v:.12g}' for node,f in enumerate(forces) for a,v in enumerate(f) if v != 0]
    lines += ['*NODE PRINT, NSET=NALL', 'U', '*EL PRINT, ELSET=EALL', 'S', '*END STEP', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    forces = integrate(data)
    args.output.write_text(deck(data, forces))
    args.output.with_suffix('.loads.json').write_text(json.dumps(forces)+'\n')


if __name__ == '__main__':
    main()
