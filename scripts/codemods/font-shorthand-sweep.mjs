#!/usr/bin/env node
/**
 * Font shorthand sweep (v2.7907).
 *
 * `font: 'inherit'` in an inline style is the whole-font shorthand. React sets a style's
 * properties in the order the object holds them, so a `fontSize`, a `fontWeight` or a `lineHeight`
 * written before it is reset the moment the shorthand lands: the press draws at the page's size and
 * weight, not its own. A later render that changes the weight sets that one property, which is why
 * a chip turned bold only after its first press (v2.7902, the Permits chips).
 *
 * The stylesheet already gives every `input`, `select`, `textarea` and `button` the page's font
 * (`src/index.css`), so the shorthand adds nothing there but the family. Mechanical and
 * re-runnable (rebase rule: re-run this, never hand-resolve its diff). Parsed with the TypeScript
 * compiler, one file at a time.
 *
 * The rewrite: in any object literal where a font longhand comes before `font: 'inherit'`, in the
 * order the finished object holds its keys, the shorthand becomes `fontFamily: 'inherit'`. The
 * order follows a spread: `{ fontSize: 12, ...press }` where `press` holds the shorthand, and
 * `{ ...small, font: 'inherit' }` where `small` holds a size. It reads a style by name from the
 * same file or from a file it imports, a style a function returns, every style of a map read by
 * key (`TONE[tone]`), and both branches of `...(on ? { … } : { … })`. The shorthand is rewritten
 * where it is written, so a shared style changes for everything that spreads it. Where a
 * `fontFamily` comes before the shorthand, or the object names its own, the shorthand is dropped,
 * so the family it wrote holds.
 *
 * Left alone: a shorthand with no longhand before it (the longhands after it hold), and any
 * `font` whose value is not `'inherit'`. Listed, never rewritten: a style that writes the
 * shorthand after a spread it cannot read (a prop, a parameter), which may hold a size or a weight.
 * Each is read by hand.
 *
 * Usage: node scripts/codemods/font-shorthand-sweep.mjs [--dry | --check] [paths…]
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

/** What the `font` shorthand resets. */
const LONGHAND = /^(fontSize|fontWeight|fontStyle|fontFamily|fontStretch|lineHeight|fontVariant[A-Za-z]*|fontKerning|fontFeatureSettings|fontSizeAdjust|fontOpticalSizing|fontVariationSettings)$/

const strip = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n))) n = n.expression
  return n
}
const propName = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null)
const isInherit = (p) => {
  const v = ts.isPropertyAssignment(p) ? strip(p.initializer) : null
  return !!v && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) && v.text === 'inherit'
}

const files = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.ts') || a.endsWith('.tsx') ? a : `${a.replace(/\/$/, '')}/**/*.{ts,tsx}`)) : globSync('src/**/*.{ts,tsx}')).sort()
const report = []
const leftAlone = []

/** One parsed file: its source, every const and function by name, and where each imported name comes from. */
const loaded = new Map()
const load = (f) => {
  if (loaded.has(f)) return loaded.get(f)
  let text
  try {
    text = readFileSync(f, 'utf8')
  } catch {
    loaded.set(f, null)
    return null
  }
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const named = new Map()
  const imports = new Map()
  const collect = (n) => {
    // A name declared twice in one file (two components, each with its own `tall`) reads as any of them.
    const name = (key, init) => named.set(key, [...(named.get(key) ?? []), init])
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) name(n.name.text, n.initializer)
    else if (ts.isFunctionDeclaration(n) && n.name) name(n.name.text, n)
    else if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith('.') && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
      for (const el of n.importClause.namedBindings.elements) imports.set(el.name.text, { from: n.moduleSpecifier.text, name: (el.propertyName ?? el.name).text })
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)
  const ctx = { f, text, sf, named, imports }
  loaded.set(f, ctx)
  return ctx
}
const importedFile = (ctx, from) => {
  const base = path.join(path.dirname(ctx.f), from)
  for (const tail of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const hit = load(base + tail)
    if (hit) return hit
  }
  return null
}
const line = (ctx, n) => ctx.sf.getLineAndCharacterOfPosition(n.getStart(ctx.sf)).line + 1

