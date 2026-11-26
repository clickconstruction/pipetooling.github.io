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
 * CI runs it (ci.yml and deploy.yml, v2.4360). It reads every return of a component, so a window a
 * component draws only in another mode (an early return on a prop) still counts. When a finding is
 * meant — the window behind should close too — say so in a comment on the line above the outer
 * backdrop or the inner window, or inside its opening tag: `nested-windows: allow — <why>`.
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
import { parsedFileCache } from './lib/parsedFileCache.mjs'

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
  const raw = readFileSync(path.join(ROOT, f), 'utf8')
  if (!/position\s*:\s*fixed/.test(raw)) continue
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}`'"]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) {
    if (!/position\s*:\s*fixed/.test(m[2])) continue
    for (const part of m[1].split(',')) {
      const last = part.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? ''
      for (const c of last.match(/\.[A-Za-z][A-Za-z0-9_-]+/g) ?? []) FIXED_CLASSES.add(c.slice(1))
    }
  }
}

// ---- The source, one file at a time
// Each file is parsed alone and a name is followed by reading: its scope, its import, the file the
// import names. A whole ts.Program with its type checker held every file of src at once and grew
// with the app (3.1 GB of heap by v2.8671, past Node's default). Here the heap holds the files one
// walk reaches and a few megabytes of the ones read last (scripts/lib/parsedFileCache.mjs).
const files = sourceFiles.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('src/test/'))
const cfg = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
const options = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT).options
const moduleCache = ts.createModuleResolutionCache(ROOT, (x) => x, options)
const SRC = path.join(ROOT, 'src')

/** Parsed files, a bounded number of them: a file let go is parsed again when a later walk reads it. */
const parsed = parsedFileCache()
function parse(abs) {
  return parsed.read(abs, () => {
    let text = null
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      // a file that is not there reads as a name nothing declares
    }
    return { value: text === null ? null : ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true), chars: text?.length ?? 0 }
  })
}
/** The project file a module specifier names, or null: a package, a stylesheet, an asset. */
function moduleFile(spec, from) {
  const r = ts.resolveModuleName(spec, from, options, ts.sys, moduleCache).resolvedModule
  return r && !r.isExternalLibraryImport && /\.[cm]?[jt]sx?$/.test(r.resolvedFileName) ? parse(r.resolvedFileName) : null
}

const where = (n) => `${path.relative(ROOT, n.getSourceFile().fileName)}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}`
const short = (s, n = 100) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
function strip(e) {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e))) e = e.expression
  return e
}

// ---- Names: what a scope declares, what a file exports, what an identifier or `a.b` stands for
/** Every name a pattern binds, each with its declaration: the variable or parameter, or the binding element. */
function bindingNames(name, decl, add) {
  if (ts.isIdentifier(name)) return add(name.text, decl)
  for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, el, add)
}
const localsMemo = new WeakMap()
/** name → its declarations in this scope, in the order the compiler binds them (functions first, then as written). */
function localsOf(scope) {
  let m = localsMemo.get(scope)
  if (m) return m
  m = new Map()
  localsMemo.set(scope, m)
  const add = (name, decl) => (m.has(name) ? m.get(name).push(decl) : m.set(name, [decl]))
  const vars = (list) => list.declarations.forEach((d) => bindingNames(d.name, d, add))
  const statements = (sts) => {
    for (const st of sts) if (ts.isFunctionDeclaration(st) && st.name) add(st.name.text, st)
    for (const st of sts) {
      if (ts.isVariableStatement(st)) vars(st.declarationList)
      else if ((ts.isClassDeclaration(st) || ts.isEnumDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isModuleDeclaration(st)) && st.name && ts.isIdentifier(st.name)) add(st.name.text, st)
      else if (ts.isImportEqualsDeclaration(st)) add(st.name.text, st)
      else if (ts.isImportDeclaration(st) && st.importClause) {
        const { name, namedBindings } = st.importClause
        if (name) add(name.text, st.importClause)
        if (namedBindings && ts.isNamespaceImport(namedBindings)) add(namedBindings.name.text, namedBindings)
        else if (namedBindings) for (const el of namedBindings.elements) add(el.name.text, el)
      }
    }
  }
  if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)) statements(scope.statements)
  else if (ts.isCaseBlock(scope)) statements(scope.clauses.flatMap((c) => [...c.statements]))
  else if (ts.isCatchClause(scope)) {
    if (scope.variableDeclaration) bindingNames(scope.variableDeclaration.name, scope.variableDeclaration, add)
  }
  else if (ts.isFunctionLike(scope)) {
    for (const p of scope.parameters) bindingNames(p.name, p, add)
    if (scope.body && ts.isBlock(scope.body)) statements(scope.body.statements)
  } else if (scope.initializer && ts.isVariableDeclarationList(scope.initializer)) vars(scope.initializer)
  return m
}
// A function's body shares the function's scope, so its block is not one of its own.
const isScope = (n) => ts.isSourceFile(n) || ts.isModuleBlock(n) || ts.isCaseBlock(n) || ts.isCatchClause(n) || ts.isFunctionLike(n) || ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || (ts.isBlock(n) && !ts.isFunctionLike(n.parent))
const isTypeOnly = (d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)
/** The first declaration of the nearest value an identifier names; a type of the same name in a nearer scope is passed over. */
function lookup(id) {
  for (let scope = id.parent; scope; scope = scope.parent) {
    if (!isScope(scope)) continue
    const decls = localsOf(scope).get(id.text)
    if (decls && !decls.every(isTypeOnly)) return decls[0]
    if (ts.isFunctionExpression(scope) && scope.name?.text === id.text) return scope
  }
  return null
}
const exportsMemo = new WeakMap()
/** What a file exports: each name with where it comes from, and the files it re-exports whole. */
function exportsOf(sf) {
  let t = exportsMemo.get(sf)
  if (t) return t
  t = { named: new Map(), stars: [] }
  exportsMemo.set(sf, t)
  for (const st of sf.statements) {
    const from = ts.isExportDeclaration(st) && st.moduleSpecifier ? st.moduleSpecifier.text : null
    if (ts.isExportDeclaration(st)) {
      if (!st.exportClause) t.stars.push(from)
      else if (ts.isNamespaceExport(st.exportClause)) t.named.set(st.exportClause.name.text, { from })
      else for (const el of st.exportClause.elements) t.named.set(el.name.text, from ? { from, name: (el.propertyName ?? el.name).text } : { local: (el.propertyName ?? el.name).text })
    } else if (ts.isExportAssignment(st)) {
      if (!st.isExportEquals) t.named.set('default', ts.isIdentifier(st.expression) ? { local: st.expression.text } : { decl: st })
    } else if (ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefault = ts.getModifiers(st).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      const add = (name) => t.named.set(isDefault ? 'default' : name, { local: name })
      if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => bindingNames(d.name, d, add))
      else if (st.name && ts.isIdentifier(st.name)) add(st.name.text)
      else if (isDefault) t.named.set('default', { decl: st })
    }
  }
  return t
}
/** The declaration a file exports under a name, followed through re-exports to where it is written. */
function exported(sf, name, depth = 0) {
  if (depth > 20) return null
  const t = exportsOf(sf)
  const e = t.named.get(name)
  if (e?.decl) return e.decl
  if (e?.local) return target(localsOf(sf).get(e.local)?.[0] ?? null, depth + 1)
  if (e) {
    const m = moduleFile(e.from, sf.fileName)
    return m && e.name !== undefined ? exported(m, e.name, depth + 1) : m
  }
  if (name === 'default') return null
  for (const spec of t.stars) {
    const m = moduleFile(spec, sf.fileName)
    const d = m && exported(m, name, depth + 1)
    if (d) return d
  }
  return null
}
/** An import followed to the declaration it brings in (a whole-file import is its SourceFile); any other declaration is itself. */
function target(decl, depth = 0) {
  if (!decl) return null
  const from = (importDecl) => moduleFile(importDecl.moduleSpecifier.text, decl.getSourceFile().fileName)
  if (ts.isImportSpecifier(decl)) {
    const m = from(decl.parent.parent.parent)
    return m && exported(m, (decl.propertyName ?? decl.name).text, depth + 1)
  }
  if (ts.isImportClause(decl)) {
    const m = from(decl.parent)
    return m && exported(m, 'default', depth + 1)
  }
  if (ts.isNamespaceImport(decl)) return from(decl.parent.parent)
  return ts.isImportEqualsDeclaration(decl) ? null : decl
}
/**
 * What `a` in `a.b` holds, when it can be read: a file (an `import * as`) or an object literal,
 * through a const with no type written on it, `as const`, `satisfies`, a property of another such
 * object, a `?:` whose arms are such objects or null, and what `useMemo` or a function with no return
 * type written on it returns. A value whose members come from a type (a prop, a hook's result, a typed const) is
 * null: the compiler answered those with a line of a type, which nothing here acts on.
 */
function shapeOf(expr, depth = 0) {
  let e = expr
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || (ts.isAsExpression(e) && ts.isConstTypeReference(e.type))) e = e.expression
  if (ts.isObjectLiteralExpression(e)) return e
  if (depth > 10) return null
  // `a ? b : c` reads as its first arm when both arms can be read, or as the arm that is not null.
  // With one arm a typed value the compiler picks by its own order, so that reads as nothing.
  if (ts.isConditionalExpression(e)) {
    const isNull = (x) => x.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(x) && x.text === 'undefined')
    if (isNull(strip(e.whenTrue))) return shapeOf(e.whenFalse, depth + 1)
    const first = shapeOf(e.whenTrue, depth + 1)
    return first && (isNull(strip(e.whenFalse)) || shapeOf(e.whenFalse, depth + 1)) ? first : null
  }
  if (ts.isCallExpression(e)) {
    // useMemo(() => …) holds what its function returns; so does a function called in place or by name.
    const callee = strip(e.expression)
    let fn = /(^|\.)useMemo$/.test(callee.getText()) ? strip(e.arguments[0]) : isFn(callee) ? callee : ts.isIdentifier(callee) ? resolveDecl(callee, depth + 1) : null
    if (fn && ts.isVariableDeclaration(fn) && !fn.type && fn.initializer) fn = strip(fn.initializer)
    if (!fn || !(ts.isFunctionDeclaration(fn) || isFn(fn)) || fn.type || fn.asteriskToken || fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return null
    for (const r of returnsOf(fn)) {
      const s = shapeOf(r, depth + 1)
      if (s) return s
    }
    return null
  }
  if (!(ts.isIdentifier(e) || ts.isPropertyAccessExpression(e))) return null
  const d = resolveDecl(e, depth + 1)
  if (!d) return null
  if (ts.isSourceFile(d)) return d
  if (ts.isVariableDeclaration(d)) return !d.type && d.initializer ? shapeOf(d.initializer, depth + 1) : null
  if (ts.isPropertyAssignment(d)) return shapeOf(d.initializer, depth + 1)
  return ts.isShorthandPropertyAssignment(d) ? shapeOf(d.name, depth + 1) : null
}
/** The property of an object literal by name: the last one written, or the one a spread before it brings. */
function propertyOf(obj, name, depth) {
  for (let i = obj.properties.length - 1; i >= 0; i--) {
    const p = obj.properties[i]
    if (ts.isSpreadAssignment(p)) {
      const s = shapeOf(p.expression, depth + 1)
      if (!s || ts.isSourceFile(s)) return null
      const d = propertyOf(s, name, depth + 1)
      if (d) return d
    } else if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) || ts.isNumericLiteral(p.name)) && p.name.text === name) return p
  }
  return null
}
/** The declaration an identifier or an `a.b` stands for, or null when reading the source does not say. */
function resolveDecl(node, depth = 0) {
  if (ts.isIdentifier(node)) return target(lookup(node))
  if (!ts.isPropertyAccessExpression(node)) return null
  const s = shapeOf(node.expression, depth)
  if (!s) return null
  return ts.isSourceFile(s) ? exported(s, node.name.text) : propertyOf(s, node.name.text, depth)
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
    // By place, not by node: the file may be let go and parsed again before the next read.
    const key = `${d.getSourceFile().fileName}:${d.pos}`
    if (!styleMemo.has(key)) {
      styleMemo.set(key, false)
      let r = (ts.isVariableDeclaration(d) || ts.isPropertyAssignment(d)) && d.initializer ? isFixedStyle(d.initializer, depth + 1) : false
      if (!r && ts.isElementAccessExpression(e)) r = /position\s*:\s*['"`]fixed/.test(d.getText())
      styleMemo.set(key, r)
    }
    return styleMemo.get(key)
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
  const mod = moduleFile(spec, e.getSourceFile().fileName)
  const exp = mod && exported(mod, t.match(/default:\s*\w+\.(\w+)/)?.[1] ?? 'default')
  return exp ? componentFn(exp, depth + 1) : null
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
/** A `nested-windows: allow — <why>` comment up to two lines above the element or inside its opening tag. */
function allowed(node) {
  const sf = node.getSourceFile()
  const line = sf.getLineAndCharacterOfPosition(node.getStart()).line
  const end = ts.isJsxElement(node) ? node.openingElement.getEnd() : node.getEnd()
  return /nested-windows:[ \t]*allow\b[ \t—–:-]*\w/.test(sf.text.slice(sf.getPositionOfLineAndCharacter(Math.max(0, line - 2), 0), end))
}

