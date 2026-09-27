#!/usr/bin/env node
/**
 * Render smokes settle before they assert — the sweep (punch list #39, PR 2).
 *
 * `renderWithProviders` resolves its mocks outside `act`, so a synchronous read or click on
 * the line after a render call races the component's mount effects (see the rule in
 * `src/test/renderSmokeMocks.tsx`). This script finds that line pair in every
 * `src/**\/*.render.test.tsx` and, in files whose component does async work at mount (the
 * file stubs `supabase` or resolves promises from a mock), inserts `await settle()` between
 * the two lines, importing `settle` from the harness and making the enclosing test async.
 *
 * Files with no async mount work (static markup) are left alone: nothing races there.
 * A read already wrapped in `await waitFor(...)` / `await screen.find*` is left alone too, and
 * so is a read preceded by a `// first paint` comment — a test that asserts the pre-load state.
 *
 * Usage:
 *   node scripts/render-smokes-settle.mjs            # dry run: counts and the list
 *   node scripts/render-smokes-settle.mjs --write    # apply
 *
 * On a rebase conflict, take main's version of the test file and re-run `--write`: the
 * script is the source of truth (CLAUDE.md → Mechanical sweeps merge alone).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.render.test.tsx')) out.push(p)
  }
  return out
}

const WRITE = process.argv.includes('--write')
const ROOT = process.cwd()
const files = walk(path.join(ROOT, 'src')).map((p) => path.relative(ROOT, p)).sort()

// A render call as a statement (not a declaration, not inside an expect()).
const RENDER_CALL = /^\s*(?:const\s+(?:\{[^}]*\}|\w+)\s*=\s*)?(?:render|renderWithProviders|render[A-Z]\w*|open[A-Z]\w*|open)\s*\(/
// The synchronous reads and clicks that race a first paint.
const SYNC_READ = /^\s*(?:fireEvent\.|(?:const|let)\s+\w+\s*=\s*(?:screen\.)?(?:getBy|getAllBy|queryBy)\w*\(|expect\((?:screen\.)?(?:getBy|getAllBy|queryBy|within)\w*\(|expect\(\w+\(\)\.(?:value|disabled|checked)\b|(?:screen\.)?(?:getBy|getAllBy)\w*\()/
const ALREADY_WAITS = /^\s*(?:await\s|return\s+await\s)/
const ASYNC_MOUNT = /makeSupabaseStub|lib\/supabase'|mockResolvedValue|Promise\.resolve\(|mockImplementation\(\s*async|vi\.fn\(\s*async/

const summary = { files: files.length, candidates: 0, staticFiles: 0, converted: 0, alreadySettled: 0, optedOut: 0, unconvertible: 0 }
const report = []

for (const rel of files) {
  const abs = path.join(ROOT, rel)
  const src = readFileSync(abs, 'utf8')
  const lines = src.split('\n')
  const asyncMount = ASYNC_MOUNT.test(src)
  const edits = [] // { insertAfter: lineIndex, indent }
  const testStarts = [] // lines holding it(/test( that need `async`
  let fileCandidates = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!RENDER_CALL.test(line)) continue
    if (/^\s*(?:async\s+)?function\b|^\s*export\b|^\s*import\b/.test(line)) continue
    // Walk to the end of a multi-line call.
    let depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
    let j = i
    while (depth > 0 && j + 1 < lines.length) {
      j++
      depth += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length
    }
    let k = j + 1
    while (k < lines.length && (lines[k].trim() === '' || lines[k].trim().startsWith('//'))) k++
    if (k >= lines.length) continue
    const next = lines[k]
    if (/^\s*await\s+settle\(\)/.test(next)) { summary.alreadySettled++; continue }
    // A test that reads the FIRST paint on purpose (a spinner, a pre-load state) opts out with
    // `// first paint` on the line before the read; the sweep leaves it and re-runs stay quiet.
    if (k > 0 && /\/\/\s*first paint/.test(lines[k - 1])) { summary.optedOut++; continue }
    if (ALREADY_WAITS.test(next)) continue
    if (!SYNC_READ.test(next)) continue
    summary.candidates++
    fileCandidates++
    if (!asyncMount) continue
    // Find the enclosing it(/test( to make it async.
    let t = i
    while (t >= 0 && !/^\s*(?:it|test)\s*\(/.test(lines[t])) t--
    if (t < 0) { summary.unconvertible++; report.push(`${rel}:${i + 1} no enclosing it()`); continue }
    if (!/async\s*\(/.test(lines[t]) && !/async\s+function/.test(lines[t])) {
      if (!/\(\s*\)\s*=>\s*\{\s*$/.test(lines[t])) { summary.unconvertible++; report.push(`${rel}:${t + 1} it() callback not a plain () => {`); continue }
      testStarts.push(t)
    }
    const indent = next.match(/^\s*/)[0]
    edits.push({ insertAfter: j, indent })
    report.push(`${rel}:${k + 1} ${next.trim().slice(0, 90)}`)
  }

  if (!asyncMount) { if (fileCandidates) summary.staticFiles++; continue }
  if (edits.length === 0) continue
  summary.converted += edits.length
  if (!WRITE) continue

  // Apply from the bottom up so indices stay valid.
  for (const t of [...new Set(testStarts)].sort((a, b) => b - a)) lines[t] = lines[t].replace(/\(\s*\)\s*=>\s*\{\s*$/, 'async () => {')
  for (const e of edits.sort((a, b) => b.insertAfter - a.insertAfter)) lines.splice(e.insertAfter + 1, 0, `${e.indent}await settle()`)
  let out = lines.join('\n')
  // Import `settle` from the harness: extend the existing import or add one.
  const harnessRel = path.relative(path.dirname(abs), path.join(ROOT, 'src/test/renderSmokeMocks')).replace(/\\/g, '/')
  const harnessImport = harnessRel.startsWith('.') ? harnessRel : `./${harnessRel}`
  const importRe = new RegExp(`import \\{([^}]*)\\} from '${harnessImport.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`)
  const m = out.match(importRe)
  if (m) {
    if (!/\bsettle\b/.test(m[1])) {
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      names.push('settle')
      names.sort((a, b) => a.replace(/^type\s+/, '').localeCompare(b.replace(/^type\s+/, '')))
      out = out.replace(importRe, `import { ${names.join(', ')} } from '${harnessImport}'`)
    }
  } else {
    // After the last import line.
    const importLines = out.split('\n')
    let last = -1
    for (let i = 0; i < importLines.length; i++) if (/^import\b/.test(importLines[i])) last = i
    importLines.splice(last + 1, 0, `import { settle } from '${harnessImport}'`)
    out = importLines.join('\n')
  }
  writeFileSync(abs, out)
}

console.log(`render smokes: ${summary.files} files · ${summary.candidates} render→sync-read pairs · ${summary.staticFiles} files left alone (no async mount work) · ${summary.alreadySettled} already settled · ${summary.optedOut} opted out (first paint) · ${summary.unconvertible} not convertible by hand-shape`)
console.log(`${WRITE ? 'inserted' : 'would insert'} await settle() at ${summary.converted} places`)
if (!WRITE) for (const r of report) console.log('  ' + r)
