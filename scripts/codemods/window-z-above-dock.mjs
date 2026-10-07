#!/usr/bin/env node
/**
 * Windows above the dock (v2.4431): every window stands above the Dispatch / Job mode dock.
 *
 * The dock (`DISPATCH_MODE_FOOTER_Z_INDEX` in `src/components/dispatchMode/DispatchModeFooter.tsx`)
 * is a fixed bar at the foot of the screen. A window whose backdrop had a lower z-index was drawn
 * under it, so on a short screen its last 60 px — the Save row — was covered. About 210 windows
 * stood at 10–121 while the dock stood at 1000, and some forty more tied with it at 1000.
 *
 * They could not all move above 1000: the Job form (1010), the Bid window (1000), the Job window
 * (1010) and others at 1000–1030 open ON TOP of those windows and would have ended up behind them.
 * So the dock moved down to 700 and each window kept its old number on top of the dock's
 * (60 → 760, 64 → 764). Adding the same number to every one keeps every order there was: a dialog
 * at 64 still opens over its window at 60, `overlayZIndex + 10` still means ten above, and
 * everything at 900 and from 1000 up still opens over all of them.
 *
 * A site is a `position: fixed` element that spans the screen's height (`inset: 0`, or `top` and
 * `bottom`) with a background, or any fixed element drawn through `createPortal`. Its z-index is
 * followed to the number it comes from — a literal, a constant in this file or an imported one, a
 * prop's default, the base of `x + 1` — and that number is raised. Also raised: a number passed
 * as a `zIndex`-like prop to a window component, and a fixed full-screen rule in a `.css` file.
 * Left alone:
 *  - a see-through layer (the click-catcher behind a menu) and a backdrop with nothing inside it —
 *    their menu or panel is the next element, one above, and the two only make sense together
 *  - a fixed element that is not a window (a toolbar, a popover, the map's key)
 *  - an element with a `window-z: allow — <why>` comment up to two lines above it or inside its
 *    opening tag, for a full-screen layer that is meant to stay under the dock
 *
 * Mechanical and re-runnable (rebase rule: re-run this, never hand-resolve its diff). CI runs it
 * with --check (ci.yml and deploy.yml): a window merged under the dock fails its pull request —
 * it would be covered by the dock AND by every window already raised.
 *
 * Usage: node scripts/codemods/window-z-above-dock.mjs [--dry | --check | --list]
 *   --dry    lists what it would raise, writes nothing
 *   --check  the same, and exits 1 when anything is left to raise (`npm run check:window-z`)
 *   --list   prints every window with the z-index it resolves to, writes nothing
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import ts from 'typescript'

const CHECK = process.argv.includes('--check')
const LIST = process.argv.includes('--list')
const DRY = CHECK || LIST || process.argv.includes('--dry')
const DOCK_FILE = 'src/components/dispatchMode/DispatchModeFooter.tsx'
const ALLOW = /window-z:\s*allow/
const Z_PROP = /^(zIndex|\w+ZIndex)$/
const WINDOW_NAME = /Modal|Dialog|Sheet|Drawer|Shell|Lightbox|Overlay|Popover|Popup|Window|Menu/

const dockMatch = readFileSync(DOCK_FILE, 'utf8').match(/DISPATCH_MODE_FOOTER_Z_INDEX\s*=\s*(\d+)/)
if (!dockMatch) {
  console.error(`window-z: DISPATCH_MODE_FOOTER_Z_INDEX not found in ${DOCK_FILE}`)
  process.exit(2)
}
const DOCK_Z = Number(dockMatch[1])
/** A window keeps its old number on top of the dock's. */
const SHIFT = DOCK_Z

const tracked = execSync("git ls-files 'src/*.ts' 'src/**/*.ts' 'src/*.tsx' 'src/**/*.tsx' 'src/*.css' 'src/**/*.css'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const isTest = (f) => /\.test\.tsx?$/.test(f) || f.startsWith('src/test/')
const tsxFiles = tracked.filter((f) => f.endsWith('.tsx') && !isTest(f)).sort()
const cssFiles = tracked.filter((f) => f.endsWith('.css')).sort()

const parsed = new Map()
function parse(file) {
  if (!parsed.has(file)) {
    const text = readFileSync(file, 'utf8')
    parsed.set(file, { text, sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) })
  }
  return parsed.get(file)
}

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.normalize(path.join(path.dirname(from), spec))
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext
  return null
}

