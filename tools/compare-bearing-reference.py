#!/usr/bin/env python3
"""Compare exported SpjutSim bearing results with an independent CalculiX run."""
import argparse
import json
import math
from pathlib import Path


def read_dat(path):
    displacements, stresses, section = {}, {}, None
    for line in path.read_text().splitlines():
        if 'displacements (' in line:
            section = 'u'
        elif 'stresses (' in line:
            section = 's'
        fields = line.split()
        if not fields or not fields[0].isdigit():
            continue
        if section == 'u' and len(fields) == 4:
            displacements[int(fields[0])-1] = [float(v) for v in fields[1:]]
        elif section == 's' and len(fields) == 8:
            stresses.setdefault(int(fields[0])-1, []).append([float(v) for v in fields[2:]])
    return displacements, stresses


def vm(s):
    return math.sqrt(((s[0]-s[1])**2+(s[1]-s[2])**2+(s[2]-s[0])**2)/2+3*sum(v*v for v in s[3:]))


def compare(data, displacements, stresses, forces):
    if len(displacements) != len(data['positions'])//3:
        raise ValueError('CalculiX displacement output is incomplete')
    maximum = max(math.hypot(*v) for v in displacements.values())
    actual = max(math.hypot(*data['displacement'][n*3:n*3+3]) for n in displacements)
    displacement_error = abs(actual/maximum-1)
    reference_energy = sum(sum(u[a]*forces[n][a] for a in range(3)) for n,u in displacements.items())/2
    actual_energy = data.get('strainEnergyJ')
    if not isinstance(actual_energy,(int,float)) or not math.isfinite(actual_energy) or actual_energy<0 or not reference_energy>0:
        raise ValueError('Complete finite strain energy evidence is required')
    count = 10 if data['elementType'] == 'tet10' else 4
    if len(stresses)!=len(data['connectivity'])//count or any(len(v)!=(4 if count==10 else 1) for v in stresses.values()):
        raise ValueError('CalculiX stress output is incomplete')
    # Probe at x=.75,y=.5,z=.15: away from the fixed face, hole wall and load edges.
    target = [.75,.5,.15]
    best = None
    for e, samples in stresses.items():
        nodes = data['connectivity'][e*count:e*count+4]
        center = [sum(data['positions'][n*3+a] for n in nodes)/4 for a in range(3)]
        distance = math.dist(center,target)
        if best is None or distance < best[0]:
            best = (distance,e,center,samples)
    if best is None:
        raise ValueError('CalculiX stress output is missing')
    _, element, center, samples = best
    reference_stress = vm([sum(v[a] for v in samples)/len(samples) for a in range(6)])
    actual_stress = vm(data['stress'][element*6:element*6+6])
    stress_error = abs(actual_stress/reference_stress-1)
    energy_error = abs(actual_energy/reference_energy-1)
    result = {'referenceSolver':'CalculiX 2.21','referenceQuadrature':'6x6 Duffy Gauss-Legendre',
              'nodeCount':len(displacements),'elementCount':len(stresses),
              'maxDisplacementM':actual,'referenceMaxDisplacementM':maximum,'displacementRelativeError':displacement_error,
              'probeElement':element,'probeLocationM':center,'probeVonMisesPa':actual_stress,
              'referenceProbeVonMisesPa':reference_stress,'stressRelativeError':stress_error,
              'strainEnergyJ':actual_energy,'referenceStrainEnergyJ':reference_energy,'energyRelativeError':energy_error,
              'limits':{'displacement':.03,'stress':.05,'energy':.03}}
    if displacement_error>.03 or stress_error>.05 or (energy_error is not None and energy_error>.03):
        raise ValueError('Bearing reference acceptance failed: '+json.dumps(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path)
    parser.add_argument('dat',type=Path)
    parser.add_argument('loads',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    data=json.loads(args.input.read_text())
    u,s=read_dat(args.dat)
    result=compare(data,u,s,json.loads(args.loads.read_text()))
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()
