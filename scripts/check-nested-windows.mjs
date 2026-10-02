#!/usr/bin/env node
/**
 * Nested windows (v2.4352): a window drawn inside another window's backdrop, outside its panel.
 *
 * A window is a full-screen `position: fixed` backdrop that closes on `onClick`, holding a panel
 * that stops the click. React bubbles a click through the component tree — through a portal too —
 * so a real click on an inner window's backdrop runs the inner handler and then the outer
 * backdrop's `onClick`, and a click outside the inner window closes both. The page-wide drag guard
 * (`src/lib/modalBackdropGuard.ts`) cannot stop it: React walks every handler inside one native
 * dispatch. The fix is local — the inner backdrop calls `e.stopPropagation()` before it closes,
 * or the outer backdrop closes only on `e.target === e.currentTarget`.
 *
 * This finds every backdrop that closes without a target check and holds, outside every element
 * that stops that event, something that lets a click through: an inline fixed layer, a component
 * that renders one (followed through imports, `lazy()`, `memo()`, the props it renders outside its
 * own stopper), or a portal. Parsed with the TypeScript compiler, not grepped: v2.4338's grep for
 * press-closers found 3 of 92.
 *
 * Usage: node scripts/check-nested-windows.mjs [--rows]
 *   Exits 1 when a backdrop holds a window that lets the click through.
 *   --rows also lists clickable containers that are not backdrops (a table row whose onClick
 *   toggles it) holding such a window — the same bubbling, reported only. A container is any
 *   element whose handler does more than stop or prevent the event (v2.4359; it used to need a
 *   child that stops the click, which missed the Pipeline's <tr> rows and cards).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const require = createRequire(path.join(ROOT, 'package.json'))
const ts = require('typescript')
const ROWS = process.argv.includes('--rows')

const EVENT_OF = { onClick: 'click', onMouseDown: 'mousedown', onMouseUp: 'mouseup', onPointerDown: 'pointerdown', onPointerUp: 'pointerup', onTouchStart: 'touchstart', onTouchEnd: 'touchend' }
const TARGET_CHECK = /\b(\w+)\.target\s*(===|!==)\s*\1\.currentTarget\b|\b(\w+)\.currentTarget\s*(===|!==)\s*\3\.target\b/
const CLOSES = /[Cc]lose|[Cc]ancel|[Dd]ismiss|\((false|null)\)/
const WINDOW_NAME = /Modal|Dialog|Sheet|Drawer|Lightbox|Overlay|Popover|Popup|Window/

const sourceFiles = execSync("git ls-files 'src/*.ts' 'src/**/*.ts' 'src/*.tsx' 'src/**/*.tsx' 'src/*.css' 'src/**/*.css'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

