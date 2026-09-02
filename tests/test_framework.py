import hashlib
import json
import pathlib
import re
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLOUDFLARE_STATIC_ASSET_LIMIT_BYTES = 25 * 1024 * 1024

class FrameworkTests(unittest.TestCase):
    def test_no_frontend_package_manifest(self):
        self.assertFalse((ROOT / 'package.json').exists())

    def test_direct_local_scripts_are_classic(self):
        html = (ROOT / 'web/index.html').read_text()
        self.assertNotIn('type="module"', html)
        self.assertNotIn('src="http', html)
        self.assertIn('vendor/three/three.min.js', html)

    def test_vendored_three_global_build_is_pinned(self):
        artifact = ROOT / 'web/vendor/three/three.min.js'
        content = artifact.read_bytes()
        self.assertIn(b'SPDX-License-Identifier: MIT', content[:200])
        self.assertIn(b'.THREE={}', content)
        self.assertEqual(
            hashlib.sha256(content).hexdigest(),
            '8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271',
        )

    def test_ui_snapshot_and_worker_shells_exist(self):
        self.assertTrue((ROOT / 'web/ui/shell-behaviors.js').exists())
        self.assertTrue((ROOT / 'workers/mesher-worker.js').exists())
        self.assertTrue((ROOT / 'workers/solver-worker.js').exists())

    def test_local_runtime_generation_matches_checked_in_artifacts(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        checked_in = ROOT / 'web/generated/local-runtime'
        with tempfile.TemporaryDirectory() as directory:
            output_dir = pathlib.Path(directory) / 'local-runtime'
            subprocess.run(
                ['python3', str(generator), '--output-dir', str(output_dir)],
                check=True,
                cwd=ROOT,
            )
            for filename in ('mesher-worker-source.js', 'solver-worker-source.js'):
                generated = (output_dir / filename).read_text(encoding='utf-8')
                self.assertEqual(generated, (checked_in / filename).read_text(encoding='utf-8'))
                self.assertIn('Worker protocol: 1', generated)
                self.assertIn('WORKER_PROTOCOL_VERSION = 1', generated)

    def test_local_runtime_generation_rejects_stale_protocol(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        with tempfile.TemporaryDirectory() as directory:
            source_dir = pathlib.Path(directory) / 'workers'
            source_dir.mkdir()
            for filename in ('mesher-worker.js', 'solver-worker.js'):
                content = (ROOT / 'workers' / filename).read_text(encoding='utf-8')
                (source_dir / filename).write_text(
                    content.replace('WORKER_PROTOCOL_VERSION = 1', 'WORKER_PROTOCOL_VERSION = 2'),
                    encoding='utf-8',
                )
            result = subprocess.run(
                [
                    'python3', str(generator), '--source-root', str(source_dir),
                    '--output-dir', str(pathlib.Path(directory) / 'output'),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('protocol is 2, expected 1', result.stderr)

    def test_gmsh_runtime_packaging_embeds_serial_inputs(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        with tempfile.TemporaryDirectory() as directory:
            temporary = pathlib.Path(directory)
            core = temporary / 'core.js'
            runtime = temporary / 'runtime.mjs'
            descriptor = temporary / 'descriptor.json'
            output = temporary / 'output'
            core.write_text('var createGmshModule = function () { return Promise.resolve({}); };\n')
            runtime.write_text('export function buildApi(Module, descriptor) { return { Module, descriptor }; }\n')
            descriptor.write_text(json.dumps({'version': 'test', 'functions': []}))

            subprocess.run(
                [
                    'python3', str(generator), '--output-dir', str(output),
                    '--gmsh-core', str(core), '--gmsh-runtime', str(runtime),
                    '--gmsh-descriptor', str(descriptor),
                    '--gmsh-part-characters', '64',
                ],
                check=True,
                cwd=ROOT,
            )
            manifest = (output / 'gmsh-runtime-source.js').read_text()
            parts = sorted(output.glob('gmsh-runtime-source-part-*.js'))
            self.assertGreater(len(parts), 1)
            source = self._read_gmsh_source_parts(parts)
            self.assertIn('initializeSpjutsimGmsh', source)
            self.assertIn('"threaded": false', manifest)
            self.assertIn('"networkRequired": false', manifest)
            self.assertNotIn('export function buildApi', source)

    def test_gmsh_runtime_packaging_rejects_threaded_core(self):
        generator = ROOT / 'tools/build-local-runtime.py'
        with tempfile.TemporaryDirectory() as directory:
            temporary = pathlib.Path(directory)
            core = temporary / 'core.js'
            runtime = temporary / 'runtime.mjs'
            descriptor = temporary / 'descriptor.json'
            core.write_text('var createGmshModule = SharedArrayBuffer;\n')
            runtime.write_text('export function buildApi() {}\n')
            descriptor.write_text('{"version":"test","functions":[]}')
            result = subprocess.run(
                [
                    'python3', str(generator),
                    '--output-dir', str(temporary / 'output'),
                    '--gmsh-core', str(core), '--gmsh-runtime', str(runtime),
                    '--gmsh-descriptor', str(descriptor),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('not a serial WASM build', result.stderr)

    def test_mesher_spike_protocol_and_normalized_errors(self):
        worker = (ROOT / 'workers/mesher-worker.js').read_text()
        bootstrap = (ROOT / 'web/js/workers/local-worker-bootstrap.js').read_text()
        protocol = (ROOT / 'web/js/workers/worker-protocol.js').read_text()
        for request_type in ('initialize', 'diagnostics', 'box-smoke', 'import', 'mesh'):
            self.assertIn("message.type !== '" + request_type + "'", worker)
        for error_code in (
            'INVALID_WORKER_REQUEST', 'WORKER_PROTOCOL_MISMATCH',
            'MESHER_INITIALIZATION_FAILED', 'MESHER_OPERATION_FAILED',
        ):
            self.assertIn(error_code, worker)
        self.assertIn("runtimeMode: 'serial-local-embedded'", worker)
        self.assertIn('gmsh.clear();', worker)
        self.assertIn('validateWorkerResponse', protocol)
        self.assertIn('LOCAL_WORKER_INVALID_RESPONSE', bootstrap)
        self.assertIn("'diagnostics-result'", bootstrap)
        self.assertIn("'box-smoke-result'", bootstrap)

    def test_step_import_contract_and_fixtures(self):
        geometry = (ROOT / 'web/js/geometry/geometry-model.js').read_text()
        client = (ROOT / 'web/js/workers/mesher-client.js').read_text()
        worker = (ROOT / 'workers/mesher-worker.js').read_text()
        controller = (ROOT / 'web/js/analysis/app-controller.js').read_text()
        cube = ROOT / 'tests/fixtures/generated-unit-cube-m.step'
        two_solids = ROOT / 'tests/fixtures/generated-two-unit-cubes-m.step'
        invalid = ROOT / 'tests/fixtures/invalid-step-text.step'
        iges = ROOT / 'tests/fixtures/generated-unit-cube-m.iges'
        brep = ROOT / 'tests/fixtures/generated-unit-cube-m.brep'
        self.assertTrue(cube.is_file())
        self.assertTrue(two_solids.is_file())
        self.assertTrue(invalid.is_file())
        self.assertTrue(iges.is_file())
        self.assertTrue(brep.is_file())
        self.assertIn('FACETED_BREP', cube.read_text())
        self.assertIn('validateGeometryModel', geometry)
        self.assertIn('validateImportRequest', geometry)
        self.assertIn('sourceBytes.slice(0)', client)
        self.assertIn('sourceFormatForFilename', geometry)
        self.assertIn("'Geometry.OCCTargetUnit'", worker)
        self.assertIn('gmsh.FS.writeFile', worker)
        self.assertIn('gmsh.model.occ.importShapes', worker)
        self.assertIn('igesScaleToMeters', worker)
        self.assertIn('gmsh.model.occ.healShapes', worker)
        for code in ('GEOMETRY_IMPORT_FAILED', 'GEOMETRY_NO_SOLID', 'MULTIPLE_SOLIDS_UNSUPPORTED', 'GEOMETRY_NOT_CLOSED'):
            self.assertIn(code, worker)
        self.assertIn('replaceGeometry', controller)
        self.assertIn('this.document.boundaryConditions = []', controller)
        self.assertIn('this.document.meshMetadata = null', controller)

    def test_worker_browser_regressions_are_covered(self):
        harness = ROOT / 'tests/browser/worker-runtime-tests.html'
        script = ROOT / 'tests/browser/worker-runtime-tests.js'
        import_harness = ROOT / 'tests/browser/step-import-tests.html'
        import_script = ROOT / 'tests/browser/step-import-tests.js'
        self.assertTrue(harness.is_file())
        content = script.read_text()
        self.assertIn('wrong response type', content)
        self.assertIn('version-mismatched response', content)
        self.assertIn('malformed structured error', content)
        self.assertIn('LOCAL_WORKER_RESPONSE_TIMEOUT', content)
        self.assertIn('worker.terminated', content)
        self.assertIn('canonical CAD bytes', content)
        self.assertIn('geometry replacement retained', content)
        self.assertTrue(import_harness.is_file())
        self.assertIn('generated-unit-cube-m.step', import_script.read_text())
        self.assertIn('generated-unit-cube-m.iges', import_script.read_text())
        self.assertIn('generated-unit-cube-m.brep', import_script.read_text())
        self.assertIn('MULTIPLE_SOLIDS_UNSUPPORTED', import_script.read_text())
        self.assertIn('cube did not expose six CAD faces', import_script.read_text())

    def test_tet4_mesh_contract_and_browser_coverage_exist(self):
        contract = (ROOT / 'web/js/mesh/volume-mesh.js').read_text()
        client = (ROOT / 'web/js/workers/mesher-client.js').read_text()
        worker = (ROOT / 'workers/mesher-worker.js').read_text()
        controller = (ROOT / 'web/js/analysis/app-controller.js').read_text()
        harness = ROOT / 'tests/browser/tet4-mesh-tests.html'
        script = ROOT / 'tests/browser/tet4-mesh-tests.js'
        self.assertIn('validateVolumeMeshResult', contract)
        self.assertIn('resolveMeshSettings', contract)
        self.assertIn("metric: 'gamma'", worker)
        self.assertIn('getElementQualities', worker)
        self.assertIn('setOutwardOrientation', worker)
        self.assertNotIn('Array.prototype.push.apply(connectivity', worker)
        self.assertIn('DEGENERATE_ELEMENTS', worker)
        self.assertIn('generateMesh', client)
        self.assertIn('sourceBytes.slice(0)', client)
        self.assertIn('replaceMeshSettings', controller)
        self.assertIn('completeMeshGeneration', controller)
        self.assertTrue(harness.is_file())
        coverage = script.read_text()
        self.assertIn("preset: 'coarse'", coverage)
        self.assertIn("preset: 'normal'", coverage)
        self.assertIn("preset: 'fine'", coverage)
        self.assertIn("preset: 'custom'", coverage)
        self.assertIn('surface area was not preserved', coverage)
        self.assertIn('boundary triangle was not oriented outward', coverage)
        self.assertIn('FaceId set changed after remeshing', coverage)

    def test_preview_face_selection_coverage_exists(self):
        viewport = (ROOT / 'web/js/render/viewport-controller.js').read_text()
        controller = (ROOT / 'web/js/analysis/app-controller.js').read_text()
        ui = (ROOT / 'web/js/ui/ui-controller.js').read_text()
        harness = ROOT / 'tests/browser/preview-selection-tests.html'
        script = ROOT / 'tests/browser/preview-selection-tests.js'
        self.assertIn('pointerToCanvasCoordinates', viewport)
        self.assertIn('triangleFaceIndices', viewport)
        self.assertIn('pickFaceAtPointer', viewport)
        self.assertIn('replaceSelectedFaces', controller)
        self.assertIn('toggleSelectedFace', controller)
        self.assertIn('clearSelectedFaces', controller)
        self.assertIn('face-selection-status', ui)
        self.assertIn("event.key !== 'Escape'", ui)
        self.assertTrue(harness.is_file())
        self.assertIn('selectEveryFace', script.read_text())
        self.assertIn('device-pixel-ratio conversion', script.read_text())
        self.assertIn('orbit input did not move the camera', script.read_text())

    def test_surface_and_mesh_visualization_contract_and_coverage_exist(self):
        geometry = (ROOT / 'web/js/geometry/geometry-model.js').read_text()
        display = (ROOT / 'web/js/mesh/mesh-display.js').read_text()
        viewport = (ROOT / 'web/js/render/viewport-controller.js').read_text()
        controller = (ROOT / 'web/js/analysis/app-controller.js').read_text()
        worker = (ROOT / 'workers/mesher-worker.js').read_text()
        index = (ROOT / 'web/index.html').read_text()
        coverage = (ROOT / 'tests/browser/preview-selection-tests.js').read_text()
        self.assertIn('normals', geometry)
        self.assertIn('featureEdges', geometry)
        self.assertIn('buildBoundaryMeshDisplay', display)
        self.assertIn('BigUint64Array', display)
        self.assertIn('setMeshDisplay', viewport)
        self.assertNotIn('EdgesGeometry', viewport)
        self.assertIn('replaceViewportPresentation', controller)
        self.assertIn('PREVIEW_MAX_SURFACE_EDGE_LENGTH_FRACTION', worker)
        self.assertIn('PREVIEW_RELATIVE_TRIANGLE_AREA_SQUARED', worker)
        self.assertIn('/ modelScaleM', worker)
        self.assertIn('extractFeatureEdges', worker)
        self.assertIn('viewport-mode', index)
        self.assertIn('display-style', index)
        self.assertIn('Model wireframe showed tessellation edges instead of CAD feature edges', coverage)
        self.assertIn('generated-cylinder-r0_5-h1-m.step', coverage)
        self.assertIn('generated-sphere-r0_5-m.step', coverage)
        for fixture in ('generated-cylinder-r0_5-h1-m.step', 'generated-sphere-r0_5-m.step'):
            self.assertTrue((ROOT / 'tests/fixtures' / fixture).is_file())

    def test_viewport_navigation_contract_and_browser_coverage_exist(self):
        navigation = (ROOT / 'web/js/render/viewport-navigation.js').read_text()
        viewport = (ROOT / 'web/js/render/viewport-controller.js').read_text()
        ui = (ROOT / 'web/js/ui/ui-controller.js').read_text()
        index = (ROOT / 'web/index.html').read_text()
        harness = ROOT / 'tests/browser/viewport-navigation-tests.html'
        script = ROOT / 'tests/browser/viewport-navigation-tests.js'
        self.assertIn('normalizeNavigationPreferences', navigation)
        self.assertIn('zoomViewportDistance', navigation)
        self.assertIn('shouldHandleViewportArrowKey', navigation)
        self.assertIn('panByPixels', viewport)
        self.assertIn('fitCurrentModel', viewport)
        self.assertIn('lostpointercapture', viewport)
        self.assertIn('openSettings', ui)
        self.assertIn("event.key === ','", ui)
        self.assertIn('settings-backdrop', index)
        self.assertTrue(harness.is_file())
        coverage = script.read_text()
        self.assertIn('pinch-out did not zoom in', coverage)
        self.assertIn('changed mouse bindings were not applied', coverage)
        self.assertIn('pointer cancellation left active navigation state', coverage)

    def test_material_support_and_load_authoring_contracts_exist(self):
        contracts = (ROOT / 'web/js/analysis/analysis-contracts.js').read_text()
        controller = (ROOT / 'web/js/analysis/app-controller.js').read_text()
        projection = (ROOT / 'web/js/analysis/solver-input.js').read_text()
        glyphs = (ROOT / 'web/js/render/analysis-glyphs.js').read_text()
        viewport = (ROOT / 'web/js/render/viewport-controller.js').read_text()
        index = (ROOT / 'web/index.html').read_text()
        harness = ROOT / 'tests/browser/analysis-authoring-tests.html'
        coverage = (ROOT / 'tests/browser/analysis-authoring-tests.js').read_text()
        for name in ('validateIsotropicMaterial', 'validateBoundaryCondition', 'validateLoad', 'validateGravity', 'displayToSI', 'siToDisplay'):
            self.assertIn(name, contracts)
        for command in ('replaceMaterial', 'createBoundaryCondition', 'replaceBoundaryCondition', 'selectBoundaryCondition',
                        'removeBoundaryCondition', 'createLoad', 'replaceLoad', 'selectLoad', 'removeLoad', 'replaceGravity'):
            self.assertIn(command, controller)
        self.assertIn('equivalentTotalForce', projection)
        self.assertIn('triangleAreasM2', projection)
        self.assertIn('buildAnalysisGlyphDescriptors', glyphs)
        self.assertIn('analysis-overlay', viewport)
        self.assertIn("--ui-color-load", viewport)
        self.assertIn("--ui-color-support", viewport)
        for element_id in ('material-form', 'support-form', 'load-form', 'gravity-form'):
            self.assertIn(element_id, index)
        for inspector_id in ('setup-inspector', 'setup-inspector-model-list', 'setup-inspector-material-list', 'setup-inspector-support-list',
                             'setup-inspector-load-list', 'setup-inspector-form-stash'):
            self.assertIn(inspector_id, index)
        for legacy_section_id in ('material-tool', 'supports-tool', 'loads-tool'):
            self.assertNotIn(f'id="{legacy_section_id}"', index)
        self.assertTrue(harness.is_file())
        self.assertIn('positive pressure did not integrate inward', coverage)
        self.assertIn('total force was divided by nodes instead of integrated by area', coverage)
        self.assertIn('glyphs were not stable across remeshes', coverage)
        preview_coverage = (ROOT / 'tests/browser/preview-selection-tests.js').read_text()
        self.assertIn('repeated item edits leaked the previous Three.js glyph geometry', preview_coverage)
        self.assertIn('load glyph did not resolve its color from the active theme token', preview_coverage)

    def test_gmsh_build_is_serial_and_embedded(self):
        build_script = (ROOT / 'tools/build-gmsh-local-runtime.sh').read_text()
        self.assertIn('-DENABLE_OPENMP=OFF', build_script)
        self.assertIn('-DBUILD_MODULE_DETools=OFF', build_script)
        self.assertIn('-sSINGLE_FILE=1', build_script)
        self.assertIn('-sENVIRONMENT=worker', build_script)
        self.assertNotIn('-pthread', build_script)
        self.assertIn('EMSDK_COMMIT=', build_script)
        self.assertIn('OCCT_ARCHIVE_SHA256=', build_script)
        self.assertIn('OCCT_SOURCE_SHA256=', build_script)
        self.assertIn('verify_file_sha256 "$archive"', build_script)
        self.assertIn('verify_source_tree "$OCCT_SOURCE"', build_script)
        self.assertNotIn('cmake --install "$OCCT_BUILD" || true', build_script)

    def test_pinned_gmsh_runtime_artifact(self):
        runtime_dir = ROOT / 'web/generated/local-runtime'
        manifest = (runtime_dir / 'gmsh-runtime-source.js').read_text(encoding='utf-8')
        parts = sorted(runtime_dir.glob('gmsh-runtime-source-part-*.js'))
        source = self._read_gmsh_source_parts(parts)
        self.assertIn('"gmshJs": "v0.3.0"', manifest)
        self.assertIn('"occtVersion": "7.8.1"', manifest)
        self.assertEqual(
            hashlib.sha256(source.encode('utf-8')).hexdigest(),
            '49e61f1b64e86d1bcdbb15bef03bf4077c2c4530d55a943a87a9fb5212b8f0de',
        )
        self.assertNotIn('SharedArrayBuffer', source)
        self.assertNotIn('PThread', source)
        for filename in (
            'GMSH-JS-LICENSE.txt', 'GMSH-LICENSE.txt',
            'OCCT-LGPL-2.1.txt', 'OCCT-LGPL-EXCEPTION.txt',
        ):
            self.assertTrue((ROOT / 'web/wasm/gmsh/licenses' / filename).is_file())

    def test_gmsh_runtime_assets_fit_cloudflare_static_hosting(self):
        artifacts = sorted((ROOT / 'web/generated/local-runtime').glob('gmsh-runtime-source*.js'))
        self.assertGreater(len(artifacts), 1, 'the embedded Gmsh runtime must be split across static assets')
        oversized = [artifact.name for artifact in artifacts if artifact.stat().st_size > CLOUDFLARE_STATIC_ASSET_LIMIT_BYTES]
        self.assertEqual(oversized, [], 'Gmsh runtime assets exceed Cloudflare\'s 25 MiB per-file limit')

    def _read_gmsh_source_parts(self, artifacts):
        chunks = []
        for expected_index, artifact in enumerate(artifacts):
            match = re.search(r'^  runtime\.gmshParts\[(\d+)\] = (.+);$', artifact.read_text(encoding='utf-8'), re.MULTILINE)
            self.assertIsNotNone(match, artifact.name + ' did not assign a Gmsh source part')
            self.assertEqual(int(match.group(1)), expected_index)
            chunks.append(json.loads(match.group(2)))
        return ''.join(chunks)

    def test_wasm_solver_and_result_vertical_slice_exists(self):
        build = (ROOT / 'tools/build-wasm.sh').read_text()
        worker = (ROOT / 'workers/solver-worker.js').read_text()
        client = (ROOT / 'web/js/workers/solver-client.js').read_text()
        result_model = (ROOT / 'web/js/analysis/result-model.js').read_text()
        viewport = (ROOT / 'web/js/render/viewport-controller.js').read_text()
        coverage = (ROOT / 'tests/browser/wasm-solve-result-tests.js').read_text()
        self.assertIn('-sSINGLE_FILE=1', build)
        self.assertIn('-sENVIRONMENT=worker', build)
        self.assertNotIn('-pthread', build)
        self.assertIn('WASM_HEAP_CAP_BYTES = 3758096384', worker)
        self.assertIn('preflight-result', worker)
        self.assertIn('solve-result', worker)
        self.assertIn('cloneSolverTransferInput', client)
        self.assertIn('validateResultModel', result_model)
        self.assertIn('setResultModel', viewport)
        self.assertIn('pickResultAtPointer', viewport)
        self.assertIn('Stress/von Mises was not activated after solve', coverage)
        cube_coverage = (ROOT / 'tests/browser/cube-wasm-vertical-slice-tests.js').read_text()
        self.assertIn('cube axial displacement missed the analytical target', cube_coverage)
        self.assertIn("['model', 'mesh', 'stress', 'deformation']", cube_coverage)
        self.assertTrue((ROOT / 'web/wasm/fem/fem.js').is_file())
        self.assertTrue((ROOT / 'web/generated/local-runtime/fem-runtime-source.js').is_file())

if __name__ == '__main__':
    unittest.main()
