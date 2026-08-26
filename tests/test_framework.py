import hashlib
import json
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

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
                ],
                check=True,
                cwd=ROOT,
            )
            generated = (output / 'gmsh-runtime-source.js').read_text()
            self.assertIn('initializeSpjutsimGmsh', generated)
            self.assertIn('"threaded": false', generated)
            self.assertIn('"networkRequired": false', generated)
            self.assertNotIn('export function buildApi', generated)

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
        self.assertTrue(cube.is_file())
        self.assertTrue(two_solids.is_file())
        self.assertTrue(invalid.is_file())
        self.assertIn('FACETED_BREP', cube.read_text())
        self.assertIn('validateGeometryModel', geometry)
        self.assertIn('validateImportRequest', geometry)
        self.assertIn('stepBytes.slice(0)', client)
        self.assertIn("'Geometry.OCCTargetUnit', 'M'", worker)
        self.assertIn('gmsh.FS.writeFile', worker)
        self.assertIn('gmsh.model.occ.importShapes', worker)
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
        self.assertIn('canonical STEP bytes', content)
        self.assertIn('geometry replacement retained', content)
        self.assertTrue(import_harness.is_file())
        self.assertIn('generated-unit-cube-m.step', import_script.read_text())
        self.assertIn('MULTIPLE_SOLIDS_UNSUPPORTED', import_script.read_text())
        self.assertIn('expected six opaque CAD face IDs', import_script.read_text())

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
        self.assertIn('stepBytes.slice(0)', client)
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
        self.assertIn('extractFeatureEdges', worker)
        self.assertIn('viewport-mode', index)
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
        artifact = ROOT / 'web/generated/local-runtime/gmsh-runtime-source.js'
        content = artifact.read_bytes()
        self.assertEqual(len(content), 59054731)
        self.assertEqual(
            hashlib.sha256(content).hexdigest(),
            '0c84578c3be1e51064fb6f74c68661e32d5e33286797c3dacb2e85ff3700d7c6',
        )
        self.assertNotIn(b'SharedArrayBuffer', content)
        self.assertNotIn(b'PThread', content)
        for filename in (
            'GMSH-JS-LICENSE.txt', 'GMSH-LICENSE.txt',
            'OCCT-LGPL-2.1.txt', 'OCCT-LGPL-EXCEPTION.txt',
        ):
            self.assertTrue((ROOT / 'web/wasm/gmsh/licenses' / filename).is_file())

if __name__ == '__main__':
    unittest.main()
