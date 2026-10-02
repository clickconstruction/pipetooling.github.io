#!/usr/bin/env node
/**
 * Backdrop click sweep (v2.4347 — Grace, 2026-10-01): a window closes on a click outside it only
 * when the press AND the release are both outside it.
 *
 * About ninety backdrops closed on the press — `onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}`.
 * A drag that started inside never closed them, but a press outside closed them before the
 * release, so a press outside that turned into a drag back in (a text selection started in the
 * margin) closed the window. This renames each one's `onMouseDown` to `onClick`, keeping the
 * handler as it is. The drag case is then held by the page-wide guard
 * (`src/lib/modalBackdropGuard.ts`, v2.4338): a click on a full-screen backdrop whose press or
 * release was elsewhere never reaches React. Mechanical and re-runnable (rebase rule: re-run
 * this, never hand-resolve its diff).
 *
 * A site is a JSX element whose `onMouseDown` handler — inline, or a function of that name in
 * the same file — closes only when the press lands on the element itself (`e.target ===
 * e.currentTarget`, or `!==` then return) and calls something that closes. Left alone:
 *  - an element that already has an `onClick` (reported, never merged by hand here)
 *  - a handler that only records the press (`….current = e.target === e.currentTarget`) —
 *    ResponsiveModalShell already closes on the click
 *  - files listed in SKIP (a right-click menu closes on the press, like every menu)
 *  - an element with a `backdrop-click: allow — <why>` comment up to two lines above it or inside
 *    its opening tag, for a window that is meant to close on the press
 *
 * CI runs it with --check (ci.yml and deploy.yml, v2.4378): a window merged after the sweep that
 * closes on the press fails its pull request — v2.4370 fixed one that slipped in that way.
 *
 * Usage: node scripts/codemods/backdrop-click-sweep.mjs [--dry | --check]
 *   --dry    lists what it would rename, writes nothing
 *   --check  the same, and exits 1 when anything is left to rename (`npm run check:backdrop-click`)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import ts from 'typescript'

const CHECK = process.argv.includes('--check')
const DRY = CHECK || process.argv.includes('--dry')
const SKIP = new Set([
  'src/components/checklist/ChecklistTechTreeCanvasMenu.tsx',
])
const TARGET_CHECK = /\be\.target\s*(===|!==)\s*e\.currentTarget\b/
const CLOSES = /[Cc]lose|[Cc]ancel|[Dd]ismiss|\((false|null)\)|onKeepEditing|settleCancel/
const RECORDS_ONLY = /\.current\s*=\s*e\.target\s*===\s*e\.currentTarget/

const files = execSync("git ls-files 'src/**/*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.endsWith('.test.tsx') && !SKIP.has(f))
  .sort()

/** The body of a function declared in this file under `name` (const arrow or function declaration). */
function functionBody(sf, name) {
  let found = null
  const visit = (n) => {
    if (found) return
    if (ts.isFunctionDeclaration(n) && n.name?.text === name && n.body) found = n.body.getText()
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) found = n.initializer.getText()
    else ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

/** A `backdrop-click: allow — <why>` comment up to two lines above the element or inside its opening tag. */
function allowed(sf, n) {
  const line = sf.getLineAndCharacterOfPosition(n.getStart()).line
  return /backdrop-click:[ \t]*allow\b[ \t—–:-]*\w/.test(sf.text.slice(sf.getPositionOfLineAndCharacter(Math.max(0, line - 2), 0), n.getEnd()))
}

let touched = 0
let renamed = 0
const skipped = []
const report = []
const allowedSites = []

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  if (!text.includes('onMouseDown')) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = [] // [start, end] of each `onMouseDown` attribute name to rename
  const visit = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const attrs = n.attributes.properties.filter(ts.isJsxAttribute)
      const md = attrs.find((a) => a.name.getText() === 'onMouseDown')
      if (md?.initializer && ts.isJsxExpression(md.initializer) && md.initializer.expression) {
        const expr = md.initializer.expression
        const handler = ts.isIdentifier(expr) ? functionBody(sf, expr.text) ?? '' : expr.getText()
        if (TARGET_CHECK.test(handler) && CLOSES.test(handler) && !RECORDS_ONLY.test(handler)) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
          if (allowed(sf, n)) {
            allowedSites.push(`${f}:${line}`)
          } else if (attrs.some((a) => a.name.getText() === 'onClick')) {
            skipped.push(`${f}:${line} already has an onClick`)
          } else {
            edits.push([md.name.getStart(), md.name.getEnd()])
            report.push(`${f}:${line}`)
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (edits.length === 0) continue
  let out = text
  for (const [start, end] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + 'onClick' + out.slice(end)
  touched += 1
  renamed += edits.length
  if (!DRY) writeFileSync(f, out)
}

for (const r of report) console.log(`  onMouseDown → onClick  ${r}`)
for (const s of skipped) console.log(`  SKIPPED  ${s}`)
console.log(`${DRY ? '[dry] ' : ''}${renamed} backdrops in ${touched} files${skipped.length ? `, ${skipped.length} skipped` : ''}`)
if (allowedSites.length) console.log(`${allowedSites.length} allowed by a backdrop-click: allow note: ${allowedSites.join(', ')}`)

if (CHECK && (report.length || skipped.length)) {
  console.log('\nThese windows close on the press: a press outside closes them before the release. Run')
  console.log('`node scripts/codemods/backdrop-click-sweep.mjs` to move them to the click (docs/AI_CONTEXT.md → Windows (modals)).')
  console.log('A window that is meant to close on the press says so: a `backdrop-click: allow — <why>` comment on the line above it.')
  // In GitHub Actions each finding also lands on the PR's diff as an error annotation.
  if (process.env.GITHUB_ACTIONS === 'true') {
    const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
    for (const at of [...report, ...skipped.map((s) => s.split(' ')[0])]) {
      const [file, line] = at.split(':')
      console.log(`::error file=${file},line=${line},title=Window closes on the press::${esc('A press outside this window closes it before the release. Move its onMouseDown to onClick (node scripts/codemods/backdrop-click-sweep.mjs), or add a backdrop-click: allow — <why> comment above it.')}`)
    }
  }
  process.exit(1)
}
