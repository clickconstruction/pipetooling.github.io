#!/usr/bin/env node
/**
 * Press-green sweep (punch list #414, v2.8364).
 *
 * The app's most used green filled itself with `#16a34a` under white words: 3.30:1, under the 4.5:1 small
 * words need. The audit of punch list #382 measured it on the crew's **Is it as told?** send at 390 px, and the
 * fill is drawn by over a hundred presses. The deeper `#15803d` reads 5.02:1 under white; it is the green the
 * app already names `--text-green-700` in light and the hover shade the Bill it press already turns. White words
 * stay, as they did when the orange (v2.6186) and the press blue (v2.6218) were deepened. Mechanical and
 * re-runnable (rebase rule: re-run this, never hand-resolve its diff). Parsed with the TypeScript compiler, one
 * file at a time.
 *
 * The rewrite, in any object literal with a fill (`background`, `backgroundColor`, or a tone map's `bg` or
 * `fill`) and white words (`color`, or a tone map's `fg`, `ink`, `foreground` or `textColor`, its own or from a
 * style it spreads from the same file): each `#16a34a` in the fill becomes `#15803d`, and so does each `#16a34a`
 * in the same object's borders, so the press keeps one edge. A named palette the app draws only under white words
 * (`UNDER_WHITE_PALETTES`: the Job Mode day press's `DAY_PRESS_COLORS`, whose `DAY_PRESS_TEXT` is white for
 * green) takes the same rewrite on its green. In the stylesheets, a rule that fills with `#16a34a` under white
 * words takes the same rewrite.
 *
 * Left alone: lines, borders, rings, dots, bars and icons on their own (no words), green words, a green edge on a
 * card, and a switch's pill with no words on it. Listed, never rewritten: a green fill whose words could come from
 * a spread it cannot read, and a stylesheet rule that fills with `#15803d` or deeper on a state (`:hover`,
 * `:active`) of a rule it moves, where the state must step deeper by hand. Each is read by hand.
 *
 * Usage: node scripts/codemods/press-green-sweep.mjs [--dry | --check] [paths…]
 *   --dry    lists what it would rewrite, writes nothing
 *   --check  the same, and exits 1 when anything is left to rewrite
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

const CHECK = process.argv.includes('--check')
const DRY = CHECK || process.argv.includes('--dry')
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const PALE = /#16a34a\b/gi
const DEEP = '#15803d'
const WHITE = /^(#fff|#ffffff|white)$/i
const FILL_PROPS = new Set(['background', 'backgroundColor', 'bg', 'fill'])
const WORDS_PROPS = new Set(['color', 'fg', 'ink', 'foreground', 'textColor'])
/** Named palettes every screen draws under white words, by the const's name and the key that holds the green. */
const UNDER_WHITE_PALETTES = { DAY_PRESS_COLORS: new Set(['green']) }

const strip = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n))) n = n.expression
  return n
}
const propName = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null)
/** Every string written inside a node, a ternary's or a template's included. */
const literalsIn = (n) => {
  const out = []
  // forEachChild stops at a truthy return, so the walk returns nothing.
  const walk = (c) => {
    if (ts.isStringLiteral(c) || ts.isNoSubstitutionTemplateLiteral(c)) out.push(c)
    else ts.forEachChild(c, walk)
  }
  walk(n)
  return out
}
const pale = (node) => new RegExp(PALE.source, 'i').test(node.getText())

const files = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.ts') || a.endsWith('.tsx') ? a : `${a.replace(/\/$/, '')}/**/*.{ts,tsx}`)) : globSync('src/**/*.{ts,tsx}')).sort()
const rewrites = { style: 0, rule: 0 }
const report = []
const leftAlone = []