// ---- Class names whose CSS (a .css file, or CSS inside a TSX <style> / template) is position: fixed
const FIXED_CLASSES = new Set()
for (const f of sourceFiles) {
  const text = readFileSync(path.join(ROOT, f), 'utf8')
  if (!/position\s*:\s*fixed/.test(text)) continue
  const re = /([^{}`'"]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text.replace(/\/\*[\s\S]*?\*\//g, '')))) {
    if (!/position\s*:\s*fixed/.test(m[2])) continue
    for (const part of m[1].split(',')) {
      const last = part.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? ''
      for (const c of last.match(/\.[A-Za-z][A-Za-z0-9_-]+/g) ?? []) FIXED_CLASSES.add(c.slice(1))
    }
  }
}

// ---- The program
const files = sourceFiles.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('src/test/'))
const cfg = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
const options = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT).options
const program = ts.createProgram({ rootNames: files.map((f) => path.join(ROOT, f)), options: { ...options, noEmit: true } })
const checker = program.getTypeChecker()
const SRC = path.join(ROOT, 'src')

const where = (n) => `${path.relative(ROOT, n.getSourceFile().fileName)}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}`
const short = (s, n = 100) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
function strip(e) {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e))) e = e.expression
  return e
}
function resolveDecl(node) {
  let sym = checker.getSymbolAtLocation(node)
  if (!sym) return null
  if (sym.flags & ts.SymbolFlags.Alias) {
    try {
      sym = checker.getAliasedSymbol(sym)
    } catch {
      return null
    }
  }
  return sym.declarations?.[0] ?? sym.valueDeclaration ?? null
}
const inProject = (d) => !!d && d.getSourceFile().fileName.startsWith(SRC)
const isFn = (n) => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n))
/** The function a handler / helper identifier names, unwrapping useCallback. */
function fnOfDecl(d) {
  if (!d || !inProject(d)) return null
  if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d
  if (ts.isVariableDeclaration(d) && d.initializer) {
    let init = strip(d.initializer)
    if (ts.isCallExpression(init) && /useCallback$/.test(init.expression.getText()) && init.arguments[0]) init = strip(init.arguments[0])
    if (isFn(init)) return init
  }
  return null
}
function returnsOf(f) {
  if (!f.body) return []
  if (!ts.isBlock(f.body)) return [f.body]
  const out = []
  const visit = (n) => {
    if (ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression)
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(f.body, visit)
  return out
}

// ---- JSX elements: style, handlers
const opening = (el) => (ts.isJsxElement(el) ? el.openingElement : el)
const tagName = (el) => opening(el).tagName
const isIntrinsic = (el) => /^[a-z]/.test(tagName(el).getText()) || tagName(el).getText().includes('-')
const attr = (el, name) => opening(el).attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name) ?? null
function attrExpr(a) {
  if (!a?.initializer) return null
  if (ts.isStringLiteral(a.initializer)) return a.initializer
  return ts.isJsxExpression(a.initializer) ? (a.initializer.expression ?? null) : null
}

const styleMemo = new Map()
function isFixedStyle(e, depth = 0) {
  e = strip(e)
  if (!e || depth > 6) return false
  if (ts.isObjectLiteralExpression(e)) {
    return e.properties.some((p) =>
      ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, '') === 'position'
        ? /['"`]fixed['"`]/.test(p.initializer.getText())
        : ts.isSpreadAssignment(p) && isFixedStyle(p.expression, depth + 1),
    )
  }
  if (ts.isConditionalExpression(e)) return isFixedStyle(e.whenTrue, depth + 1) || isFixedStyle(e.whenFalse, depth + 1)
  if (ts.isBinaryExpression(e)) return isFixedStyle(e.left, depth + 1) || isFixedStyle(e.right, depth + 1)
  if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
    const d = resolveDecl(ts.isElementAccessExpression(e) ? e.expression : e)
    if (!d) return false
    if (!styleMemo.has(d)) {
      styleMemo.set(d, false)
      let r = (ts.isVariableDeclaration(d) || ts.isPropertyAssignment(d)) && d.initializer ? isFixedStyle(d.initializer, depth + 1) : false
      if (!r && ts.isElementAccessExpression(e)) r = /position\s*:\s*['"`]fixed/.test(d.getText())
      styleMemo.set(d, r)
    }
    return styleMemo.get(d)
  }
  if (ts.isCallExpression(e)) {
    if (e.arguments.some((a) => isFixedStyle(a, depth + 1))) return true
    const d = resolveDecl(e.expression)
    return !!d && /position\s*:\s*['"`]fixed/.test(d.getText())
  }
  return false
}
function isFixedLayer(el) {
  const s = attrExpr(attr(el, 'style'))
  if (s && isFixedStyle(s)) return true
  const c = attrExpr(attr(el, 'className'))
  return !!c && [...c.getText().matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)].some((m) => FIXED_CLASSES.has(m[0]))
}

const isStopCall = (x) => {
  x = strip(x)
  return !!x && ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === 'stopPropagation'
}
const STOPPERS = new Set(['stopPropagation', 'stopImmediatePropagation', 'preventDefault'])
/**
 * True when a handler does nothing but stop or prevent the event, in every branch:
 * `(e) => e.preventDefault()`, `paneMode ? undefined : (e) => e.stopPropagation()`.
 * A prop or a function it cannot see into may do anything, so it is not inert.
 */
