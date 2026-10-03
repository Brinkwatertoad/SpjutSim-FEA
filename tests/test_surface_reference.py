"""Independent-reference regressions: load signs and complete numerical evidence."""
import importlib.util
import math
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/f'{name}.py')
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result)
    return result

class SurfaceReferenceTests(unittest.TestCase):
    def test_reference_cosine_load_reverses_loaded_half_and_preserves_resultant(self):
        generator=module('generate-bearing-reference')
        positions=[];faces=[]
        for i in range(32):
            angle=i*2*math.pi/32
            for z in (0,1):positions += [math.cos(angle),math.sin(angle),z]
        for i in range(32):
            a,b=i*2,((i+1)%32)*2
            faces += [a,b,b+1,a,b+1,a+1]
        for sign in (-1,1):
            data={'positions':positions,'surfaceConnectivity':faces,'elementType':'tet4','load':{'forceN':[sign*100.,0,0]}}
            forces=generator.integrate(data)
            for a,want in enumerate((sign*100.,0.,0.)):
                self.assertAlmostEqual(sum(f[a] for f in forces),want,places=10)
            self.assertTrue(all(f[0]*sign>=-1e-12 for f in forces))
            moments=[0.,0.,0.]
            for n,f in enumerate(forces):
                arm=positions[n*3:n*3+3];arm[2]-=.5
                m=generator.cross(arm,f)
                for a in range(3):moments[a]+=m[a]
            self.assertLess(math.hypot(*moments),1e-10)

    def test_reference_comparison_requires_strain_energy_evidence(self):
        compare=module('compare-bearing-reference').compare
        data={'positions':[0.,0,0,1,0,0,0,1,0,0,0,1], 'connectivity':[0,1,2,3], 'elementType':'tet4',
              'displacement':[0.,0,0,1e-6,0,0,0,0,0,0,0,0], 'stress':[1.,0,0,0,0,0]}
        u={0:[0.,0,0],1:[1e-6,0,0],2:[0.,0,0],3:[0.,0,0]}
        with self.assertRaisesRegex(ValueError,'energy'):
            compare(data,u,{0:[[1.,0,0,0,0,0]]},[[0.,0,0],[1.,0,0],[0.,0,0],[0.,0,0]])
