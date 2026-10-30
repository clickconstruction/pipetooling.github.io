#!/usr/bin/env node
/**
 * Dead-press sweep (punch list #194, v2.6122).
 *
 * The rule (v2.6062, `src/lib/deadPress.ts`): a button that cannot be pressed yet, or is busy,
 * draws `DEAD_PRESS_FILL` (`--bg-200`) under `DEAD_PRESS_TEXT` (`--text-700`), 8.3:1 in light and
 * 5.1:1 in dark. The literal greys it replaces put white words on `#9ca3af` (2.54:1) or `#d1d5db`
 * (1.47:1) in both themes, and left inherited words light on a light slab in dark. Mechanical and
 * re-runnable (rebase rule: re-run this, never hand-resolve its diff). Parsed with the TypeScript
 * compiler, one file at a time.
 *
 * The rewrite: in a control's style object (a `<button>`'s `style`, an object with a `cursor`, or
 * one a button helper returns), a `background` or `backgroundColor` ternary with one branch
 * `'#9ca3af'` or `'#d1d5db'` takes `DEAD_PRESS_FILL` on that branch, and the object's `color`
 * follows the same condition: `cond ? DEAD_PRESS_TEXT : <its words>`, the branches in the fill's
 * order. A `color` that is already a ternary on the same condition has its dead branch replaced
 * instead. An object with no `color` and no spread gets one that leaves the live words alone
 * (`undefined`). A static grey under words is a dead press only when its cursor says so
 * (`not-allowed`, `wait`) or its button is plainly `disabled`; then both take the pair. The import
 * is added, or joined to an existing one from deadPress.
 *
 * Listed, never rewritten: a grey on an object that does not read as a control, a grey nested
 * below the ternary's first level, an object whose words could come from a spread, and a static
 * grey that does not say it is dead. Each is read by hand.
 *
 * Usage: node scripts/codemods/dead-press-sweep.mjs [--dry | --check] [paths…]
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

const DEAD_PRESS = 'src/lib/deadPress.ts'
const GREY = /^#(9ca3af|d1d5db)$/i
const FILL_PROPS = new Set(['background', 'backgroundColor'])

const strip = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression
  return n
}
const isGrey = (n) => {
  const s = strip(n)
  return !!s && (ts.isStringLiteral(s) || ts.isNoSubstitutionTemplateLiteral(s)) && GREY.test(s.text)
}
const propName = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null)
const flat = (t) => t.replace(/\n\s*/g, ' ')
const hasGreyBelow = (n) => {
  let found = false
  const walk = (c) => {
    if (found) return
    if (isGrey(c)) found = true
    else ts.forEachChild(c, walk)
  }
  ts.forEachChild(n, walk)
  return found
}

/** The element whose `style` this object is, when it is one. */
function styledElement(obj) {
  let p = obj.parent
  if (p && ts.isJsxExpression(p)) p = p.parent
  if (!p || !ts.isJsxAttribute(p) || p.name.getText() !== 'style') return null
  const el = p.parent?.parent
  return el && (ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el)) ? el : null
}

/** A `<button>`'s style, an object that sets a cursor, or one a button helper returns: what reads as a control. */
function readsAsControl(obj) {
  if (obj.properties.some((p) => ts.isPropertyAssignment(p) && propName(p) === 'cursor')) return true
  if (styledElement(obj)?.tagName.getText() === 'button') return true
  let p = obj.parent
  while (p && !ts.isFunctionLike(p)) p = p.parent
  const name = p?.name?.getText() ?? (p && ts.isVariableDeclaration(p.parent) ? p.parent.name.getText() : '')
  return /^(btn|button|press)|Btn|Button|Press/.test(name)
}

/** A static grey that says it is dead: a `not-allowed` or `wait` cursor, or a plainly `disabled` button. */
function saysDead(obj) {
  const cursor = obj.properties.find((p) => ts.isPropertyAssignment(p) && propName(p) === 'cursor')
  if (cursor && /^'(not-allowed|wait)'$/.test(strip(cursor.initializer).getText())) return true
  const el = styledElement(obj)
  return !!el && el.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'disabled' && (!a.initializer || a.initializer.getText() === '{true}'))
}

const files = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.ts') || a.endsWith('.tsx') ? a : `${a.replace(/\/$/, '')}/**/*.{ts,tsx}`)) : globSync('src/**/*.{ts,tsx}')).sort()
let rewrites = 0
let imports = 0
const report = []
const leftAlone = []

