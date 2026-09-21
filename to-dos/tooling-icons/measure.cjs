'use strict';
// Grades every svg/<app>-<n>-<label>.svg with the hand-off studio's own lint, render, metrics and
// pairwise gate, against the three marks in shipping/. The studio itself is not in the repo
// (HANDOFF.md §8): unzip /Users/Shared/tooling-icons-handoff.zip somewhere and run, from this repo
// (its node_modules has @playwright/test — no CountTooling checkout needed):
//
//   NODE_PATH=$PWD/node_modules STUDIO=<unzipped>/handoff/studio DIR=to-dos/tooling-icons \
//     OUT=to-dos/tooling-icons/audit.json node to-dos/tooling-icons/measure.cjs
//
// then `node to-dos/tooling-icons/build-board.mjs`. ONLY=connect,gov limits it to those apps
// (the shipping three are always measured, so vsShipping stays right). Thresholds are the
// studio's, frozen (HANDOFF.md §5) — a failure is a redraw or written-down debt, never a re-tune.
const fs = require('fs'), path = require('path');
const STUDIO = process.env.STUDIO, DIR = process.env.DIR;
const L = require(path.join(STUDIO, 'lib')), M = require(path.join(STUDIO, 'metrics')), { T } = require(path.join(STUDIO, 'spec'));
const only = (process.env.ONLY || '').split(',').filter(Boolean);
(async () => {
  const browser = await L.chromium.launch({ args: ['--force-color-profile=srgb','--disable-lcd-text','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });
  const marks = [];
  const add = async (id, app, svg, existing) => {
    L.lint(svg, id);
    const raw = await L.measure(page, svg);
    const cov512 = L.b64ToF32(raw.cov512), cov32 = L.b64ToF32(raw.cov32), cov16 = L.b64ToF32(raw.cov16);
    const fsz = M.featureSize(cov512), wc = M.weightAndCentre(cov512);
    const sz = M.safeZone(cov512, wc.bbox), dc = M.decay(cov16, fsz.ink, fsz.n);
    const metrics = { minFeature: fsz.minFeature, counterFloor: fsz.counterFloor, inkShare: wc.inkShare, centring: wc.centring, ...sz, ...dc };
    marks.push({ id, app, existing: !!existing, cov16, metrics, selfVerdict: M.worst(metrics), fingerprint: L.sha(raw.cov512) });
  };
  for (const n of ['counttooling', 'takeofftooling', 'clicktooling'])
    await add('vendor/' + n, 'vendor', fs.readFileSync(path.join(DIR, 'shipping', n + '.svg'), 'utf8'), true);
  const files = fs.readdirSync(path.join(DIR, 'svg')).filter(f => f.endsWith('.svg')).filter(f => !only.length || only.some(o => f.startsWith(o + '-')));
  for (const f of files) {
    const m = /^([a-z]+)-(\d+)-(.+)\.svg$/.exec(f); if (!m) continue;
    try { await add(`${m[1]}/${m[2]}`, m[1], fs.readFileSync(path.join(DIR, 'svg', f), 'utf8')); }
    catch (e) { marks.push({ id: `${m[1]}/${m[2]}`, app: m[1], lintError: e.message }); }
  }
  await browser.close();
  const pairs = [];
  const ok = marks.filter(m => !m.lintError);
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const a = ok[i], b = ok[j];
    const iou = L.bestIoU(a.cov16, b.cov16, 16), cor = L.bestCorr(a.cov16, b.cov16, 16);
    const sameApp = a.app === b.app;
    const lvl = iou >= T.silIoU.fail && cor >= T.corr.fail ? 'fail' : iou >= T.silIoU.warn && cor >= T.corr.warn ? 'warn' : 'pass';
    pairs.push({ a: a.id, b: b.id, iou: +iou.toFixed(3), corr: +cor.toFixed(3), sameApp, verdict: lvl !== 'pass' && sameApp ? 'sibling' : lvl, lvl });
  }
  const near = (m, pool) => pool.filter(p => p.a === m.id || p.b === m.id).reduce((w, p) => (!w || p.corr > w.corr ? p : w), null);
  for (const m of ok) {
    const vs = pairs.filter(p => (p.a.startsWith('vendor/') || p.b.startsWith('vendor/')) && !m.existing);
    const wv = near(m, vs);
    const clash = wv && wv.iou >= T.silIoU.fail && wv.corr >= T.corr.fail;
    const soft = wv && wv.iou >= T.silIoU.warn && wv.corr >= T.corr.warn;
    m.metrics.vsShipping = { value: wv ? wv.corr : 0, unit: 'corr', verdict: clash ? 'fail' : soft ? 'warn' : 'pass',
      note: wv ? `closest shipping mark: ${(wv.a === m.id ? wv.b : wv.a).replace('vendor/','')} (IoU ${wv.iou})` : 'n/a' };
    m.verdict = m.existing ? m.selfVerdict : M.worst(m.metrics);
  }
  const json = { builtAt: new Date().toISOString(), thresholds: T,
    marks: marks.map(m => m.lintError ? { id: m.id, app: m.app, verdict: 'lint', lintError: m.lintError } : ({ id: m.id, app: m.app, existing: m.existing, verdict: m.verdict, fingerprint: m.fingerprint,
      metrics: Object.fromEntries(Object.entries(m.metrics).map(([k, v]) => [k, { value: v.value, unit: v.unit, verdict: v.verdict, note: v.note }])) })),
    pairs: pairs.filter(p => p.lvl !== 'pass').sort((x, y) => y.corr - x.corr) };
  fs.writeFileSync(process.env.OUT, JSON.stringify(json, null, 2));
  for (const m of json.marks) {
    if (m.lintError) { console.log(`LINT  ${m.id.padEnd(14)} ${m.lintError}`); continue; }
    const flags = Object.entries(m.metrics).filter(([, v]) => v.verdict !== 'pass').map(([k, v]) => `${k}=${v.value}${v.verdict === 'fail' ? '!' : '?'}${v.note ? ' (' + v.note + ')' : ''}`);
    console.log(`${m.verdict.toUpperCase().padEnd(5)} ${m.id.padEnd(14)} ${flags.join(' · ') || 'clean'}`);
  }
  console.log(`\npairs flagged: ${json.pairs.length}`);
  for (const p of json.pairs) console.log(`  ${p.verdict.padEnd(7)} IoU ${p.iou} corr ${p.corr}  ${p.a} <-> ${p.b}`);
})().catch(e => { console.error(e); process.exit(1); });