function unwrap(e) {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e))) e = e.expression
  return e
}

/** `name` declared at the top of `sf`: the initializer of a const, or the file it is imported from. */
function topLevel(sf, name) {
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return { node: d.initializer, sf }
    }
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      for (const el of st.importClause.namedBindings.elements) {
        if (el.name.text !== name) continue
        const target = resolveImport(sf.fileName, st.moduleSpecifier.text)
        return target ? topLevel(parse(target).sf, (el.propertyName ?? el.name).text) : null
      }
    }
  }
  return null
}

/**
 * What an identifier stands for where it is used: a parameter's default or a local const of an
 * enclosing function first (so `zIndex` reads this component's default, not a neighbour's), then
 * the file's own consts and imports. `null` for a prop with no default — its caller decides.
 */
function resolveIdent(sf, id) {
  const name = id.text
  for (let cur = id.parent; cur; cur = cur.parent) {
    if (ts.isFunctionLike(cur)) {
      for (const p of cur.parameters) {
        if (ts.isIdentifier(p.name) && p.name.text === name) return null
        if (ts.isObjectBindingPattern(p.name)) {
          for (const el of p.name.elements) if (ts.isIdentifier(el.name) && el.name.text === name) return el.initializer ? { node: el.initializer, sf } : null
        }
      }
    }
    if (ts.isBlock(cur)) {
      for (const st of cur.statements) {
        if (!ts.isVariableStatement(st)) continue
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name) return d.initializer ? { node: d.initializer, sf } : null
          if (ts.isObjectBindingPattern(d.name)) for (const el of d.name.elements) if (ts.isIdentifier(el.name) && el.name.text === name) return el.initializer ? { node: el.initializer, sf } : null
        }
      }
    }
  }
  return topLevel(sf, name)
}

/**
 * Every number an expression can come to, each with the literal it starts from (`src`): that
 * literal is what gets raised, so `base + 10` raises `base` and keeps the ten.
 */
function alts(sf, e, depth = 0) {
  e = unwrap(e)
  if (!e || depth > 8) return []
  if (ts.isNumericLiteral(e)) return [{ value: Number(e.text), src: { file: sf.fileName, pos: e.getStart(sf), end: e.getEnd(), value: Number(e.text) } }]
  if (ts.isIdentifier(e)) {
    const r = resolveIdent(sf, e)
    return r ? alts(r.sf, r.node, depth + 1) : []
  }
  if (ts.isConditionalExpression(e)) return [...alts(sf, e.whenTrue, depth + 1), ...alts(sf, e.whenFalse, depth + 1)]
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return [...alts(sf, e.left, depth + 1), ...alts(sf, e.right, depth + 1)]
    if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.MinusToken) {
      const sign = op === ts.SyntaxKind.PlusToken ? 1 : -1
      const l = unwrap(e.left)
      const r = unwrap(e.right)
      if (ts.isNumericLiteral(r)) return alts(sf, l, depth + 1).map((a) => ({ value: a.value + sign * Number(r.text), src: a.src }))
      if (ts.isNumericLiteral(l) && sign === 1) return alts(sf, r, depth + 1).map((a) => ({ value: a.value + Number(l.text), src: a.src }))
      const la = alts(sf, l, depth + 1)
      const ra = alts(sf, r, depth + 1)
      return la.length === 1 && ra.length === 1 ? [{ value: la[0].value + sign * ra[0].value, src: la[0].src }] : []
    }
  }
  return []
}

/** The object literals a `style` expression can be: through a ternary, a const, `useMemo(() => ({…}))`. */
function objects(sf, e, depth = 0) {
  e = unwrap(e)
  if (!e || depth > 6) return []
  if (ts.isObjectLiteralExpression(e)) return [{ obj: e, sf }]
  if (ts.isConditionalExpression(e)) return [...objects(sf, e.whenTrue, depth + 1), ...objects(sf, e.whenFalse, depth + 1)]
  if (ts.isBinaryExpression(e)) return [...objects(sf, e.left, depth + 1), ...objects(sf, e.right, depth + 1)]
  if (ts.isIdentifier(e)) {
    const r = resolveIdent(sf, e)
    return r ? objects(r.sf, r.node, depth + 1) : []
  }
  if (ts.isCallExpression(e)) return e.arguments.flatMap((a) => objects(sf, a, depth + 1))
  if (ts.isArrowFunction(e)) return objects(sf, e.body, depth + 1)
  return []
}

