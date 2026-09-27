#!/usr/bin/env node
// Optional verification tooling only; the browser app has no Node dependency.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Usage: node tools/run-browser-tests.cjs --all | TEST [TEST ...]\n' +
    'Environment: FEA_PLAYWRIGHT_MODULE, FEA_CHROMIUM_PATH, FEA_TEST_HTTP (e.g. http://127.0.0.1:8000), FEA_TEST_DPR (1 or 2), FEA_TEST_REPORT.\n' +
    '--all excludes cad-corpus, resource-benchmark and validation-benchmark; run these explicitly.');
  process.exit(args.includes('--help') ? 0 : 2);
}
const testDir = path.join(root, 'tests/browser');
const available = fs.readdirSync(testDir).filter(n => n.endsWith('-tests.html')).map(n => n.slice(0, -11)).sort();
const benchmarks = new Set(['cad-corpus', 'resource-benchmark', 'validation-benchmark']);
const names = args.length === 1 && args[0] === '--all' ? available.filter(n => !benchmarks.has(n)) : args;
if (names.some(n => !available.includes(n))) throw Error('Unknown test name. Use filenames without -tests.html, or --all alone.');
const modulePath = process.env.FEA_PLAYWRIGHT_MODULE || path.join(root, 'build/verification-tools/node_modules/playwright');
const executablePath = process.env.FEA_CHROMIUM_PATH || path.join(root, 'build/operator-tools/chrome-full/chrome-linux64/chrome');
const deviceScaleFactor = Number(process.env.FEA_TEST_DPR || 1);
if (![1, 2].includes(deviceScaleFactor)) throw Error('FEA_TEST_DPR must be 1 or 2.');
const baseURL = process.env.FEA_TEST_HTTP;
if (baseURL && !/^https?:\/\//.test(baseURL)) throw Error('FEA_TEST_HTTP must be an HTTP(S) URL.');
const reportPath = path.resolve(root, process.env.FEA_TEST_REPORT || 'build/browser-tests-' + (baseURL ? 'http' : 'file') + '.json');
async function main() {
  let chromium;
  try { ({chromium} = require(modulePath)); }
  catch (error) { throw Error('Playwright is not available. Set FEA_PLAYWRIGHT_MODULE to an existing installation; see README.'); }
  const browser = await chromium.launch({executablePath, headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--enable-unsafe-swiftshader']});
  const report = {browser: await browser.version(), mode: baseURL || 'file://', deviceScaleFactor, checks: []};
  let failed = false;
  try {
    for (const name of names) {
      const page = await browser.newPage({viewport: {width: 1440, height: 1000}, deviceScaleFactor});
      const errors = []; let status = 'Failed before completion', evidence = null;
      page.on('pageerror', error => errors.push(error.message));
      try {
        const url = baseURL ? new URL('tests/browser/' + name + '-tests.html', baseURL.replace(/\/?$/, '/')).href :
          pathToFileURL(path.join(testDir, name + '-tests.html')).href;
        await page.goto(url);
        await page.waitForFunction(() => {
          const node = document.getElementById('test-status');
          return node && (node.dataset.result || /^(Passed|Failed)/.test(node.textContent));
        }, null, {timeout: 300000});
        status = await page.locator('#test-status').evaluate(node => node.dataset.result === 'failed' && !node.textContent.startsWith('Failed') ? 'Failed: ' + node.textContent : node.textContent);
        evidence = await page.evaluate(() => window.__spjutsimUsabilityEvidence || window.__spjutsimConvergenceEvidence || null);
      } catch (error) { errors.push(error.message); }
      finally { await page.close(); }
      const passed = status.startsWith('Passed') && !errors.length;
      failed ||= !passed;
      report.checks.push({name, status, errors, evidence});
      console.log(name + ': ' + status + (errors.length ? '\n' + errors.join('\n') : ''));
      fs.mkdirSync(path.dirname(reportPath), {recursive: true});
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
  } finally { await browser.close(); }
  console.log(report.checks.length + ' harnesses; report: ' + reportPath);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