function isInert(e, depth = 0) {
  e = strip(e)
  if (!e) return true
  if (depth > 6) return false
  if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return true
  if (ts.isConditionalExpression(e)) return isInert(e.whenTrue, depth + 1) && isInert(e.whenFalse, depth + 1)
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return isInert(e.right, depth + 1)
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return isInert(e.left, depth + 1) && isInert(e.right, depth + 1)
  }
  const fn = isFn(e) ? e : ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) ? fnOfDecl(resolveDecl(e)) : null
  if (!fn?.body) return false
  let inert = true
  const visit = (n) => {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const callee = strip(n.expression)
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(callee) || !STOPPERS.has(callee.name.text)) inert = false
    }
    if (inert) ts.forEachChild(n, visit)
  }
  visit(fn.body)
  return inert
}
/** What a handler attribute does: its text, whether it always stops the event, whether it checks the target. */
function handlerInfo(a) {
  const e = attrExpr(a)
  if (!e) return null
  const se = strip(e)
  let fn = isFn(se) ? se : null
  let text = e.getText()
  if (!fn && (ts.isIdentifier(se) || ts.isPropertyAccessExpression(se))) {
    fn = fnOfDecl(resolveDecl(se))
    if (fn) text = `${se.getText()} = ${fn.getText()}`
  }
  let stopsAlways = false
  if (fn?.body) {
    if (!ts.isBlock(fn.body)) stopsAlways = isStopCall(fn.body) || (ts.isBinaryExpression(strip(fn.body)) && /stopPropagation\(\)/.test(fn.body.getText()))
    else stopsAlways = fn.body.statements.some((st) => ts.isExpressionStatement(st) && isStopCall(st.expression) && !fn.body.statements.slice(0, fn.body.statements.indexOf(st)).some((p) => ts.isReturnStatement(p) || ts.isIfStatement(p)))
  }
  return { text, stopsAlways, targetCheck: TARGET_CHECK.test(text), onlyStops: /^\(?\s*\w*\s*\)?\s*=>\s*\{?\s*\w+\.stopPropagation\(\)\s*;?\s*\}?$/.test(se.getText().trim()), inert: isInert(se) }
}
function handlersOf(el) {
  const out = {}
  for (const [name, ev] of Object.entries(EVENT_OF)) {
    const info = handlerInfo(attr(el, name))
    if (info) out[ev] = { ...info, attrName: name }
  }
  return out
}

// ---- Components
function componentFn(decl, depth = 0) {
  if (!decl || depth > 5) return null
  if (ts.isFunctionDeclaration(decl) || isFn(decl)) return decl
  if (ts.isVariableDeclaration(decl) && decl.initializer) return componentFnFromExpr(decl.initializer, depth + 1)
  if (ts.isExportAssignment(decl)) return componentFnFromExpr(decl.expression, depth + 1)
  return null
}
function componentFnFromExpr(e, depth) {
  e = strip(e)
  if (isFn(e)) return e
  if (ts.isIdentifier(e)) return componentFn(resolveDecl(e), depth + 1)
  if (!ts.isCallExpression(e) || !e.arguments[0]) return null
  const callee = e.expression.getText()
  if (/(^|\.)(memo|forwardRef)$/.test(callee)) return componentFnFromExpr(e.arguments[0], depth + 1)
  if (!/(^|\.)lazy$/.test(callee)) return null
  // lazy(() => import('./X')) or lazy(() => import('./X').then((m) => ({ default: m.Y })))
  const t = e.arguments[0].getText()
  const spec = t.match(/import\(\s*['"]([^'"]+)['"]\s*\)/)?.[1]
  if (!spec) return null
  const res = ts.resolveModuleName(spec, e.getSourceFile().fileName, program.getCompilerOptions(), ts.sys)
  const target = res.resolvedModule && program.getSourceFile(res.resolvedModule.resolvedFileName)
  const modSym = target && checker.getSymbolAtLocation(target)
  if (!modSym) return null
  let exp = checker.getExportsOfModule(modSym).find((s) => s.escapedName === (t.match(/default:\s*\w+\.(\w+)/)?.[1] ?? 'default'))
  if (!exp) return null
  if (exp.flags & ts.SymbolFlags.Alias) exp = checker.getAliasedSymbol(exp)
  return componentFn(exp.declarations?.[0], depth + 1)
}
/** A component's own prop names, from a destructured first parameter. */
function propNames(fn) {
  const p = fn?.parameters?.[0]
  const names = new Map()
  if (p && ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isIdentifier(el.name)) names.set(el.name.text, (el.propertyName ?? el.name).getText())
  return { names, propsName: p && ts.isIdentifier(p.name) ? p.name.text : null }
}

