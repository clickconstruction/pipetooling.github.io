#!/usr/bin/env node
/**
 * Batch-label sweep (punch list #184, sweep A; CI-checked as `check:batch-words`).
 *
 * A button that acts on many rows says how many it will act on: *Approve 4 punches · 1 typed
 * waits ▸*, *Mark 5 opened*, never *Approve all* or *Send selected* (`CLAUDE.md` → *Do what is
 * ready, never all or nothing*). The words come from `batchWords` / `countedLabel` in
 * `src/lib/batchWords.ts`, so the label is an expression over the array in scope. There is no
 * safe auto-fix for words, so this script only lists; a person wires the count.
 *
 * Parsed with the TypeScript compiler. A label is STATIC when it is spelled only by string
 * literals: the JSX text inside a `<button>`, a `{'…'}` or `{busy ? '…' : '…'}` child made of
 * string literals alone, or a `label=` / `children=` prop that is a string literal. One live
 * expression anywhere in the button's children (`{n}`, `{count.toLocaleString()}`) makes the
 * label dynamic and it is left alone: a count in braces is the fix this script asks for.
 *
 * A static label is refused when it has the SHAPE of a batch press: its second word is *all*,
 * *selected*, *shown* or *remaining* (*Approve all*, *Send selected*, *Delete all shown*,
 * *Generate remaining*), or that word follows one preposition (*Send to all*), or it ends on
 * *selected* (*Rerun Google for selected*) — whole words, any case — and it carries no digit.
 * A label whose first word is the key word is a filter chip or a back door (*All*, *‹ All
 * people*), not a press, and is left alone; so is one where the word sits deeper in a sentence
 * (*Needed after all*, *Week overview (all jobs)*).
 *
 * Two kinds of verb are honest with *all* and are allowed by the verb, not by the phrase: a
 * VIEW verb changes what is on screen, not rows (*Show all bills*, *Fold all*, *Select all*,
 * *Fit all*), and a ONE_ACT verb makes one thing of the set, so there is nothing to hold
 * (*Print all*, *Export all backup*, *Share all*: one file, one email). A label that names a
 * filter (*clear all ledger filters*) is a view too. ALLOW holds the few bare phrases that are
 * a reset of a form or of filters, where the data buttons say what they clear.
 *
 * SKIP names a file whose static label waits on a hand PR for a count the component does not
 * have; each entry says which and why, and the PR that adds the count removes it.
 *
 * Usage: node scripts/codemods/batch-label-sweep.mjs [--check]
 *   (no flag)  lists every static batch label with its file and line
 *   --check    the same, and exits 1 when any is left (`npm run check:batch-words`)
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

const CHECK = process.argv.includes('--check')
const KEY = new Set(['all', 'selected', 'shown', 'remaining'])
const PREP = new Set(['to', 'for', 'the', 'on', 'of'])
/** Verbs that change what the screen shows, or a switch, not rows: *all* on them is honest. */
const VIEW_VERBS = new Set(['show', 'showing', 'hide', 'see', 'view', 'open', 'close', 'expand', 'collapse', 'fold', 'unfold', 'fit', 'select', 'deselect', 'check', 'uncheck', 'read', 'pause', 'resume'])
/** Verbs that make one thing of the whole set (one file, one page, one email), so nothing can be held. */
const ONE_ACT_VERBS = new Set(['print', 'export', 'share', 'refresh', 'copy', 'download'])
/** Bare phrases that reset a form or filters; the data buttons name what they clear (*Clear 6 page pins*). */
const ALLOW = new Set(['clear selection', 'clear all', 'clear all checks'])
/** file → the static label(s) that wait on a hand PR, and why. */
const SKIP = new Map([
  // Empty since punch list #184's hand PR gave the four Unpin All their count (`pinnedUserCounts`).
])

/** The label as a person reads it: the desk's marks and icons stripped from both ends, lowercased, one space between words. */
function norm(label) {
  return label
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function offends(label, file) {
  if (/\d/.test(label)) return false
  const text = norm(label)
  if (!text || text.includes('filter')) return false
  const words = text.split(' ')
  const [verb = '', second = '', third = ''] = words
  const last = words[words.length - 1]
  const shaped = KEY.has(second) || (PREP.has(second) && KEY.has(third)) || last === 'selected'
  if (!shaped) return false
  if (VIEW_VERBS.has(verb) || ONE_ACT_VERBS.has(verb) || ALLOW.has(text)) return false
  const skip = SKIP.get(file)
  return !(skip && skip.test(text))
}

/**
 * The string leaves of an expression spelled only by string literals: a literal, a template with
 * no `${}`, a `?:` over such, parentheses. Null when anything live is in it.
 */
function staticLeaves(expr) {
  if (!expr) return null
  if (ts.isParenthesizedExpression(expr)) return staticLeaves(expr.expression)
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text]
  if (ts.isConditionalExpression(expr)) {
    const a = staticLeaves(expr.whenTrue)
    const b = staticLeaves(expr.whenFalse)
    return a && b ? [...a, ...b] : null
  }
  return null
}

/**
 * The static labels a `<button>`'s children spell, or null when any child is live. The JSX text
 * pieces (through nested elements) join into one label; each string-literal expression is a
 * label of its own, since `{busy ? 'Saving…' : 'Approve all'}` draws one at a time.
 */
function buttonLabels(element) {
  const texts = []
  const leaves = []
  let dynamic = false
  const visit = (n) => {
    if (dynamic) return
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, ' ').trim()
      if (t) texts.push(t)
      return
    }
    if (ts.isJsxExpression(n)) {
      if (!n.expression) return
      const l = staticLeaves(n.expression)
      if (!l) {
        dynamic = true
        return
      }
      leaves.push(...l)
      return
    }
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      for (const c of n.children) visit(c)
      return
    }
    // A self-closing element (an icon) spells nothing.
  }
  for (const c of element.children) visit(c)
  if (dynamic) return null
  const out = []
  if (texts.length) out.push(texts.join(' '))
  for (const l of leaves) if (l.trim()) out.push(l.trim())
  return out
}

/** The static labels a `label=` / `children=` prop spells on any element. */
function propLabels(opening) {
  const out = []
  for (const a of opening.attributes.properties) {
    if (!ts.isJsxAttribute(a)) continue
    const name = a.name.getText()
    if (name !== 'label' && name !== 'children') continue
    const init = a.initializer
    if (!init) continue
    if (ts.isStringLiteral(init)) out.push(init.text)
    else if (ts.isJsxExpression(init)) for (const l of staticLeaves(init.expression) ?? []) out.push(l)
  }
  return out
}

const WORDS = /\b(all|selected|shown|remaining)\b/i
const files = globSync('src/**/*.tsx', { ignore: ['**/*.test.tsx'] }).sort()
const report = []

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  if (!WORDS.test(text)) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const visit = (n) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'button') {
      for (const label of buttonLabels(n) ?? []) if (offends(label, f)) report.push(`${f}:${line(n)}: ${label}`)
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      for (const label of propLabels(n)) if (offends(label, f)) report.push(`${f}:${line(n)}: ${label}`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

console.log(`static batch labels: ${report.length}`)
if (report.length) console.log(report.join('\n'))
if (CHECK && report.length) {
  console.error('\nThese buttons act on many rows and say "all", "selected", "shown" or "remaining" with no number.')
  console.error('A batch button says its count: `batchWords` in src/lib/batchWords.ts (or `countedLabel` when nothing can be held).')
  console.error('A view toggle (Show all…, Fold all) is allowed by its verb in VIEW_VERBS in scripts/codemods/batch-label-sweep.mjs.')
  process.exit(1)
}
