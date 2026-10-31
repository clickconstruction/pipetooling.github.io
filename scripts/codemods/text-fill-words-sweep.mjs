#!/usr/bin/env node
/**
 * Text-fill words sweep (punch list #194, v2.6190).
 *
 * A chip, press or count that fills itself with a text token (`var(--text-link)`,
 * `var(--text-red-700)`, …) drew white words on it. A text token turns to the light ink it is as
 * words in dark mode, so white words on one read 1.05:1 (`--text-strong`) to 2.77:1
 * (`--text-red-700`) there. Two rules, by the token's colour, read from src/index.css:
 *
 * - A coloured token (a hue: blue, red, green, violet, amber, …) keeps its white words and fills
 *   with its light value as a literal hex, deep in both themes. Light mode is pixel-identical; this
 *   is v2.6151's Messages count, and Taunya's call on 2026-10-30: white words on coloured buttons.
 *   Words already in `var(--surface)` on one (v2.6068's way) go back to white.
 * - A grey token (`--text-strong`, `--text-700`, `--text-muted`, …) keeps its fill, and its words
 *   take `var(--surface)`: white in light, as before, and the dark surface in dark (v2.6068). The
 *   theme check refuses a raw grey, so a grey cannot be a literal fill.
 *
 * A token too pale under white in light (`MOVES`) fills with its deeper token instead, as v2.6068
 * moved the settings chips from `--text-blue-500` to `--text-link`. A token that stays dark in dark
 * (`--text-faint-300`, `--text-on-bright-solid`, …) is left alone.
 *
 * It reads any object literal with a fill (`background`, `backgroundColor`, or a tone map's `bg` or
 * `fill`) and words (`color`, or a tone map's `fg` or `ink`): strings, consts of one in the same
 * file, ternaries, the fill's own condition on the words, and same-file spreads. An object that sets
 * its own fill and inherits its words gets words of its own when they would be wrong on its fill
 * after the sweep. A coloured fill that moves takes its border with it. In the stylesheets, a rule
 * that fills with a token and sets its words in the same block takes the same rewrite; words a rule
 * inherits from another rule (the cascade) are read by hand. Mechanical and re-runnable (rebase
 * rule: re-run this, never hand-resolve its diff). Parsed with the TypeScript compiler.
 *
 * Listed, never rewritten: words that are not a string it can read (a prop, a call), words that
 * could come from a spread it cannot read, a fill and words that turn on different conditions when
 * that decides the words, a coloured token that fills from a const, and white words under 4.5:1 on a
 * token that stays dark in dark (`--text-faint-300`'s dead press takes `src/lib/deadPress.ts`'s
 * pair). Each is read by hand.
 *
 * Usage: node scripts/codemods/text-fill-words-sweep.mjs [--dry | --check | --survey] [paths…]
 *   --dry     lists what it would rewrite, writes nothing
 *   --check   the same, and exits 1 when anything is left to rewrite
 *   --survey  --dry, and also lists the token fills whose words it cannot read and the calls and
 *             maps that pair a token with white under other names
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

const CHECK = process.argv.includes('--check')
const SURVEY = process.argv.includes('--survey')
const DRY = CHECK || SURVEY || process.argv.includes('--dry')
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const TOKEN = /^var\((--text-[a-z0-9-]+)\s*(?:,[^]*)?\)$/
const WHITE = /^(#fff|#ffffff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i
const SURFACE_TEXT = 'var(--surface)'
const SURFACE = `'${SURFACE_TEXT}'`
const WHITE_WORDS = "'#fff'"
/** The fill and the words, as a style names them and as a tone map does (`{ bg, fg }`, `{ fill, ink }`). */
const FILL_PROPS = new Set(['background', 'backgroundColor', 'bg', 'fill'])
const WORDS_PROPS = new Set(['color', 'fg', 'ink'])
/** A token too pale under white in light, and the deeper token of its hue it fills with instead. */
const MOVES = { '--text-blue-500': '--text-link', '--text-faint': '--text-muted', '--text-green-600': '--text-green-700' }