for (const f of files) {
  if (/\.test\.tsx?$/.test(f) || f.startsWith('src/test/') || f.startsWith('src/content/releaseNotes/')) continue
  const text = readFileSync(f, 'utf8')
  if (!/#16a34a/i.test(text)) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1

  // Every const object in the file by name, for the words a style takes from a spread.
  const consts = new Map()
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isVariableDeclarationList(n.parent) && n.parent.flags & ts.NodeFlags.Const) {
      consts.set(n.name.text, consts.has(n.name.text) ? null : n.initializer)
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)

  /** The words an object ends with: its own, or a same-file style's it spreads; null when it has none, 'unknown' when it cannot tell. */
  const wordsOf = (obj, seen = new Set()) => {
    let words = null
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && WORDS_PROPS.has(propName(p))) words = p.initializer
      else if (ts.isShorthandPropertyAssignment(p) && WORDS_PROPS.has(p.name.text)) words = 'unknown'
      else if (ts.isSpreadAssignment(p)) {
        const s = strip(p.expression)
        const base = s && ts.isIdentifier(s) ? strip(consts.get(s.text)) : s && ts.isObjectLiteralExpression(s) ? s : null
        if (base && ts.isObjectLiteralExpression(base) && !seen.has(base)) {
          const w = wordsOf(base, new Set([...seen, base]))
          if (w !== null) words = w
        } else if (s && (ts.isConditionalExpression(s) || ts.isBinaryExpression(s))) {
          // `...(on ? { … } : {})` or `...(on && { … })`: the words a branch sets.
          for (const b of ts.isConditionalExpression(s) ? [s.whenTrue, s.whenFalse] : [s.left, s.right]) {
            const o = strip(b)
            if (o && ts.isObjectLiteralExpression(o) && !seen.has(o)) {
              const w = wordsOf(o, new Set([...seen, o]))
              if (w !== null) words = w
            }
          }
        } else if (s) words = words ?? 'unknown'
      }
    }
    return words
  }

  const edits = []
  const edit = (node, o) => {
    if (edits.some((e) => e.start === node.getStart())) return
    edits.push({ start: node.getStart(), end: node.getEnd(), text: node.getText().replace(PALE, DEEP), line: line(o) })
  }
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const fill = n.properties.filter((p) => ts.isPropertyAssignment(p) && FILL_PROPS.has(propName(p))).pop()
      const greens = fill ? literalsIn(fill.initializer).filter(pale) : []
      if (greens.length) {
        const words = wordsOf(n)
        if (words === 'unknown') leftAlone.push(`${f}:${line(n)}: a green fill whose words could come from a spread it cannot read`)
        else if (words && literalsIn(words).some((l) => WHITE.test(l.text))) {
          for (const g of greens) edit(g, n)
          for (const p of n.properties) {
            if (ts.isPropertyAssignment(p) && /^border/.test(propName(p) ?? '')) for (const g of literalsIn(p.initializer).filter(pale)) edit(g, n)
          }
        }
      }
      // A named palette drawn under white words: its green key.
      const owner = n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? n.parent.name.text : null
      const keys = owner ? UNDER_WHITE_PALETTES[owner] : null
      if (keys) {
        for (const p of n.properties) {
          if (ts.isPropertyAssignment(p) && keys.has(propName(p))) for (const g of literalsIn(p.initializer).filter(pale)) edit(g, n)
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  write(f, text, edits)
}

// The stylesheets: a rule that fills with the pale green under white words in the same block.
const sheets = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.css') ? a : `${a.replace(/\/$/, '')}/**/*.css`)) : globSync('src/**/*.css')).sort()
for (const f of sheets) {
  const text = readFileSync(f, 'utf8')
  if (!/#16a34a/i.test(text)) continue
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const edits = []
  const moved = []
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const at = m.index + m[0].indexOf('{') + 1
    const line = clean.slice(0, at).split('\n').length
    const decls = []
    let off = 0
    for (const part of m[2].split(';')) {
      const d = /^(\s*)([a-z-]+)(\s*:\s*)([\s\S]*?)\s*$/i.exec(part)
      if (d) decls.push({ prop: d[2].toLowerCase(), value: d[4], start: at + off + d[1].length + d[2].length + d[3].length })
      off += part.length + 1
    }
    const fill = decls.filter((d) => d.prop === 'background' || d.prop === 'background-color').pop()
    const words = decls.filter((d) => d.prop === 'color').pop()
    if (!fill || !/^#16a34a$/i.test(fill.value) || !words || !WHITE.test(words.value)) continue
    moved.push(m[1].trim())
    for (const d of decls) if (/^(background|background-color|border|border-color)$/.test(d.prop) && /#16a34a/i.test(d.value)) edits.push({ start: d.start, end: d.start + d.value.length, text: d.value.replace(PALE, DEEP), line })
  }
  // A state of a moved rule that filled with the deeper green now matches its rest: it steps deeper by hand.
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim()
    if (!moved.some((s) => sel !== s && sel.startsWith(s) && /:(hover|active|focus)/.test(sel.slice(s.length)))) continue
    if (/background(-color)?\s*:\s*#(15803d|166534)/i.test(m[2])) leftAlone.push(`${f}:${clean.slice(0, m.index + m[0].indexOf('{')).split('\n').length}: ${sel} fills with the deeper green or deeper; step it deeper by hand`)
  }
  write(f, text, edits)
}

function write(f, text, edits) {
  if (!edits.length) return
  let s = text
  for (const e of [...edits].sort((a, b) => b.start - a.start)) s = s.slice(0, e.start) + e.text + s.slice(e.end)
  const n = new Set(edits.map((e) => e.line)).size
  const kind = f.endsWith('.css') ? 'rule' : 'style'
  rewrites[kind] += n
  report.push(`${f}  (${n} ${kind}${n === 1 ? '' : 's'}; lines ${[...new Set(edits.map((e) => e.line))].sort((a, b) => a - b).join(', ')})`)
  if (!DRY) writeFileSync(f, s)
}

if (report.length) console.log(report.join('\n'))
if (leftAlone.length) console.log(`\nLeft alone, read by hand:\n${leftAlone.join('\n')}`)
const counted = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
console.log(`\n${DRY ? 'would rewrite' : 'rewrote'} ${counted(rewrites.style, 'style')} and ${counted(rewrites.rule, 'rule')}.`)
if (CHECK && rewrites.style + rewrites.rule > 0) {
  console.error('press-green check FAILED: a green press fills with #16a34a under white words; run node scripts/codemods/press-green-sweep.mjs')
  process.exit(1)
}