/** The property sets a style object can come to — one per way its spreads can resolve. Values keep the file they were written in. */
function variants(sf, obj, depth = 0) {
  let out = [{}]
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) {
      if (depth > 3) continue
      const spread = objects(sf, p.expression).flatMap((o) => variants(o.sf, o.obj, depth + 1))
      if (spread.length) out = out.flatMap((v) => spread.map((s) => ({ ...v, ...s }))).slice(0, 12)
    } else if (ts.isPropertyAssignment(p)) {
      const key = p.name.getText(sf).replace(/['"]/g, '')
      for (const v of out) v[key] = { node: p.initializer, sf }
    } else if (ts.isShorthandPropertyAssignment(p)) {
      for (const v of out) v[p.name.text] = { node: p.name, sf }
    }
  }
  return out
}

const textOf = (v) => (v ? unwrap(v.node).getText(v.sf) : null)
const isZero = (v) => /^(0|'0'|"0"|'0px'|"0px")$/.test(textOf(v) ?? '')

/** Reads one JSX element as a fixed layer, or null. `window`: spans the screen's height, has a background, holds something. */
function layerOf(sf, el) {
  const opening = ts.isJsxElement(el) ? el.openingElement : el
  const styleAttr = opening.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'style')
  if (!styleAttr?.initializer || !ts.isJsxExpression(styleAttr.initializer) || !styleAttr.initializer.expression) return null
  const found = []
  for (const o of objects(sf, styleAttr.initializer.expression)) {
    for (const v of variants(o.sf, o.obj)) {
      if (!/^['"]fixed['"]$/.test(textOf(v.position) ?? '')) continue
      const fullHeight = isZero(v.inset) || (isZero(v.top) && v.bottom != null)
      const bg = [v.background, v.backgroundColor].some((b) => b && !/^['"](transparent|none)['"]$/.test(textOf(b)))
      found.push({ fullHeight, bg, hasZ: v.zIndex != null, z: v.zIndex ? alts(v.zIndex.sf, v.zIndex.node) : [] })
    }
  }
  return found.length ? found : null
}

function allowed(sf, text, el) {
  const opening = ts.isJsxElement(el) ? el.openingElement : el
  if (ALLOW.test(opening.getText(sf))) return true
  const line = sf.getLineAndCharacterOfPosition(el.getStart(sf)).line
  const lines = text.split('\n')
  return ALLOW.test(lines.slice(Math.max(0, line - 2), line).join('\n'))
}

/** Drawn through `createPortal`: written inside the call, or held in a const that is handed to it (`createPortal(node, document.body)`). */
const insidePortal = (sf, text, n) => {
  for (let c = n.parent; c; c = c.parent) {
    if (ts.isCallExpression(c) && /createPortal$/.test(c.expression.getText(sf))) return true
    if (ts.isVariableDeclaration(c) && ts.isIdentifier(c.name) && new RegExp(`createPortal\\(\\s*${c.name.text}\\s*,`).test(text)) return true
  }
  return false
}

/** file → Map(pos → { end, value }) — one entry per literal however many windows read it. */
const edits = new Map()
const findings = []
const listing = []
function raise(src, where, what) {
  if (!edits.has(src.file)) edits.set(src.file, new Map())
  const perFile = edits.get(src.file)
  if (!perFile.has(src.pos)) {
    perFile.set(src.pos, { end: src.end, value: src.value })
    const { sf } = parse(src.file)
    const at = sf.getLineAndCharacterOfPosition(src.pos).line + 1
    findings.push(`${src.file}:${at}  ${src.value} → ${src.value + SHIFT}  (${what}${where === `${src.file}:${at}` ? '' : `, read at ${where}`})`)
  }
}

for (const file of tsxFiles) {
  const { text, sf } = parse(file)
  if (!/fixed|ZIndex=|zIndex=/.test(text)) continue
  const visit = (n, fixedDepth) => {
    let depth = fixedDepth
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n
      const tag = opening.tagName.getText(sf)
      const where = `${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`
      // A number handed to a window component as its z-index.
      if (/^[A-Z]/.test(tag) && WINDOW_NAME.test(tag)) {
        for (const a of opening.attributes.properties) {
          if (!ts.isJsxAttribute(a) || !Z_PROP.test(a.name.getText(sf)) || !a.initializer || !ts.isJsxExpression(a.initializer)) continue
          const lit = unwrap(a.initializer.expression)
          if (lit && ts.isNumericLiteral(lit) && Number(lit.text) >= 10 && Number(lit.text) < DOCK_Z && !allowed(sf, text, n)) {
            raise({ file, pos: lit.getStart(sf), end: lit.getEnd(), value: Number(lit.text) }, where, `${a.name.getText(sf)} passed to <${tag}>`)
          }
        }
      }
      const layer = layerOf(sf, n)
      if (layer) {
        depth += 1
        const portal = insidePortal(sf, text, n)
        const holdsSomething = ts.isJsxElement(n)
        const skip = allowed(sf, text, n)
        for (const v of layer) {
          const isWindow = v.fullHeight && v.bg && holdsSomething
          if (!isWindow && !portal) continue
          if (LIST) listing.push(`${v.z.length ? v.z.map((a) => a.value).join('|') : v.hasZ ? 'prop' : 'none'}\t${where}${portal ? '\tportal' : ''}${skip ? '\tallowed' : ''}`)
          if (skip) continue
          for (const a of v.z) if (a.value < DOCK_Z) raise(a.src, where, isWindow ? 'window' : 'portal layer')
          // No z-index at all, and not drawn inside another fixed layer: it paints under the dock.
          if (isWindow && !v.hasZ && fixedDepth === 0) findings.push(`${where}  a window with no z-index — give it one above the dock (${DOCK_Z}), or mark it \`window-z: allow — <why>\``)
        }
      }
    }
    ts.forEachChild(n, (c) => visit(c, depth))
  }
  visit(sf, 0)
}

// Fixed full-screen rules in the stylesheets.
for (const file of cssFiles) {
  const text = readFileSync(file, 'utf8')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) {
    if (!/position\s*:\s*fixed/.test(m[2]) || !/inset\s*:\s*0\s*[;}]|inset\s*:\s*0\s*$/.test(m[2]) || !/background/.test(m[2])) continue
    const z = m[2].match(/z-index\s*:\s*(\d+)/)
    if (!z || Number(z[1]) >= DOCK_Z) continue
    if (ALLOW.test(text.slice(Math.max(0, m.index - 200), m.index + m[0].length))) continue
    const pos = m.index + m[1].length + 1 + z.index + z[0].length - z[1].length
    if (!edits.has(file)) edits.set(file, new Map())
    edits.get(file).set(pos, { end: pos + z[1].length, value: Number(z[1]) })
    findings.push(`${file}:${text.slice(0, pos).split('\n').length}  ${z[1]} → ${Number(z[1]) + SHIFT}  (window, ${m[1].trim().split('\n').pop().trim()})`)
  }
}