// The tokens as src/index.css draws them: the light block, and the dark block over it.
const css = readFileSync('src/index.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const themeBlock = (selector) => {
  const out = {}
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(m[1].trim().replace(/\s+/g, ' '))) continue
    for (const d of m[2].split(';')) {
      const x = d.match(/^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*$/i)
      if (x) out[x[1]] = x[2].toLowerCase()
    }
  }
  return out
}
const LIGHT = themeBlock(/^:root\s*,\s*\[data-theme=(['"])light\1\]$/)
const DARK = { ...LIGHT, ...themeBlock(/^:root\[data-theme=(['"])dark\1\]$/) }
if (!LIGHT['--surface'] || !DARK['--surface']) throw new Error('src/index.css: no --surface in the light or dark block')
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Surface words read 4.5:1 or better on the token's dark value: it turns light in dark. */
const turnsLight = (name) => !!DARK[name] && ratio(DARK['--surface'], DARK[name]) >= 4.5
/** Colour in the token's light value: its channels 0.2 or more apart. The greys stay under 0.16. */
const isHue = (name) => !!LIGHT[name] && Math.max(...rgb(LIGHT[name])) - Math.min(...rgb(LIGHT[name])) >= 0.2 * 255
/** The literal a coloured token fills with: its light value, or its deeper token's. */
const deepOf = (name) => LIGHT[MOVES[name] ?? name]
/** A token whose fill would still read under 4.5:1 under white in light, with no deeper token named for it. */
const paleUnmoved = (name) => turnsLight(name) && !MOVES[name] && ratio('#ffffff', LIGHT[name]) < 4.5
/** White words on a token that stays dark in dark, when they read under 4.5:1 in either theme: what to say about them. */
const darkTokenNote = (name) => {
  if (!LIGHT[name] || turnsLight(name)) return null
  const [light, dark] = [ratio('#ffffff', LIGHT[name]), ratio('#ffffff', DARK[name])]
  return Math.min(light, dark) < 4.5 ? `white words on ${name}, which stays dark in dark, read ${light.toFixed(2)}:1 in light and ${dark.toFixed(2)}:1 in dark; a dead press takes src/lib/deadPress.ts's pair` : null
}

const strip = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isTypeAssertionExpression(n))) n = n.expression
  return n
}
const strText = (n) => {
  const s = strip(n)
  return s && (ts.isStringLiteral(s) || ts.isNoSubstitutionTemplateLiteral(s)) ? s.text : null
}
const propName = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null)
const flat = (t) => t.replace(/\s+/g, ' ').trim()

const tokenOf = (v) => (v.kind === 'lit' ? (TOKEN.exec(v.text)?.[1] ?? null) : null)
/** A fill as the rules read it: 'hue' (a coloured token that turns light), 'grey' (a grey one), or 'other'. */
const classOf = (v) => {
  const name = tokenOf(v)
  if (!name || !turnsLight(name)) return 'other'
  return isHue(name) ? 'hue' : 'grey'
}
const isWhite = (v) => v.kind === 'lit' && WHITE.test(v.text)
const isSurface = (v) => v.kind === 'lit' && v.text === SURFACE_TEXT
const isOurs = (v) => isWhite(v) || isSurface(v)
const leaves = (v) => (v.kind === 'cond' ? [...leaves(v.t), ...leaves(v.f)] : [v])
/** Every string written inside a node, a template's `${…}` included. */
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
const paren = (t) => (/ \? /.test(t) && !/^'[^']*'$/.test(t) ? `(${t})` : t)
/** A word's text on a fill of this class: white stays on colour, surface on grey. */
const wordOn = (cls, l) => {
  if (l.kind !== 'lit') return l.node.getText()
  if (cls === 'hue' && isSurface(l)) return WHITE_WORDS
  if (cls === 'grey' && isWhite(l)) return SURFACE
  return l.node.getText()
}
/** A string's source with each coloured token in it as its literal, and each pale grey as its deeper token; the quotes kept. */
const recoloured = (source) =>
  source.replace(/var\((--text-[a-z0-9-]+)(\s*,[^)]*)?\)/g, (m, name) => {
    if (!turnsLight(name)) return m
    if (isHue(name)) return deepOf(name)
    return MOVES[name] ? `var(${MOVES[name]})` : m
  })
const UNKNOWN = { v: { kind: 'unknown' } }

const files = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.ts') || a.endsWith('.tsx') ? a : `${a.replace(/\/$/, '')}/**/*.{ts,tsx}`)) : globSync('src/**/*.{ts,tsx}')).sort()
const rewrites = { style: 0, rule: 0 }
const report = []
const leftAlone = []
const unread = []
const pairedElsewhere = []

for (const f of files) {
  if (/\.test\.tsx?$/.test(f) || f.startsWith('src/test/')) continue
  const text = readFileSync(f, 'utf8')
  if (!text.includes('var(--text-')) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1

  // Every const in the file by name; a name declared twice reads as nothing.
  const consts = new Map()
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isVariableDeclarationList(n.parent) && n.parent.flags & ts.NodeFlags.Const) {
      consts.set(n.name.text, consts.has(n.name.text) ? null : n.initializer)
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)

  /** A colour as the sweep reads it: a string, a ternary of colours, or unknown. A const's string keeps the node it is used at. */
  const value = (n, depth = 0) => {
    const s = strip(n)
    if (!s || depth > 6) return { kind: 'unknown', node: n }
    const t = strText(s)
    if (t !== null) return { kind: 'lit', text: t, node: n }
    if (ts.isConditionalExpression(s)) return { kind: 'cond', cond: s.condition, t: value(s.whenTrue, depth + 1), f: value(s.whenFalse, depth + 1), node: n }
    let init = null
    if (ts.isIdentifier(s)) init = consts.get(s.text)
    else if (ts.isPropertyAccessExpression(s) && ts.isIdentifier(s.expression)) {
      const o = strip(consts.get(s.expression.text))
      const p = o && ts.isObjectLiteralExpression(o) ? o.properties.find((q) => ts.isPropertyAssignment(q) && propName(q) === s.name.text) : null
      init = p ? p.initializer : null
    }
    if (init) {
      const v = value(init, depth + 1)
      if (v.kind === 'lit') return { kind: 'lit', text: v.text, node: n, viaConst: true }
    }
    return { kind: 'unknown', node: n }
  }

  /**
   * The fill and the words an object ends with, own or from what it spreads, in order. A spread it
   * cannot read leaves what came before it standing, marked `maybe`: it could set either.
   */
  const effective = (obj, seen) => {
    let fill = null
    let words = null
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p)) {
        const name = propName(p)
        if (FILL_PROPS.has(name)) fill = { v: value(p.initializer), own: true, prop: p }
        else if (WORDS_PROPS.has(name)) words = { v: value(p.initializer), own: true, prop: p }
      } else if (ts.isShorthandPropertyAssignment(p)) {
        if (FILL_PROPS.has(p.name.text)) fill = { v: value(p.name), own: true, prop: p, shorthand: true }
        else if (WORDS_PROPS.has(p.name.text)) words = { v: value(p.name), own: true, prop: p, shorthand: true }
      } else if (ts.isSpreadAssignment(p)) {
        const s = spreadSets(p.expression, seen)
        if (s.fill === UNKNOWN) fill = fill ? { ...fill, maybe: true } : UNKNOWN
        else if (s.fill !== undefined) fill = { ...s.fill, own: false, spread: p }
        if (s.words === UNKNOWN) words = words ? { ...words, maybe: true } : UNKNOWN
        else if (s.words !== undefined) words = { ...s.words, own: false, spread: p }
      }
    }
    return { fill, words }
  }
  const either = (a, b) => ({ fill: a.fill === undefined && b.fill === undefined ? undefined : UNKNOWN, words: a.words === undefined && b.words === undefined ? undefined : UNKNOWN })
  /** What a spread sets: undefined where it sets nothing, UNKNOWN where it cannot tell. */
  const spreadSets = (expr, seen) => {
    const s = strip(expr)
    if (!s) return { fill: UNKNOWN, words: UNKNOWN }
    if (s.kind === ts.SyntaxKind.NullKeyword || s.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(s) && s.text === 'undefined')) return {}
    if (ts.isObjectLiteralExpression(s)) {
      if (seen.has(s)) return { fill: UNKNOWN, words: UNKNOWN }
      const e = effective(s, new Set([...seen, s]))
      return { fill: e.fill ?? undefined, words: e.words ?? undefined }
    }
    if (ts.isIdentifier(s) && consts.get(s.text)) return spreadSets(consts.get(s.text), seen)
    if (ts.isConditionalExpression(s)) return either(spreadSets(s.whenTrue, seen), spreadSets(s.whenFalse, seen))
    if (ts.isBinaryExpression(s) && s.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return either(spreadSets(s.right, seen), {})
    if (ts.isBinaryExpression(s) && (s.operatorToken.kind === ts.SyntaxKind.BarBarToken || s.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return either(spreadSets(s.left, seen), spreadSets(s.right, seen))
    return { fill: UNKNOWN, words: UNKNOWN }
  }

  /** One word drawn over every branch of a ternary fill: the word each branch takes, as one expression. */
  const build = (fv, w) => {
    if (fv.kind !== 'cond') return wordOn(classOf(fv), w)
    const a = build(fv.t, w)
    const b = build(fv.f, w)
    return a === b ? a : `${flat(fv.cond.getText())} ? ${paren(a)} : ${paren(b)}`
  }
  /**
   * Words `w` drawn on fill `fv`: the word edits each rule asks for and the coloured fill leaves
   * under our words (white or surface), or null when it cannot tell which word sits on which fill.
   */
  const plan = (fv, w) => {
    if (w.kind === 'unknown' || fv.kind === 'unknown') return { words: [], fills: [] }
    if (fv.kind === 'lit') {
      const ws = leaves(w)
      const words = ws.filter((l) => l.kind === 'lit' && wordOn(classOf(fv), l) !== l.node.getText()).map((l) => ({ node: l.node, text: wordOn(classOf(fv), l) }))
      return { words, fills: classOf(fv) === 'hue' && ws.some(isOurs) ? [fv] : [] }
    }
    if (w.kind === 'lit') {
      if (!isOurs(w)) return { words: [], fills: [] }
      const t = build(fv, w)
      const words = t === w.node.getText() ? [] : [{ node: w.node, text: ts.isConditionalExpression(w.node.parent) ? paren(t) : t }]
      return { words, fills: leaves(fv).filter((l) => classOf(l) === 'hue') }
    }
    if (w.kind === 'cond' && flat(fv.cond.getText()) === flat(w.cond.getText())) {
      const a = plan(fv.t, w.t)
      const b = plan(fv.f, w.f)
      return a && b ? { words: [...a.words, ...b.words], fills: [...a.fills, ...b.fills] } : null
    }
    // Different conditions: each of our words could sit on any branch of the fill, so every branch must give it the same word.
    const ours = leaves(w).filter(isOurs)
    const words = []
    for (const l of ours) {
      const on = new Set(leaves(fv).map((b) => wordOn(classOf(b), l)))
      if (on.size > 1) return null
      const t = [...on][0]
      if (t !== l.node.getText()) words.push({ node: l.node, text: t })
    }
    return { words, fills: ours.length ? leaves(fv).filter((l) => classOf(l) === 'hue') : [] }
  }
  /** A node's text with edits inside it applied. */
  const applied = (node, edits) => {
    let s = node.getText()
    const base = node.getStart()
    for (const e of [...edits].sort((a, b) => b.node.getStart() - a.node.getStart())) s = s.slice(0, e.node.getStart() - base) + e.text + s.slice(e.node.getEnd() - base)
    return s
  }

  const objects = []
  const gather = (n) => {
    if (ts.isObjectLiteralExpression(n)) objects.push(n)
    ts.forEachChild(n, gather)
  }
  gather(sf)
  const ownEdits = new Map() // the words' PropertyAssignment → its edits
  const edits = [] // { start, end, text, line }
  const edit = (node, t, o) => {
    if (!edits.some((x) => x.start === node.getStart())) edits.push({ start: node.getStart(), end: node.getEnd(), text: t, line: line(o) })
  }
  /** A coloured fill leaf to its literal, and a pale grey to its deeper token, with the object's borders that name it. */
  const recolour = (o, l) => {
    if (l.viaConst) {
      leftAlone.push(`${f}:${line(o)}: ${tokenOf(l)} fills under white words from a const (${l.node.getText()}); give the press its literal fill by hand`)
      return
    }
    const next = recoloured(l.node.getText())
    if (next === l.node.getText()) return
    edit(l.node, next, o)
    for (const p of o.properties) {
      if (!ts.isPropertyAssignment(p) || !/^border/.test(propName(p) ?? '')) continue
      for (const b of literalsIn(p.initializer)) if (b.getText().includes(`var(${tokenOf(l)}`)) edit(b, b.getText().replace(new RegExp(`var\\(${tokenOf(l)}(\\s*,[^)]*)?\\)`, 'g'), recoloured(`var(${tokenOf(l)})`)), o)
    }
  }
  const pale = (o, fv) => {
    for (const l of leaves(fv)) {
      const name = tokenOf(l)
      if (name && paleUnmoved(name)) leftAlone.push(`${f}:${line(o)}: ${name} reads ${ratio('#ffffff', LIGHT[name]).toFixed(2)}:1 under white in light; name its deeper token in MOVES`)
    }
  }

  // Pass 1: every object's own words on its fill, wherever the fill comes from.
  for (const o of objects) {
    const e = effective(o, new Set([o]))
    if (!e.fill || e.fill === UNKNOWN || e.fill.v.kind === 'unknown' || !e.words || !e.words.own) continue
    if (!leaves(e.fill.v).some((l) => tokenOf(l))) continue
    if (e.words.shorthand || e.words.v.kind === 'unknown') {
      if (leaves(e.fill.v).some((l) => classOf(l) !== 'other')) unread.push(`${f}:${line(o)}: a token fill under words it cannot read (${flat(e.words.prop.getText()).slice(0, 80)})`)
      continue
    }
    for (const l of leaves(e.fill.v)) {
      const note = tokenOf(l) && darkTokenNote(tokenOf(l))
      if (note && leaves(e.words.v).some(isWhite)) leftAlone.push(`${f}:${line(o)}: ${note}`)
    }
    const p = plan(e.fill.v, e.words.v)
    if (p === null) {
      leftAlone.push(`${f}:${line(o)}: the fill and its words turn on different conditions`)
      continue
    }
    if (e.words.maybe && p.words.length) {
      unread.push(`${f}:${line(o)}: its words could come from a spread it cannot read`)
      continue
    }
    pale(o, e.fill.v)
    if (p.words.length) ownEdits.set(e.words.prop, p.words)
    for (const x of p.words) edit(x.node, x.text, o)
    if (e.fill.own) for (const l of p.fills) recolour(o, l)
    else if (p.fills.some((l) => recoloured(l.node.getText()) !== l.node.getText())) leftAlone.push(`${f}:${line(o)}: its words sit on a coloured fill it takes from a spread; give it its own literal fill by hand`)
    // A pale grey under our words fills with its deeper grey.
    if (e.fill.own && leaves(e.words.v).some(isOurs)) for (const l of leaves(e.fill.v)) if (classOf(l) === 'grey' && MOVES[tokenOf(l)]) recolour(o, l)
  }

  // Pass 2: an object that sets its own fill and inherits its words from a spread.
  for (const o of objects) {
    const e = effective(o, new Set([o]))
    if (!e.words || !e.fill || e.fill === UNKNOWN || !e.fill.own || e.words === UNKNOWN || e.words.own) continue
    const changed = e.words.prop && ownEdits.has(e.words.prop)
    if (e.words.v.kind === 'unknown' || e.words.shorthand || !e.words.prop) {
      if (e.fill.v.kind !== 'unknown' && leaves(e.fill.v).some((l) => classOf(l) !== 'other')) unread.push(`${f}:${line(o)}: a token fill whose words could come from a spread it cannot read`)
      continue
    }
    if (e.fill.v.kind === 'unknown') {
      if (changed) leftAlone.push(`${f}:${line(o)}: the style it spreads now draws other words; its own fill is not a string the sweep can read`)
      continue
    }
    const p = plan(e.fill.v, e.words.v)
    if (p === null) {
      leftAlone.push(`${f}:${line(o)}: the fill and the words it inherits turn on different conditions`)
      continue
    }
    pale(o, e.fill.v)
    for (const l of p.fills) recolour(o, l)
    const from = e.words.prop.initializer
    const want = applied(from, p.words)
    const will = changed ? applied(from, ownEdits.get(e.words.prop)) : from.getText()
    if (want === will) continue
    // Its own words, under the name the spread gave them, after its last property.
    const key = propName(e.words.prop)
    const last = o.properties[o.properties.length - 1]
    const own = sf.getLineAndCharacterOfPosition(last.getStart())
    const close = sf.getLineAndCharacterOfPosition(o.getEnd())
    let at = last.getEnd()
    let insert
    if (own.line === close.line) insert = `, ${key}: ${want}`
    else {
      const indent = text.slice(sf.getPositionOfLineAndCharacter(own.line, 0), last.getStart()).replace(/\S.*$/, '')
      if (o.properties.hasTrailingComma) {
        at = text.indexOf(',', last.getEnd()) + 1
        insert = `\n${indent}${key}: ${want},`
      } else insert = `,\n${indent}${key}: ${want}`
    }
    edits.push({ start: at, end: at, text: insert, line: line(o) })
  }

  if (SURVEY) {
    // Calls and maps that pair a token with white under other names.
    const pairs = (n) => {
      const vals = ts.isCallExpression(n) ? n.arguments.map((a) => strText(a)) : ts.isObjectLiteralExpression(n) ? n.properties.filter((p) => ts.isPropertyAssignment(p) && !FILL_PROPS.has(propName(p)) && !WORDS_PROPS.has(propName(p))).map((p) => strText(p.initializer)) : []
      if (vals.some((t) => t && turnsLight(TOKEN.exec(t)?.[1])) && vals.some((t) => t && WHITE.test(t))) pairedElsewhere.push(`${f}:${line(n)}: ${flat(n.getText()).slice(0, 110)}`)
      ts.forEachChild(n, pairs)
    }
    pairs(sf)
  }

  write(f, text, edits)
}

// The stylesheets: a rule that fills with a token and sets its words in the same block. Words a
// rule inherits from another rule (the cascade) are read by hand.
const sheets = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.css') ? a : `${a.replace(/\/$/, '')}/**/*.css`)) : globSync('src/**/*.css')).sort()
for (const f of sheets) {
  const text = readFileSync(f, 'utf8')
  if (!text.includes('var(--text-')) continue
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const edits = []
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const at = m.index + m[0].indexOf('{') + 1
    const line = clean.slice(0, at).split('\n').length
    const decls = []
    let off = 0
    for (const part of m[2].split(';')) {
      const d = /^(\s*)([a-z-]+)(\s*:\s*)([\s\S]*?)\s*$/i.exec(part)
      if (d) decls.push({ prop: d[2].toLowerCase(), value: d[4], start: at + off + d[1].length + d[2].length + d[3].length, line })
      off += part.length + 1
    }
    const fill = decls.filter((d) => d.prop === 'background' || d.prop === 'background-color').pop()
    const words = decls.filter((d) => d.prop === 'color').pop()
    const name = fill && TOKEN.exec(fill.value)?.[1]
    if (!name || !words || !(WHITE.test(words.value) || words.value === SURFACE_TEXT)) continue
    if (!turnsLight(name)) {
      if (WHITE.test(words.value) && darkTokenNote(name)) leftAlone.push(`${f}:${line}: ${darkTokenNote(name)}`)
      continue
    }
    if (paleUnmoved(name)) leftAlone.push(`${f}:${line}: ${name} reads ${ratio('#ffffff', LIGHT[name]).toFixed(2)}:1 under white in light; name its deeper token in MOVES`)
    const swap = (d, t) => edits.push({ start: d.start, end: d.start + d.value.length, text: t, line })
    if (isHue(name)) {
      if (words.value === SURFACE_TEXT) swap(words, '#fff')
      for (const d of decls) if (/^(background|background-color|border|border-color)$/.test(d.prop) && recoloured(d.value) !== d.value) swap(d, recoloured(d.value))
    } else {
      if (WHITE.test(words.value)) swap(words, SURFACE_TEXT)
      if (MOVES[name]) for (const d of decls) if (/^(background|background-color|border|border-color)$/.test(d.prop) && recoloured(d.value) !== d.value) swap(d, recoloured(d.value))
    }
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
if (SURVEY) {
  if (unread.length) console.log(`\nToken fills under words it cannot read:\n${unread.join('\n')}`)
  if (pairedElsewhere.length) console.log(`\nA token and white paired under other names (a call's arguments, a map):\n${pairedElsewhere.join('\n')}`)
}
const counted = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
console.log(`\n${DRY ? 'would rewrite' : 'rewrote'} ${counted(rewrites.style, 'style')} and ${counted(rewrites.rule, 'rule')}.`)
if (CHECK && rewrites.style + rewrites.rule > 0) {
  console.error('text-fill words check FAILED: words on a text-token fill that do not read in dark; run node scripts/codemods/text-fill-words-sweep.mjs')
  process.exit(1)
}