/**
 * Every object an expression can be, each with the file that wrote it. `blind` is true when some
 * part of it cannot be read: a prop, a parameter, a call it cannot follow.
 */
const objectsOf = (expr, ctx, depth = 0) => {
  const e = strip(expr)
  const none = { list: [], blind: false }
  const blind = { list: [], blind: true }
  if (!e || depth > 6) return blind
  if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return none
  if (ts.isObjectLiteralExpression(e)) return { list: [{ obj: e, ctx }], blind: false }
  const join = (...parts) => ({ list: parts.flatMap((p) => p.list), blind: parts.some((p) => p.blind) })
  if (ts.isConditionalExpression(e)) return join(objectsOf(e.whenTrue, ctx, depth + 1), objectsOf(e.whenFalse, ctx, depth + 1))
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return objectsOf(e.right, ctx, depth + 1)
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return join(objectsOf(e.left, ctx, depth + 1), objectsOf(e.right, ctx, depth + 1))
    return blind
  }
  if (ts.isIdentifier(e)) {
    if (ctx.named.has(e.text)) return join(...ctx.named.get(e.text).map((init) => objectsOf(init, ctx, depth + 1)))
    const imp = ctx.imports.get(e.text)
    const other = imp ? importedFile(ctx, imp.from) : null
    const inits = other?.named.get(imp.name)
    return inits ? join(...inits.map((init) => objectsOf(init, other, depth + 1))) : blind
  }
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e) || ts.isFunctionDeclaration(e)) {
    if (!e.body) return blind
    if (!ts.isBlock(e.body)) return objectsOf(e.body, ctx, depth + 1)
    const returns = []
    const find = (n) => {
      if (ts.isReturnStatement(n)) returns.push(n)
      else if (!ts.isFunctionLike(n)) ts.forEachChild(n, find)
    }
    ts.forEachChild(e.body, find)
    return returns.length ? join(...returns.map((r) => (r.expression ? objectsOf(r.expression, ctx, depth + 1) : none))) : blind
  }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    // A call is read only when the name is a function: `useMemo(...)` and the like stay unread.
    const local = ctx.named.get(e.expression.text)
    const imp = ctx.imports.get(e.expression.text)
    const other = !local && imp ? importedFile(ctx, imp.from) : null
    const fns = (local ?? other?.named.get(imp?.name) ?? []).map(strip)
    const isFn = (fn) => !!fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn))
    return fns.length && fns.every(isFn) ? join(...fns.map((fn) => objectsOf(fn, local ? ctx : other, depth + 1))) : blind
  }
  if (ts.isElementAccessExpression(e)) {
    // A map of styles read by key: any of its styles.
    const map = objectsOf(e.expression, ctx, depth + 1)
    if (map.blind || map.list.length !== 1) return blind
    const { obj, ctx: at } = map.list[0]
    const parts = obj.properties.map((p) => (ts.isPropertyAssignment(p) ? objectsOf(p.initializer, at, depth + 1) : blind))
    return parts.length ? join(...parts) : blind
  }
  return blind
}

/**
 * The keys an object ends with, in the order it holds them: a key written twice keeps its first
 * place, as a JavaScript object does. `unknown` marks a spread it cannot read.
 */
const keysOf = (obj, ctx, order = new Map(), seen = new Set([obj])) => {
  const put = (key, entry) => order.set(key, { ...entry, at: order.has(key) ? order.get(key).at : order.size })
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      const key = propName(p)
      if (key) put(key, { prop: p, owner: obj, ctx })
    } else if (ts.isSpreadAssignment(p)) {
      const bases = objectsOf(p.expression, ctx)
      for (const b of bases.list) if (!seen.has(b.obj)) keysOf(b.obj, b.ctx, order, new Set([...seen, b.obj]))
      if (bases.blind) put(`unknown:${ctx.f}:${p.getStart(ctx.sf)}`, { unknown: p.expression.getText(ctx.sf).slice(0, 40) })
    }
  }
  return order
}