const found = { backdrop: [], row: [] }
const allowedHits = []
let backdrops = 0
for (const f of files) {
  if (!f.endsWith('.tsx')) continue
  // Only here, between two files: a walk compares nodes, so the files it reads stay whole until it ends.
  parsed.letGo()
  const sf = parse(path.join(ROOT, f))
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
        const outerAllowed = allowed(n)
        for (const c of n.children) walk(c, ev, fn, (kind, node, what) => (outerAllowed || allowed(node) ? allowedHits.push(`${where(n)} ← ${where(node)}`) : hits.push(kind === 'prop' ? `${where(node)} renders its prop ${what} here` : `${where(node)} ${what}`)))
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
if (found.backdrop.length) {
  console.log('\nFix: the inner backdrop calls e.stopPropagation() before it closes (or the outer closes only when e.target === e.currentTarget). See docs/AI_CONTEXT.md → Windows (modals).')
  console.log('If the window behind should close too, say so: a `nested-windows: allow — <why>` comment on the line above the inner window.')
}
if (allowedHits.length) console.log(`\n${allowedHits.length} allowed by a nested-windows: allow note: ${allowedHits.join(', ')}`)
// In GitHub Actions each finding also lands on the PR's diff as an error annotation.
if (process.env.GITHUB_ACTIONS === 'true') {
  const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  for (const o of found.backdrop) {
    for (const h of o.hits) {
      const [, file, line] = /^(\S+?):(\d+) /.exec(h) ?? []
      if (file) console.log(`::error file=${file},line=${line},title=Window inside a window::${esc(`A click on this window's backdrop also reaches the backdrop at ${o.at} and closes that window too. Stop the click in this window's backdrop (e.stopPropagation()) before it closes. ${h}`)}`)
    }
  }
}
if (ROWS) {
  console.log(`\n--rows: ${found.row.length} clickable containers hold a window that lets a click through to them.`)
  print(found.row)
}
process.exit(found.backdrop.length ? 1 : 0)
