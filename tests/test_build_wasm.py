"""Exercise toolchain discovery without compiling or changing runtime artifacts."""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class BuildWasmTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='fea build ')
        self.addCleanup(self.directory.cleanup)
        self.root = pathlib.Path(self.directory.name).resolve()
        (self.root / 'tools').mkdir()
        shutil.copy2(ROOT / 'tools/build-wasm.sh', self.root / 'tools/build-wasm.sh')
        self.bin = self.root / 'commands'
        self.bin.mkdir()
        for command in ('dirname', 'mkdir'):
            (self.bin / command).symlink_to(shutil.which(command))
        self.env = dict(os.environ, PATH=str(self.bin))
        for key in ('EMXX', 'EMSDK', 'SPJUTSIM_EMSDK_ROOT', 'SPJUTSIM_GMSH_BUILD_ROOT'):
            self.env.pop(key, None)

    def compiler(self, directory):
        directory.mkdir(parents=True, exist_ok=True)
        compiler = directory / 'em++'
        # Stop at the external compiler boundary, before generated files are touched.
        compiler.write_text('#!/bin/sh\nprintf "%s\\n" "$0" "$PWD"\nexit 73\n')
        compiler.chmod(0o755)
        return compiler

    def sdk(self, directory):
        compiler = self.compiler(directory / 'bin')
        (directory / 'emsdk_env.sh').write_text('export PATH="$PWD/bin:$PATH"\n')
        return compiler

    def run_build(self):
        return subprocess.run(
            ['/bin/sh', str(self.root / 'tools/build-wasm.sh')],
            cwd=self.root, env=self.env, text=True, capture_output=True,
        )

    def assert_compiler(self, expected):
        result = self.run_build()
        self.assertEqual(73, result.returncode, result.stderr)
        self.assertEqual([str(expected), str(self.root)], result.stdout.splitlines())

    def test_discovers_both_repository_sdk_layouts(self):
        for relative in ('build/gmsh-local-runtime/emsdk', 'build/emsdk'):
            with self.subTest(layout=relative):
                directory = self.root / relative
                self.assert_compiler(self.sdk(directory))
                shutil.rmtree(directory)

    def test_discovers_custom_gmsh_build_root(self):
        directory = self.root / 'custom gmsh'
        self.env['SPJUTSIM_GMSH_BUILD_ROOT'] = str(directory)
        self.assert_compiler(self.sdk(directory / 'emsdk'))

    def test_explicit_sdk_overrides_repository_sdk_and_path(self):
        self.sdk(self.root / 'build/emsdk')
        self.compiler(self.bin)
        directory = self.root / 'external sdk'
        self.env['SPJUTSIM_EMSDK_ROOT'] = 'external sdk'
        self.assert_compiler(self.sdk(directory))

    def test_explicit_compiler_does_not_source_another_sdk(self):
        self.sdk(self.root / 'build/emsdk')
        (self.root / 'build/emsdk/emsdk_env.sh').write_text('exit 74\n')
        compiler = self.compiler(self.root / 'explicit compiler')
        self.env['EMXX'] = str(compiler)
        self.assert_compiler(compiler)

    def test_uses_path_when_no_sdk_is_present(self):
        self.assert_compiler(self.compiler(self.bin))

    def test_invalid_explicit_sdk_does_not_fall_back(self):
        self.compiler(self.bin)
        self.env['SPJUTSIM_EMSDK_ROOT'] = str(self.root / 'missing sdk')
        result = self.run_build()
        self.assertEqual(1, result.returncode, result.stderr)
        self.assertIn('SPJUTSIM_EMSDK_ROOT', result.stderr)

    def test_missing_toolchain_reports_configuration_options(self):
        result = self.run_build()
        self.assertEqual(1, result.returncode)
        self.assertIn('SPJUTSIM_EMSDK_ROOT', result.stderr)
        self.assertIn('EMXX', result.stderr)


if __name__ == '__main__':
    unittest.main()
