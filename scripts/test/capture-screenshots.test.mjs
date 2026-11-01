import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, parseArgs, parseLaunchArgs, openWebUiUrl, variantFile } from '../capture-screenshots.mjs';

const byName = (name) => SHOTS.find((s) => s.name === name);

test('shot names are unique kebab-case', () => {
  const names = SHOTS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('every shot has a route or url, a file, and an expect', () => {
  for (const s of SHOTS) {
    assert.ok(s.route || s.url, `${s.name} needs a route or a url`);
    if (s.route) assert.ok(s.route.startsWith('#'), `${s.name} route must be a hash route`);
    if (s.url) assert.doesNotThrow(() => new URL(s.url), `${s.name} url must parse`);
    assert.equal(typeof s.file, 'string', `${s.name} file`);
    assert.match(s.file, /^[a-z0-9]+(-[a-z0-9]+)*\.png$/, `${s.name} file is a 1x png name`);
    assert.ok(typeof s.expect === 'string' && s.expect.length > 0, `${s.name} needs expect`);
  }
});

test('no two shots share a file', () => {
  const files = SHOTS.map((s) => s.file);
  assert.equal(new Set(files).size, files.length);
});

test('a shot file defaults to <name>.png', () => {
  for (const s of SHOTS) assert.equal(s.file, `${s.name}.png`, s.name);
});

test('variantFile inserts the retina suffix before the extension', () => {
  assert.equal(variantFile('slot-card.png', ''), 'slot-card.png');
  assert.equal(variantFile('slot-card.png', '@2x'), 'slot-card@2x.png');
});

test('required shots exist', () => {
  const names = SHOTS.map((s) => s.name);
  const required = [
    'slot-card',
    'profile-edit-drawer',
    'slot-drawer',
    'dashboard-overview',
    'slots-inference',
    'memory-graph',
    // new surfaces
    'openwebui-picker',
    'openwebui-chat',
    'image-gen-models',
    'image-gen-generate',
    'approvals-inbox',
    'dock-gpu',
    'overview-now',
    'memory-reflect',
    'settings-doctor',
  ];
  for (const n of required) assert.ok(names.includes(n), n);
});

test('retired shots are gone', () => {
  const names = SHOTS.map((s) => s.name);
  for (const n of ['mtp-control', 'requests-latency-widget']) assert.ok(!names.includes(n), n);
});

test('Overview selectors follow the redesigned Overview', () => {
  assert.match(byName('dashboard-overview').expect, /\.ov-mem-seg/);
  assert.equal(byName('unified-memory-hero').clip, '.ov-now');
  assert.match(byName('image-gen-comfyui').expect, /image-gen-pane/);
  for (const s of SHOTS) {
    const sel = `${s.expect ?? ''} ${s.clip ?? ''} ${(s.area ?? []).join(' ')}`;
    assert.ok(!sel.includes('.rd-'), `${s.name} still uses a pre-redesign .rd- selector`);
  }
});

test('new dashboard shots use the routes in the redesign spec', () => {
  assert.equal(byName('image-gen-models').route, '#slots/image/models');
  assert.equal(byName('image-gen-generate').route, '#slots/image/generate');
  assert.equal(byName('settings-doctor').route, '#settings/doctor');
  assert.equal(byName('memory-reflect').route, '#memory/bank');
  assert.equal(byName('overview-now').route, '#dashboard');
  assert.equal(byName('overview-now').clip, '.ov-now');
  assert.equal(byName('approvals-inbox').route, '#dashboard');
  assert.equal(byName('dock-gpu').route, '#dashboard');
});

test('Open WebUI shots target their own origin, not a dashboard route', () => {
  for (const n of ['openwebui-picker', 'openwebui-chat']) {
    const s = byName(n);
    assert.ok(s.url, `${n} url`);
    assert.equal(s.route, undefined, `${n} has no dashboard route`);
    assert.equal(s.verify, true, `${n} selectors are a best guess until confirmed`);
  }
});

test('verify is a boolean flag when present', () => {
  for (const s of SHOTS) {
    if ('verify' in s) assert.equal(s.verify, true, s.name);
  }
});

test('no shot targets ri-defaults testid', () => {
  for (const s of SHOTS) {
    assert.ok(!`${s.expect ?? ''}${s.clip ?? ''}`.includes('data-testid="ri-defaults"'), s.name);
  }
});

test('openWebUiUrl prefers HAL0_OPENWEBUI_URL', () => {
  assert.equal(openWebUiUrl({ HAL0_OPENWEBUI_URL: 'http://chat.example:9000' }, 'http://hal0.local:8080'), 'http://chat.example:9000');
});

test('openWebUiUrl falls back to the dashboard host on port 3001', () => {
  assert.equal(openWebUiUrl({}, 'http://hal0.local:8080'), 'http://hal0.local:3001');
  assert.equal(openWebUiUrl({}, 'http://localhost:8080'), 'http://localhost:3001');
  assert.equal(openWebUiUrl({ HAL0_OPENWEBUI_URL: '  ' }, 'http://hal0.local:8080/'), 'http://hal0.local:3001');
});

test('parseLaunchArgs keeps a quoted argument whole and strips the quotes', () => {
	assert.deepEqual(parseLaunchArgs('--host-resolver-rules="MAP hal0.local 10.0.0.5" --no-sandbox'), [
		'--host-resolver-rules=MAP hal0.local 10.0.0.5',
		'--no-sandbox',
	]);
	assert.deepEqual(parseLaunchArgs(''), []);
	assert.deepEqual(parseLaunchArgs(undefined), []);
	assert.deepEqual(parseLaunchArgs('["--a b", "--c"]'), ['--a b', '--c']);
});

test('parseArgs reads --out <dir>', () => {
  assert.deepEqual(parseArgs(['--out', '/tmp/x']), { out: '/tmp/x' });
  assert.deepEqual(parseArgs(['--out=/tmp/y']), { out: '/tmp/y' });
});

test('parseArgs collects positional shot names', () => {
  assert.deepEqual(parseArgs(['slot-card', 'memory-graph']), { names: ['slot-card', 'memory-graph'] });
  assert.deepEqual(parseArgs([]), {});
});

test('parseArgs mixes --out and shot names in any order', () => {
  assert.deepEqual(parseArgs(['slot-card', '--out', '/tmp/x', 'memory-graph']), {
    out: '/tmp/x',
    names: ['slot-card', 'memory-graph'],
  });
});

test('parseArgs rejects a dangling --out and unknown options', () => {
  assert.throws(() => parseArgs(['--out']), /--out/);
  assert.throws(() => parseArgs(['--out', '--other']), /--out/);
  assert.throws(() => parseArgs(['--nope']), /--nope/);
});

// ── scripts/capture-screenshots.sh ───────────────────────────────────────────
// Run the wrapper against a stub `docker` that prints its argv, one per line,
// so the container invocation can be checked without a Docker daemon.
const SH = resolve(dirname(fileURLToPath(import.meta.url)), '../capture-screenshots.sh');

function runWrapper(args) {
  const dir = mkdtempSync(join(tmpdir(), 'cap-sh-'));
  try {
    const stub = join(dir, 'docker');
    writeFileSync(stub, '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done\n');
    chmodSync(stub, 0o755);
    const res = spawnSync('bash', [SH, ...args], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HAL0_BOX_IP: '10.0.0.5' },
      encoding: 'utf8',
      cwd: dir,
    });
    return { ...res, argv: res.stdout.split('\n') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('wrapper runs the container on the host network', () => {
  const { status, argv } = runWrapper([]);
  assert.equal(status, 0);
  const i = argv.indexOf('--network');
  assert.ok(i >= 0 && argv[i + 1] === 'host', 'expected --network host');
});

test('wrapper passes the Open WebUI url through to the container', () => {
  const { argv } = runWrapper([]);
  assert.ok(argv.includes('HAL0_OPENWEBUI_URL'));
});

test('wrapper mounts --out and hands the script an absolute path', () => {
  const out = join(tmpdir(), 'cap-sh-out-' + process.pid);
  try {
    const { status, argv, stderr } = runWrapper(['--out', out, 'slot-card']);
    assert.equal(status, 0, stderr);
    assert.ok(argv.includes(`${out}:${out}`), 'expected a -v mount of the out dir');
    const i = argv.indexOf('--out');
    assert.ok(i >= 0 && argv[i + 1] === out, 'expected --out <abs dir> after the script');
    assert.ok(argv.includes('slot-card'), 'shot names still pass through');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('wrapper does not mount an --out dir that is already inside the repo', () => {
  const root = resolve(dirname(SH), '..');
  const out = join(root, 'public', 'screenshots');
  const { status, argv, stderr } = runWrapper(['--out', out]);
  assert.equal(status, 0, stderr);
  assert.ok(!argv.includes(`${out}:${out}`), 'the repo mount already covers it');
  assert.ok(argv.includes(`${root}:${root}`), 'the repo mount is still there');
  assert.equal(argv[argv.indexOf('--out') + 1], out);
});

test('wrapper rejects --out without a directory', () => {
  const { status, stderr } = runWrapper(['--out']);
  assert.notEqual(status, 0);
  assert.match(stderr, /--out/);
});