// ---- The walk
/**
 * Walks what `start` renders (inside `fn`, whose locals it resolves) and reports, through `hit`,
 * each thing a click of `ev` can reach outside an element that stops it:
 *   'window'  an inline fixed layer, or a component that renders one, letting the click through
 *   'prop'    one of `fn`'s own props rendered there (the caller decides what it holds)
 */
function walk(start, ev, fn, hit, seen = new Set(), depth = 0) {
  if (!start || depth > 40) return
  const e = ts.isJsxElement(start) || ts.isJsxSelfClosingElement(start) || ts.isJsxFragment(start) || ts.isJsxExpression(start) || ts.isJsxText(start) ? start : strip(start)
  if (!e || seen.has(e)) return
  seen.add(e)
  const next = (x) => walk(x, ev, fn, hit, seen, depth + 1)
  const bodyOf = (f) => returnsOf(f).forEach(next)

  if (ts.isJsxText(e)) return
  if (ts.isJsxExpression(e)) return next(e.expression)
  if (ts.isJsxFragment(e)) return e.children.forEach(next)
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e)) {
    if (isIntrinsic(e)) {
      const hs = handlersOf(e)
      if (hs[ev]?.stopsAlways) return
      if (isFixedLayer(e)) {
        // A self-closing layer with no handler is part of the window around it (a dim, a ring).
        if (ts.isJsxSelfClosingElement(e) && Object.keys(hs).length === 0) return
        return hit('window', e, hs[ev] ? `${hs[ev].attrName}${hs[ev].targetCheck ? ' (target check)' : ''}: ${short(hs[ev].text, 70)}` : `no ${ev} handler`)
      }
      if (ts.isJsxElement(e)) e.children.forEach(next)
      return
    }
    const tn = tagName(e)
    const decl = resolveDecl(tn)
    const cfn = inProject(decl) ? componentFn(decl) : null
    if (!cfn) {
      if (WINDOW_NAME.test(tn.getText())) hit('window', e, `<${tn.getText()}> (not resolved)`)
      if (ts.isJsxElement(e)) e.children.forEach(next)
      return
    }
    const sum = summary(cfn, ev)
    for (const leak of sum.leaks) hit('window', e, `<${tn.getText()}> → ${leak}`)
    // The caller's JSX in the props this component renders outside its own stopper.
    if (sum.openProps.has('children') && ts.isJsxElement(e)) e.children.forEach(next)
    for (const a of opening(e).attributes.properties) {
      if (!ts.isJsxAttribute(a) || !sum.openProps.has(a.name.getText())) continue
      const x = strip(attrExpr(a))
      if (isFn(x)) bodyOf(x)
      else next(x)
    }
    return
  }
  if (ts.isConditionalExpression(e)) return [e.whenTrue, e.whenFalse].forEach(next)
  if (ts.isBinaryExpression(e)) {
    if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) [e.left, e.right].forEach(next)
    return
  }
  if (ts.isArrayLiteralExpression(e)) return e.elements.forEach(next)
  if (ts.isCallExpression(e)) {
    const callee = strip(e.expression)
    if (/(^|\.)createPortal$/.test(callee.getText())) return next(e.arguments[0])
    if (ts.isPropertyAccessExpression(callee) && ['map', 'flatMap'].includes(callee.name.text)) {
      const cb = strip(e.arguments[0])
      return isFn(cb) ? bodyOf(cb) : undefined
    }
    if (isFn(callee)) return bodyOf(callee) // {(() => { … return <X /> })()}
    const helper = fnOfDecl(resolveDecl(callee))
    if (helper) bodyOf(helper) // {renderSomething()}
    return
  }
  if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
    const { names, propsName } = propNames(fn)
    if (ts.isPropertyAccessExpression(e) && propsName && e.expression.getText() === propsName) return hit('prop', e, e.name.text)
    const d = resolveDecl(e)
    if (!d) return
    if (ts.isBindingElement(d) && d.parent?.parent === fn?.parameters?.[0]) return hit('prop', e, names.get(e.getText()) ?? e.getText())
    if (!ts.isVariableDeclaration(d) || !d.initializer || !inProject(d)) return
    const init = strip(d.initializer)
    if (ts.isCallExpression(init) && /useMemo$/.test(init.expression.getText())) {
      const f = strip(init.arguments[0])
      return isFn(f) ? bodyOf(f) : undefined
    }
    next(init)
    // A local reassigned later in the component (`let dialog = null; if (…) dialog = <X />`).
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && n.left.text === e.getText()) next(n.right)
      ts.forEachChild(n, visit)
    }
    if (fn) visit(fn)
  }
}