/** file → (start of the property → what to do with it). */
const edits = new Map()
for (const f of files) {
  if (/\.test\.tsx?$/.test(f) || f.startsWith('src/test/')) continue
  const ctx = load(f)
  if (!ctx) continue
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const order = [...keysOf(n, ctx).entries()].sort((a, b) => a[1].at - b[1].at)
      const fontAt = order.findIndex(([k, e]) => k === 'font' && e.prop && isInherit(e.prop))
      if (fontAt >= 0) {
        const before = order.slice(0, fontAt)
        // Each longhand the shorthand resets, with the value the style wrote for it.
        const reset = before.filter(([k]) => LONGHAND.test(k)).map(([k, e]) => (ts.isPropertyAssignment(e.prop) ? `${k}: ${e.prop.initializer.getText(e.ctx.sf).replace(/\s+/g, ' ').slice(0, 48)}` : k))
        const font = order[fontAt][1]
        if (reset.length) {
          const at = font.ctx
          // A family written before the shorthand, the style's own or one it spreads, is one the shorthand reset: dropping it lets that family hold.
          const ownFamily = before.some(([k]) => k === 'fontFamily') || font.owner.properties.some((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && propName(p) === 'fontFamily')
          if (!edits.has(at.f)) edits.set(at.f, new Map())
          const start = font.prop.getStart(at.sf)
          // The shorthand may sit in a style this one spreads: that style is the one rewritten.
          if (!edits.get(at.f).has(start)) edits.get(at.f).set(start, { prop: font.prop, drop: ownFamily, line: line(at, font.prop), reset, via: font.owner === n ? null : `${ctx.f === at.f ? '' : `${ctx.f}:`}${line(ctx, n)}` })
        } else if (font.owner === n && before.some(([, e]) => e.unknown)) {
          leftAlone.push(`${f}:${line(ctx, font.prop)}: the shorthand follows a spread it cannot read (${before.filter(([, e]) => e.unknown).map(([, e]) => e.unknown).join(', ')}), which may hold a size or a weight`)
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(ctx.sf)
}

let rewrites = 0
for (const [f, byStart] of [...edits.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const ctx = load(f)
  let out = ctx.text
  for (const e of [...byStart.values()].sort((a, b) => b.prop.getStart(ctx.sf) - a.prop.getStart(ctx.sf))) {
    if (e.drop) {
      // Take the property with its comma and the space after it; a last property takes the comma before it.
      let start = e.prop.getStart(ctx.sf)
      let end = e.prop.getEnd()
      const after = /^\s*,[ \t]*/.exec(out.slice(end))
      if (after) end += after[0].length
      else {
        const lead = /,\s*$/.exec(out.slice(0, start))
        if (lead) start -= lead[0].length
      }
      out = out.slice(0, start) + out.slice(end)
    } else {
      out = out.slice(0, e.prop.name.getStart(ctx.sf)) + 'fontFamily' + out.slice(e.prop.name.getEnd())
    }
  }
  rewrites += byStart.size
  const lines = [...byStart.values()].sort((a, b) => a.line - b.line)
  report.push(`${f}  (${byStart.size} style${byStart.size === 1 ? '' : 's'}; ${lines.map((e) => `${e.line}${e.drop ? ' dropped' : ''}${e.via ? ` via ${e.via}` : ''} [${e.reset.join(', ')}]`).join('; ')})`)
  if (!DRY) writeFileSync(f, out)
}

if (report.length) console.log(report.join('\n'))
if (leftAlone.length) console.log(`\nLeft alone, read by hand:\n${leftAlone.join('\n')}`)
console.log(`\n${DRY ? 'would rewrite' : 'rewrote'} ${rewrites} style${rewrites === 1 ? '' : 's'} in ${report.length} file${report.length === 1 ? '' : 's'}.`)
if (CHECK && rewrites > 0) {
  console.error("font-shorthand check FAILED: a style sets a size, a weight or a line height and then font: 'inherit', which resets it; run node scripts/codemods/font-shorthand-sweep.mjs")
  process.exit(1)
}