if (LIST) {
  console.log(listing.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join('\n'))
  process.exit(0)
}

if (!DRY) {
  for (const [file, perFile] of edits) {
    let text = readFileSync(file, 'utf8')
    for (const [pos, e] of [...perFile].sort((a, b) => b[0] - a[0])) text = text.slice(0, pos) + String(e.value + SHIFT) + text.slice(e.end)
    writeFileSync(file, text)
  }
}

if (findings.length) console.log(findings.sort().join('\n'))
const raised = [...edits.values()].reduce((n, m) => n + m.size, 0)
const unraisable = findings.length - raised
if (CHECK) {
  if (findings.length) {
    console.error(`\nwindow-z: ${findings.length} window${findings.length === 1 ? '' : 's'} under the dock (z ${DOCK_Z}). Run \`node scripts/codemods/window-z-above-dock.mjs\`, or give a new window a z-index above ${DOCK_Z}.`)
    process.exit(1)
  }
  console.log(`window-z: every window stands above the dock (z ${DOCK_Z}).`)
} else {
  console.log(`\nwindow-z: ${raised} number${raised === 1 ? '' : 's'} ${DRY ? 'to raise' : 'raised'} by ${SHIFT} in ${edits.size} file${edits.size === 1 ? '' : 's'}${unraisable ? `; ${unraisable} to fix by hand` : ''}.`)
}