const summaries = new Map()
/** For a component and an event: the windows it renders that let the click out of its root, and the props it renders there. */
function summary(fn, ev) {
  const key = `${fn.getSourceFile().fileName}:${fn.pos}:${ev}`
  if (!summaries.has(key)) {
    const res = { leaks: [], openProps: new Set() }
    summaries.set(key, res) // a component that renders itself stops here
    for (const r of returnsOf(fn)) walk(r, ev, fn, (kind, node, what) => (kind === 'prop' ? res.openProps.add(what) : res.leaks.push(`${where(node)} ${what}`)))
  }
  return summaries.get(key)
}

// ---- Outer backdrops (and, with --rows, clickable containers)
function outermostFn(n) {
  let best = null
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionDeclaration(p) || isFn(p) || ts.isMethodDeclaration(p)) best = p
  return best
}
const found = { backdrop: [], row: [] }
let backdrops = 0
for (const f of files) {
  if (!f.endsWith('.tsx')) continue
  const sf = program.getSourceFile(path.join(ROOT, f))
  const visit = (n) => {
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && isIntrinsic(n)) {
      for (const [ev, h] of Object.entries(handlersOf(n))) {
        const fixed = isFixedLayer(n)
        // A backdrop is a fixed layer that closes; a row is any other element whose handler does more than stop the event.
        if (fixed ? h.onlyStops || (h.stopsAlways && !CLOSES.test(h.text)) : !ROWS || h.inert) continue
        if (fixed) backdrops += 1
        if (h.targetCheck || !ts.isJsxElement(n)) continue
        const fn = outermostFn(n)
        const hits = []
        for (const c of n.children) walk(c, ev, fn, (kind, node, what) => hits.push(kind === 'prop' ? `${where(node)} renders its prop ${what} here` : `${where(node)} ${what}`))
        // A row's own props are its caller's business; a backdrop's props are reported.
        const shown = fixed ? hits : hits.filter((x) => !x.includes(' renders its prop '))
        if (shown.length) found[fixed ? 'backdrop' : 'row'].push({ at: where(n), handler: `${h.attrName}={${short(h.text, 80)}}`, hits: shown })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

const print = (list) => {
  for (const o of list) {
    console.log(`\n${o.at}  ${o.handler}`)
    for (const h of o.hits) console.log(`   ${h}`)
  }
}
console.log(`check-nested-windows: ${backdrops} backdrops; ${found.backdrop.length} hold a window that lets a click through to them.`)
print(found.backdrop)
if (found.backdrop.length) console.log('\nFix: the inner backdrop calls e.stopPropagation() before it closes (or the outer closes only when e.target === e.currentTarget). See docs/AI_CONTEXT.md → Windows (modals).')
if (ROWS) {
  console.log(`\n--rows: ${found.row.length} clickable containers hold a window that lets a click through to them.`)
  print(found.row)
}
process.exit(found.backdrop.length ? 1 : 0)
