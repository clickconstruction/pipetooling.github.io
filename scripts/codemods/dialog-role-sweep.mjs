#!/usr/bin/env node
/**
 * Dialog-role sweep (v2.2188; per backdrop and CI-checked since v2.4401).
 *
 * Adds `role="dialog" aria-modal="true"` to modal panels that never got one. The
 * app-wide scroll lock holds the page still behind a panel that declares itself
 * modal, at any size (`lib/blockingOverlay.ts`), and assistive tech announces it
 * as a dialog. Mechanical and re-runnable (rebase rule: re-run this, never
 * hand-resolve its diff).
 *
 * A backdrop is an element whose inline style literal has `position: 'fixed'`,
 * `inset: 0` and an `rgba(…)` background (a dim layer; an invisible click-catcher
 * has none). Parsed with the TypeScript compiler, one backdrop at a time: the
 * first version skipped a whole file once any `role="dialog"` was in it, so a
 * file with one marked window hid every unmarked one beside it.
 *
 * A backdrop is declared when it, or anything drawn inside it in the same file,
 * carries `aria-modal`, `role="dialog"` / `"alertdialog"`, or the opt-out
 * `data-page-scroll`. Otherwise its panel is the first element inside it that is
 * not a `<style>`:
 *  - a plain element (div/form/section/article) → tagged
 *  - a component (`<SomePanel />`) → left alone and not reported: the panel is
 *    drawn in another file, where this script reads it if it has a backdrop
 *  - nothing, or a fragment → the backdrop itself is tagged
 * Files in SKIP (click-catchers, timelines, swipe surfaces) are left alone.
 *
 * CI runs it with --check (ci.yml and deploy.yml): a window merged after the
 * sweep with no declared panel fails the build with the command that fixes it.
 *
 * Usage: node scripts/codemods/dialog-role-sweep.mjs [--dry | --check]
 *   --dry    lists what it would tag, writes nothing
 *   --check  the same, and exits 1 when anything is left to tag (`npm run check:dialog-role`)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

const CHECK = process.argv.includes('--check')
const DRY = CHECK || process.argv.includes('--dry')
const SKIP = new Set([
  'src/components/JobReportsModal.tsx',
  'src/components/schedule/DispatchAddBlockTimeRange.tsx',
  'src/components/schedule/ScheduleDispatchHub.tsx',
  'src/components/schedule/ScheduleDispatchGrid.tsx',
  'src/components/shared/SwipeToConfirm.tsx',
  'src/components/jobs/JobsStagesThreadPanel.tsx',
  'src/components/jobs/ScheduleDayTimeline.tsx',
  'src/components/checklist/ChecklistTechTreeTab.tsx',
  'src/components/Toast.tsx',
])
const PLAIN = /^(div|form|section|article)$/
const TAG = ' role="dialog" aria-modal="true"'

const attrsOf = (opening) => opening.attributes.properties.filter((p) => ts.isJsxAttribute(p))
const attrName = (a) => a.name.getText()
const attr = (opening, name) => attrsOf(opening).find((a) => attrName(a) === name)
const attrText = (a) => (a?.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : null)

/** The inline `style={{ … }}` literal's own properties, as source text by name. */
function styleProps(opening) {
  const style = attr(opening, 'style')
  const expr = style?.initializer && ts.isJsxExpression(style.initializer) ? style.initializer.expression : null
  if (!expr || !ts.isObjectLiteralExpression(expr)) return null
  const out = {}
  for (const p of expr.properties) {
    if (ts.isPropertyAssignment(p)) out[p.name.getText()] = p.initializer.getText()
  }
  return out
}

function isBackdrop(opening) {
  const s = styleProps(opening)
  if (!s) return false
  if (!/^['"`]fixed['"`]$/.test(s.position ?? '')) return false
  if (!/^(0|['"`]0(px)?['"`])$/.test(s.inset ?? '')) return false
  return /rgba\(/.test(s.background ?? s.backgroundColor ?? '')
}

function declares(opening) {
  if (attr(opening, 'aria-modal') || attr(opening, 'data-page-scroll')) return true
  const role = attr(opening, 'role')
  if (!role) return false
  const text = attrText(role)
  // A role given by an expression may be a dialog; a literal one must say so.
  return text == null || text === 'dialog' || text === 'alertdialog'
}

/** True when the backdrop or anything drawn inside it (in this file) declares a modal. */
function subtreeDeclares(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && declares(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** The first element drawn inside the backdrop, in source order, that is not a <style>. */
function firstPanel(element) {
  let hit = null
  const visit = (n) => {
    if (hit) return
    if (n !== element && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n))) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n
      if (opening.tagName.getText() !== 'style') {
        hit = opening
        return
      }
      return
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(element, visit)
  return hit
}

const files = globSync('src/**/*.tsx', { ignore: ['**/*.test.tsx'] }).sort()
let panels = 0
let backdrops = 0
const report = []

for (const f of files) {
  if (SKIP.has(f)) continue
  const text = readFileSync(f, 'utf8')
  if (!text.includes('fixed') || !text.includes('inset')) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []
  const visit = (n) => {
    if (ts.isJsxElement(n) && isBackdrop(n.openingElement) && !subtreeDeclares(n)) {
      const panel = firstPanel(n)
      const name = panel?.tagName.getText() ?? null
      if (name && PLAIN.test(name)) edits.push({ at: panel.tagName.getEnd(), kind: 'panel', line: sf.getLineAndCharacterOfPosition(panel.getStart()).line + 1 })
      else if (!name) edits.push({ at: n.openingElement.tagName.getEnd(), kind: 'backdrop', line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
      // else: a component draws the panel — its own file is read on its own.
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  let s = text
  for (const e of edits.sort((a, b) => b.at - a.at)) {
    s = s.slice(0, e.at) + TAG + s.slice(e.at)
    if (e.kind === 'panel') panels += 1
    else backdrops += 1
  }
  report.push(`${f}  (line ${edits.map((e) => e.line).sort((a, b) => a - b).join(', ')})`)
  if (!DRY) writeFileSync(f, s)
}

console.log(`${DRY ? '[dry] ' : ''}files: ${report.length} · panels tagged: ${panels} · backdrops tagged (no panel element): ${backdrops}`)
if (report.length) console.log(report.join('\n'))
if (CHECK && report.length) {
  console.error('\nThese windows have a dim full-screen backdrop and no panel that says it is a modal.')
  console.error('Run `node scripts/codemods/dialog-role-sweep.mjs` and commit the result (or add role="dialog" aria-modal="true" to the panel by hand).')
  process.exit(1)
}