for (const f of files) {
  if (/\.test\.tsx?$/.test(f) || f === DEAD_PRESS || f.startsWith('src/test/')) continue
  const text = readFileSync(f, 'utf8')
  if (!/'#(9ca3af|d1d5db)'/i.test(text)) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const edits = [] // { start, end, text, line }

  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p) || !FILL_PROPS.has(propName(p))) continue
        const init = strip(p.initializer)
        if (isGrey(init)) {
          const color = n.properties.find((q) => ts.isPropertyAssignment(q) && propName(q) === 'color')
          if (!color) continue
          if (!saysDead(n)) {
            leftAlone.push(`${f}:${line(p)}: a static grey under words that does not say it is dead`)
            continue
          }
          edits.push({ start: p.initializer.getStart(), end: p.initializer.getEnd(), text: 'DEAD_PRESS_FILL', line: line(p) })
          edits.push({ start: color.initializer.getStart(), end: color.initializer.getEnd(), text: 'DEAD_PRESS_TEXT', line: line(p) })
          continue
        }
        if (!ts.isConditionalExpression(init)) continue
        const deadWhenTrue = isGrey(init.whenTrue)
        const deadWhenFalse = isGrey(init.whenFalse)
        if (!deadWhenTrue && !deadWhenFalse) {
          if (hasGreyBelow(init)) leftAlone.push(`${f}:${line(p)}: a grey below the ternary's first level`)
          continue
        }
        if (deadWhenTrue && deadWhenFalse) continue
        if (!readsAsControl(n)) {
          leftAlone.push(`${f}:${line(p)}: a grey fill on something that does not read as a control`)
          continue
        }
        const cond = flat(init.condition.getText())
        const color = n.properties.find((q) => ts.isPropertyAssignment(q) && propName(q) === 'color')
        let colorEdit = null
        if (color) {
          const words = strip(color.initializer)
          if (ts.isConditionalExpression(words) && flat(words.condition.getText()) === cond) {
            const dead = deadWhenTrue ? words.whenTrue : words.whenFalse
            colorEdit = { start: dead.getStart(), end: dead.getEnd(), text: 'DEAD_PRESS_TEXT' }
          } else {
            const live = color.initializer.getText()
            const wrapped = ts.isConditionalExpression(words) && deadWhenFalse ? `(${live})` : live
            colorEdit = { start: color.initializer.getStart(), end: color.initializer.getEnd(), text: deadWhenTrue ? `${cond} ? DEAD_PRESS_TEXT : ${wrapped}` : `${cond} ? ${wrapped} : DEAD_PRESS_TEXT` }
          }
        } else if (n.properties.some((q) => ts.isSpreadAssignment(q))) {
          leftAlone.push(`${f}:${line(p)}: the words could come from a spread`)
          continue
        } else {
          const own = sf.getLineAndCharacterOfPosition(p.getStart())
          const brace = sf.getLineAndCharacterOfPosition(n.getStart())
          const indent = text.slice(sf.getPositionOfLineAndCharacter(own.line, 0), p.getStart())
          const sep = own.line === brace.line ? ', ' : `,\n${indent}`
          const words = deadWhenTrue ? `${cond} ? DEAD_PRESS_TEXT : undefined` : `${cond} ? undefined : DEAD_PRESS_TEXT`
          colorEdit = { start: p.getEnd(), end: p.getEnd(), text: `${sep}color: ${words}` }
        }
        const grey = deadWhenTrue ? init.whenTrue : init.whenFalse
        edits.push({ start: grey.getStart(), end: grey.getEnd(), text: 'DEAD_PRESS_FILL', line: line(p) })
        edits.push({ ...colorEdit, line: line(p) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue

  // The import: join an existing import from deadPress, or add one after the last import.
  let s = text
  for (const e of [...edits].sort((a, b) => b.start - a.start)) s = s.slice(0, e.start) + e.text + s.slice(e.end)
  const want = ['DEAD_PRESS_FILL', 'DEAD_PRESS_TEXT'].filter((name) => !new RegExp(`\\b${name}\\b`).test(text))
  if (want.length) {
    const rel = path.relative(path.dirname(f), DEAD_PRESS).replace(/\\/g, '/').replace(/\.ts$/, '')
    const spec = rel.startsWith('.') ? rel : `./${rel}`
    const existing = sf.statements.find((st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && /\/deadPress$/.test(st.moduleSpecifier.text) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
    if (existing) {
      const nb = existing.importClause.namedBindings
      const at = nb.elements[nb.elements.length - 1].getEnd()
      // edits were applied from the end backwards; the import sits above every edit, so its offsets hold
      s = s.slice(0, at) + want.map((w) => `, ${w}`).join('') + s.slice(at)
    } else {
      const lastImport = [...sf.statements].reverse().find((st) => ts.isImportDeclaration(st))
      const at = lastImport ? lastImport.getEnd() : 0
      s = s.slice(0, at) + (lastImport ? '\n' : '') + `import { ${want.join(', ')} } from '${spec}'` + (lastImport ? '' : '\n') + s.slice(at)
    }
    imports += 1
  }
  const n = edits.length / 2
  rewrites += n
  report.push(`${f}  (${n} dead press${n === 1 ? '' : 'es'}; lines ${[...new Set(edits.map((e) => e.line))].sort((a, b) => a - b).join(', ')})`)
  if (!DRY) writeFileSync(f, s)
}

if (report.length) console.log(report.join('\n'))
if (leftAlone.length) console.log(`\nLeft alone, read by hand:\n${leftAlone.join('\n')}`)
console.log(`\n${DRY ? 'would rewrite' : 'rewrote'} ${rewrites} dead press${rewrites === 1 ? '' : 'es'}${imports ? `, ${imports} import${imports === 1 ? '' : 's'}` : ''}.`)
if (CHECK && rewrites > 0) {
  console.error('dead-press check FAILED: a dead or busy press draws a literal grey; run node scripts/codemods/dead-press-sweep.mjs')
  process.exit(1)
}
