#!/usr/bin/env node
/**
 * map-surface — the facts half of a Step-0 architecture map (docs/PAGE_DECOMPOSITION_PLAYBOOK.md).
 *
 * Reads a source file with the TypeScript compiler (no type checker, no network) and prints a
 * fact sheet: every top-level declaration, and for each component its state / effects / memos /
 * refs / handlers / render branches with line ranges, which state each one reads and writes, the
 * tables / RPCs / edge functions it touches, the child components it renders, what it imports and
 * what imports it. The hand-written map (docs/*_ARCHITECTURE.md) keeps the judgment — seams,
 * ownership, order, risk; this sheet keeps the facts, so an agent reads ~5k tokens instead of the
 * whole file and opens only the line ranges that decide a question.
 *
 * Fact sheets are generated on demand and never committed (they would conflict on every edit).
 *
 *   npm run map -- <file> [<file> …]      fact sheet(s), markdown, to stdout
 *   npm run map -- --json <file>          the same facts as JSON
 *   npm run map -- --out <dir> <file> …   one <basename>.facts.md per file into <dir>
 *   npm run map -- --routes               the router: path → component → file → lines
 *   npm run map -- --triage [--min 1500]  every source file over --min lines, its map, and how stale the map is
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SOURCE_DIRS = ['src', 'supabase/functions']
const SKIP_FILE = /(\.test\.|\.spec\.|\.d\.ts$|\/types\/database\.ts$|\/dev-mcp\/catalog\.ts$|\/twin-mcp\/briefs\.ts$|\/content\/releaseNotes)/
const BRANCH_MIN_LINES = 12

// ─── helpers ────────────────────────────────────────────────────────────────

const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/')
const git = (...args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}
const clip = (s, n) => {
  const one = String(s).replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}
const cell = (s) => String(s).replace(/\|/g, '\\|')
const list = (xs, n = 8) => {
  const u = [...new Set(xs)]
  if (!u.length) return '—'
  return u.length > n ? u.slice(0, n).join(', ') + ` +${u.length - n}` : u.join(', ')
}

function walkFiles(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walkFiles(p, out)
    else if (/\.(tsx?|mjs|js)$/.test(ent.name)) out.push(p.split(path.sep).join('/'))
  }
  return out
}

const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

// ─── importers (regex over the whole tree — fast, no parse) ───────────────────

const IMPORT_RE = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm

const isFile = (c) => fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()

function resolveSpec(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join('src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.join(path.dirname(fromFile), spec)
  else return null
  base = base.split(path.sep).join('/')
  const stripped = base.replace(/\.(tsx?|jsx?|mjs)$/, '')
  for (const c of [base, stripped + '.ts', stripped + '.tsx', stripped + '/index.ts', stripped + '/index.tsx', stripped + '.mjs', stripped + '.js']) {
    if (isFile(c)) return c
  }
  return null
}

/** Files that import `file` — git grep narrows to files naming its basename, then each import is resolved. */
function importersOf(file) {
  const stem = path.basename(file).replace(/\.[^.]+$/, '')
  const needle = stem === 'index' ? path.basename(path.dirname(file)) : stem
  const hits = git('grep', '-l', '-F', needle, '--', ...SOURCE_DIRS).split('\n').filter(Boolean)
  const out = new Set()
  for (const f of hits) {
    if (f === file) continue
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
    for (const m of text.matchAll(IMPORT_RE)) if (resolveSpec(f, m[1] || m[2] || m[3]) === file) { out.add(f); break }
  }
  return [...out].sort()
}

// ─── the parse ───────────────────────────────────────────────────────────────

function parse(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  return { text, sf }
}

const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1
const rangeOf = (sf, node) => [lineOf(sf, node.getStart(sf)), lineOf(sf, node.getEnd())]

function calleeName(call) {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text // React.useState → useState
  return ''
}

/** Unwrap memo(...) / forwardRef(...) / React.memo(...) around a function. */
function unwrapFn(init) {
  let n = init
  for (let i = 0; i < 3 && n; i++) {
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return n
    if (ts.isCallExpression(n) && n.arguments.length) n = n.arguments[0]
    else if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n)) n = n.expression
    else return null
  }
  return null
}

const isPascal = (s) => /^[A-Z]/.test(s)
const containsJsx = (node) => {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) { found = true; return }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** `x.pile`, `{ pile: 1 }`, `<X pile=… />`, `{ pile: p } = …` — a name that is not a reference to a variable. */
function isPropertyName(n) {
  const p = n.parent
  if (!p) return false
  if (ts.isPropertyAccessExpression(p) && p.name === n) return true
  if (ts.isQualifiedName(p) && p.right === n) return true
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === n) return true
  if (ts.isJsxAttribute(p) && p.name === n) return true
  if (ts.isBindingElement(p) && p.propertyName === n) return true
  if (ts.isEnumMember(p) && p.name === n) return true
  return false
}

/** Everything the walk collects inside one node: identifiers referenced, calls made, data access, JSX tags. */
function scan(sf, node) {
  const idents = new Set()
  const calls = new Set()
  const db = []
  const tags = new Map()
  const visit = (n) => {
    if (ts.isIdentifier(n) && !isPropertyName(n)) idents.add(n.text)
    if (ts.isCallExpression(n)) {
      const name = calleeName(n)
      if (name) calls.add(name)
      const arg0 = n.arguments[0]
      const lit = arg0 && (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) ? arg0.text : null
      if (lit && ts.isPropertyAccessExpression(n.expression)) {
        const prop = n.expression.name.text
        const objText = n.expression.expression.getText(sf)
        if (prop === 'from' && !/^(Array|Object|Buffer|Uint8Array)$/.test(objText)) {
          db.push({ kind: /\.storage$/.test(objText) ? 'bucket' : 'table', name: lit, line: lineOf(sf, n.getStart(sf)) })
        } else if (prop === 'rpc') {
          db.push({ kind: 'rpc', name: lit, line: lineOf(sf, n.getStart(sf)) })
        } else if (prop === 'invoke' && /functions$/.test(objText)) {
          db.push({ kind: 'fn', name: lit, line: lineOf(sf, n.getStart(sf)) })
        }
      }
      // invokeEdgeFunction('name', …) style wrappers
      if (lit && ts.isIdentifier(n.expression) && /^invoke\w*(Function|Edge)\w*$/i.test(n.expression.text)) {
        db.push({ kind: 'fn', name: lit, line: lineOf(sf, n.getStart(sf)) })
      }
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const t = n.tagName.getText(sf)
      if (isPascal(t) || t.includes('.')) tags.set(t, (tags.get(t) || 0) + 1)
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return { idents, calls, db, tags }
}

/** Collect the component body's hook calls, handlers and render. */
function analyzeComponent(sf, name, fnNode, declNode) {
  const [start, end] = rangeOf(sf, declNode)
  const comp = { node: fnNode, name, start, end, lines: end - start + 1, props: null, state: [], reducers: [], refs: [], memos: [], callbacks: [], effects: [], customHooks: [], context: [], handlers: [], locals: [], render: null, branches: [], earlyReturns: [] }
  const p0 = fnNode.parameters[0]
  if (p0) comp.props = clip(p0.type ? p0.type.getText(sf) : p0.name.getText(sf), 80)
  const body = fnNode.body
  if (!body || !ts.isBlock(body)) {
    comp.render = { start, end, lines: comp.lines }
    return comp
  }
  for (const st of body.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const [s, e] = rangeOf(sf, st)
        const init = d.initializer
        const bindName = d.name.getText(sf)
        if (init && ts.isCallExpression(init)) {
          const hook = calleeName(init)
          if (hook === 'useState') {
            const els = ts.isArrayBindingPattern(d.name) ? d.name.elements.map((x) => (ts.isBindingElement(x) ? x.name.getText(sf) : '')) : [bindName, '']
            comp.state.push({ span: [st.getStart(sf), st.getEnd()], line: s, name: els[0], setter: els[1] || '', init: clip(init.arguments[0]?.getText(sf) ?? '', 36), type: init.typeArguments ? clip(init.typeArguments[0].getText(sf), 36) : '' })
            continue
          }
          if (hook === 'useReducer') { comp.reducers.push({ line: s, name: bindName }); continue }
          if (hook === 'useRef') { comp.refs.push({ line: s, name: bindName, init: clip(init.arguments[0]?.getText(sf) ?? '', 30) }); continue }
          if (hook === 'useContext') { comp.context.push({ line: s, name: bindName, ctx: clip(init.arguments[0]?.getText(sf) ?? '', 30) }); continue }
          if (hook === 'useMemo' || hook === 'useCallback') {
            const deps = init.arguments[1]
            ;(hook === 'useMemo' ? comp.memos : comp.callbacks).push({ start: s, end: e, name: bindName, deps: deps ? clip(deps.getText(sf), 90) : '(none)', node: init })
            continue
          }
          if (/^use[A-Z]/.test(hook)) { comp.customHooks.push({ line: s, name: bindName, hook, node: init }); continue }
        }
        const fn = init && unwrapFn(init)
        if (fn && !(init && ts.isCallExpression(init) && /^use[A-Z]/.test(calleeName(init)))) {
          comp.handlers.push({ start: s, end: e, name: bindName, async: !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword), node: fn })
          continue
        }
        comp.locals.push({ start: s, end: e, name: clip(bindName, 40), node: st })
      }
      continue
    }
    if (ts.isFunctionDeclaration(st) && st.name) {
      const [s, e] = rangeOf(sf, st)
      comp.handlers.push({ start: s, end: e, name: st.name.text, async: !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword), node: st })
      continue
    }
    if (ts.isExpressionStatement(st) && ts.isCallExpression(st.expression)) {
      const hook = calleeName(st.expression)
      if (hook === 'useEffect' || hook === 'useLayoutEffect' || hook === 'useImperativeHandle') {
        const [s, e] = rangeOf(sf, st)
        const deps = st.expression.arguments[hook === 'useImperativeHandle' ? 2 : 1]
        comp.effects.push({ start: s, end: e, hook, deps: deps ? clip(deps.getText(sf), 90) : '(every render)', node: st })
        continue
      }
      if (/^use[A-Z]/.test(hook)) { comp.customHooks.push({ line: lineOf(sf, st.getStart(sf)), name: '(no binding)', hook, node: st.expression }); continue }
    }
    if (ts.isReturnStatement(st)) {
      const [s, e] = rangeOf(sf, st)
      if (st.expression && containsJsx(st.expression)) {
        if (comp.render) comp.earlyReturns.push({ start: comp.render.start, end: comp.render.end })
        comp.render = { start: s, end: e, lines: e - s + 1, node: st }
      }
      continue
    }
    if (ts.isIfStatement(st) && containsJsx(st)) {
      const [s, e] = rangeOf(sf, st)
      comp.earlyReturns.push({ start: s, end: e, cond: clip(st.expression.getText(sf), 60), node: st, branches: e - s >= 40 ? findBranches(sf, st.thenStatement) : [] })
    }
  }
  if (comp.render?.node) comp.branches = findBranches(sf, comp.render.node)
  for (const l of comp.locals) {
    l.jsx = containsJsx(l.node)
    if (l.jsx && l.end - l.start >= 40) l.branches = findBranches(sf, l.node)
  }
  return comp
}

/** Conditional JSX blocks worth naming: `cond && (<…>)`, `cond ? <…> : <…>` over BRANCH_MIN_LINES lines. Outermost only, then one level in. */
function findBranches(sf, root, depth = 0) {
  const out = []
  const visit = (n) => {
    let cond = null
    let blocks = []
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && containsJsx(n.right)) {
      cond = n.left
      blocks = [n.right]
    } else if (ts.isConditionalExpression(n) && (containsJsx(n.whenTrue) || containsJsx(n.whenFalse))) {
      cond = n.condition
      blocks = [n.whenTrue, n.whenFalse]
    }
    if (cond) {
      const [s, e] = rangeOf(sf, n)
      if (e - s + 1 >= BRANCH_MIN_LINES) {
        out.push({ start: s, end: e, lines: e - s + 1, cond: clip(cond.getText(sf), 70), depth, node: n, children: depth < 1 ? blocks.flatMap((b) => findBranches(sf, b, depth + 1)) : [] })
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(root, visit)
  return out
}

function analyzeFile(file) {
  const { text, sf } = parse(file)
  const facts = { file, lines: lineCount(text), sha: git('rev-parse', '--short', 'HEAD'), lastCommit: git('log', '-1', '--format=%cs %h', '--', file), commits90: Number(git('rev-list', '--count', '--since=90.days', 'HEAD', '--', file) || 0), imports: [], declarations: [], components: [], importers: importersOf(file) }

  for (const st of sf.statements) {
    const [s, e] = rangeOf(sf, st)
    const exported = !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    const isDefault = !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    if (ts.isImportDeclaration(st)) {
      const spec = st.moduleSpecifier.text
      const names = []
      const c = st.importClause
      if (c?.name) names.push(c.name.text)
      if (c?.namedBindings) {
        if (ts.isNamespaceImport(c.namedBindings)) names.push('* as ' + c.namedBindings.name.text)
        else names.push(...c.namedBindings.elements.map((x) => x.name.text))
      }
      facts.imports.push({ spec, names, local: spec.startsWith('.') || spec.startsWith('@/'), resolved: resolveSpec(file, spec) })
      continue
    }
    if (ts.isFunctionDeclaration(st) && st.name) {
      const name = st.name.text
      const d = { start: s, end: e, lines: e - s + 1, kind: 'function', name, exported: exported || isDefault }
      facts.declarations.push(d)
      if ((isPascal(name) || isDefault) && st.body && containsJsx(st.body)) facts.components.push(analyzeComponent(sf, name, st, st))
      else if (/^use[A-Z]/.test(name)) { d.kind = 'hook'; facts.components.push({ ...analyzeComponent(sf, name, st, st), isHook: true }) }
      continue
    }
    if (ts.isVariableStatement(st)) {
      for (const dcl of st.declarationList.declarations) {
        const name = dcl.name.getText(sf)
        const fn = dcl.initializer && unwrapFn(dcl.initializer)
        const d = { start: s, end: e, lines: e - s + 1, kind: fn ? 'function' : 'const', name: clip(name, 40), exported }
        facts.declarations.push(d)
        if (fn && isPascal(name) && containsJsx(fn)) facts.components.push(analyzeComponent(sf, name, fn, st))
        else if (fn && /^use[A-Z]/.test(name)) { d.kind = 'hook'; facts.components.push({ ...analyzeComponent(sf, name, fn, st), isHook: true }) }
      }
      continue
    }
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) {
      facts.declarations.push({ start: s, end: e, lines: e - s + 1, kind: ts.isInterfaceDeclaration(st) ? 'interface' : ts.isEnumDeclaration(st) ? 'enum' : 'type', name: st.name.text, exported })
      continue
    }
    if (ts.isClassDeclaration(st)) {
      facts.declarations.push({ start: s, end: e, lines: e - s + 1, kind: 'class', name: st.name?.text ?? '(anonymous)', exported })
      continue
    }
    if (ts.isExportAssignment(st)) {
      facts.declarations.push({ start: s, end: e, lines: e - s + 1, kind: 'export default', name: clip(st.expression.getText(sf), 40), exported: true })
    }
  }

  // Big plain functions (loaders, builders, an RPC switch) get an outline.
  facts.outlines = []
  for (const st of sf.statements) {
    const fns = []
    if (ts.isFunctionDeclaration(st) && st.name) fns.push([st.name.text, st])
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { const fn = d.initializer && unwrapFn(d.initializer); if (fn) fns.push([d.name.getText(sf), fn, st]) }
    for (const [name, fn, holder] of fns) {
      if (facts.components.some((c) => c.name === name)) continue
      const [s, e] = rangeOf(sf, holder ?? fn)
      if (e - s + 1 < 150) continue
      const r = scan(sf, fn)
      facts.outlines.push({ name, start: s, end: e, items: outlineFunction(sf, fn), db: r.db })
    }
  }

  // Cross-reference: who reads / writes each piece of state, per unit (effect, handler, memo, branch).
  for (const c of facts.components) {
    const stateNames = new Set(c.state.map((x) => x.name))
    const setters = new Map(c.state.filter((x) => x.setter).map((x) => [x.setter, x.name]))
    const refNames = new Set(c.refs.map((x) => x.name))
    const memoNames = new Set([...c.memos, ...c.callbacks].map((x) => x.name))
    const handlerNames = new Set(c.handlers.map((x) => x.name))
    const units = [
      ...c.effects.map((x, i) => ({ label: `effect@${x.start}`, x, idx: i })),
      ...c.handlers.map((x) => ({ label: x.name, x })),
      ...c.memos.map((x) => ({ label: x.name, x })),
      ...c.callbacks.map((x) => ({ label: x.name, x })),
      ...c.customHooks.filter((x) => x.node).map((x) => ({ label: `${x.hook}()`, x })),
      ...flattenBranches(c.branches).map((b) => ({ label: `branch@${b.start}`, x: b })),
      ...c.locals.map((l) => ({ label: l.name, x: l })),
      ...c.locals.flatMap((l) => flattenBranches(l.branches || [])).map((b) => ({ label: `branch@${b.start}`, x: b })),
      ...c.earlyReturns.filter((r) => r.node).map((r) => ({ label: `if@${r.start}`, x: r })),
      ...c.earlyReturns.flatMap((r) => flattenBranches(r.branches || [])).map((b) => ({ label: `branch@${b.start}`, x: b })),
    ]
    c.readBy = new Map([...stateNames].map((n) => [n, []]))
    c.writtenBy = new Map([...stateNames].map((n) => [n, []]))
    // A setter counts as a write wherever it is referenced — called, or handed down as a prop.
    for (const u of units) {
      const r = scan(sf, u.x.node)
      u.x.reads = [...r.idents].filter((i) => stateNames.has(i) && i !== u.x.name)
      u.x.writes = [...r.idents].filter((i) => setters.has(i)).map((i) => setters.get(i))
      u.x.refs = [...r.idents].filter((i) => refNames.has(i))
      u.x.usesMemos = [...r.idents].filter((i) => memoNames.has(i) && i !== u.x.name)
      u.x.callsHandlers = [...r.idents].filter((i) => handlerNames.has(i) && i !== u.x.name)
      u.x.db = r.db
      u.x.tags = r.tags
    }
    if (c.render?.node) {
      const r = scan(sf, c.render.node)
      c.render.tags = [...r.tags.entries()].sort((a, b) => b[1] - a[1])
      c.render.reads = [...r.idents].filter((i) => stateNames.has(i))
      c.render.writes = [...r.idents].filter((i) => setters.has(i)).map((i) => setters.get(i))
      c.render.db = r.db
    }
    // Read by / Written by: every reference, credited to the innermost unit that contains it
    // (render when only the return holds it, L<line> when nothing named does).
    const spans = units.map((u) => ({ label: u.label, a: u.x.node.getStart(sf), b: u.x.node.getEnd() }))
    if (c.render?.node) spans.push({ label: 'render', a: c.render.node.getStart(sf), b: c.render.node.getEnd() })
    spans.sort((x, y) => x.b - x.a - (y.b - y.a))
    const declSpans = c.state.map((st) => st.span).filter(Boolean)
    const owner = (pos) => spans.find((sp) => sp.a <= pos && pos < sp.b)?.label ?? `L${lineOf(sf, pos)}`
    const compNode = c.node
    const walk = (n) => {
      if (ts.isIdentifier(n) && !isPropertyName(n) && (stateNames.has(n.text) || setters.has(n.text))) {
        const pos = n.getStart(sf)
        if (!declSpans.some(([a, b]) => a <= pos && pos < b)) {
          if (stateNames.has(n.text)) c.readBy.get(n.text).push(owner(pos))
          else c.writtenBy.get(setters.get(n.text)).push(owner(pos))
        }
      }
      ts.forEachChild(n, walk)
    }
    if (compNode) walk(compNode)
    const whole = scan(sf, sf.statements.find((st) => rangeOf(sf, st)[0] === c.start) ?? sf)
    c.db = whole.db
  }
  facts.moduleDb = scan(sf, sf).db
  return facts
}

/** A big non-component function's skeleton: its inner functions and the cases of its switches. */
function outlineFunction(sf, fn) {
  const items = []
  const visit = (n, depth) => {
    if (depth > 3) return
    if (ts.isFunctionDeclaration(n) && n.name && n !== fn) {
      const [s, e] = rangeOf(sf, n)
      if (e - s >= 5) items.push({ start: s, end: e, label: `function ${n.name.text}` })
      return
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (d.initializer && unwrapFn(d.initializer)) {
          const [s, e] = rangeOf(sf, n)
          if (e - s >= 5) items.push({ start: s, end: e, label: `const ${clip(d.name.getText(sf), 40)} = fn` })
        }
      }
      return
    }
    if (ts.isSwitchStatement(n)) {
      for (const cl of n.caseBlock.clauses) {
        const [s, e] = rangeOf(sf, cl)
        items.push({ start: s, end: e, label: ts.isCaseClause(cl) ? `case ${clip(cl.expression.getText(sf), 50)}` : 'default' })
      }
      return
    }
    ts.forEachChild(n, (c) => visit(c, depth + (ts.isBlock(c) ? 1 : 0)))
  }
  ts.forEachChild(fn.body ?? fn, (c) => visit(c, 0))
  // collapse fall-through cases (empty clauses) into the next
  const out = []
  for (const it of items) {
    const prev = out[out.length - 1]
    if (prev && prev.label.startsWith('case') && prev.end - prev.start === 0 && it.start === prev.end + 1) { it.label = `${prev.label} / ${it.label}`; it.start = prev.start; out.pop() }
    out.push(it)
  }
  return out
}

const flattenBranches = (bs) => bs.flatMap((b) => [b, ...flattenBranches(b.children || [])])

// ─── markdown ────────────────────────────────────────────────────────────────

function toMarkdown(f) {
  const o = []
  const comps = f.components.filter((c) => !c.isHook)
  const hooks = f.components.filter((c) => c.isHook)
  const sum = (k) => f.components.reduce((a, c) => a + c[k].length, 0)
  const dbAll = f.moduleDb
  const byKind = (k) => [...new Set(dbAll.filter((d) => d.kind === k).map((d) => d.name))]
  o.push(`# Fact sheet: \`${f.file}\``)
  o.push('')
  o.push(`> Generated by \`scripts/map-surface.mjs\` at ${f.sha} — facts only; regenerate, never hand-edit. Line numbers are exact at this commit.`)
  o.push('')
  o.push(`**${f.lines.toLocaleString('en-US')} lines** · last commit ${f.lastCommit || '—'} · ${f.commits90} commits in 90 days · ${comps.length} component(s), ${hooks.length} hook(s), ${f.declarations.filter((d) => d.kind === 'function' && !f.components.some((c) => c.name === d.name)).length} module function(s)`)
  o.push(`Hook census: ${sum('state')} useState · ${sum('reducers')} useReducer · ${sum('effects')} effects · ${sum('memos')} useMemo · ${sum('callbacks')} useCallback · ${sum('refs')} useRef · ${sum('customHooks')} custom hooks`)
  o.push(`Data: tables ${list(byKind('table'), 30)} · rpcs ${list(byKind('rpc'), 30)} · edge fns ${list(byKind('fn'), 20)}${byKind('bucket').length ? ` · buckets ${list(byKind('bucket'))}` : ''}`)
  o.push('')
  o.push(`**Imported by (${f.importers.length}):** ${f.importers.length ? f.importers.map((x) => '`' + x + '`').slice(0, 25).join(', ') + (f.importers.length > 25 ? ` +${f.importers.length - 25}` : '') : '— (entry or unused)'}`)
  const local = f.imports.filter((i) => i.local)
  const ext = f.imports.filter((i) => !i.local)
  o.push('')
  o.push(`**Imports (${local.length} local, ${ext.length} packages):** ${ext.map((i) => i.spec).join(', ') || '—'}`)
  for (const i of local) o.push(`- \`${i.resolved || i.spec}\` — ${clip(i.names.join(', '), 140)}`)
  o.push('')
  o.push('## Module scope')
  o.push('')
  o.push('| Lines | Kind | Name | Size | Exported |')
  o.push('|---|---|---|---|---|')
  for (const d of f.declarations) o.push(`| ${d.start}–${d.end} | ${d.kind} | \`${cell(d.name)}\` | ${d.lines} | ${d.exported ? 'yes' : ''} |`)
  for (const c of [...comps.sort((a, b) => b.lines - a.lines), ...hooks]) o.push('', ...componentMd(c))
  for (const fo of f.outlines) {
    o.push('', `## Function \`${fo.name}\` — lines ${fo.start}–${fo.end} (${fo.end - fo.start + 1})`, '')
    if (fo.db.length) o.push(`Data: ${dbList(fo.db).replace(/ \+\d+$/, '')}${fo.db.length > 5 ? ` (${new Set(fo.db.map((d) => d.name)).size} distinct)` : ''}`, '')
    if (fo.items.length) {
      o.push('| Lines | Size | Part |', '|---|---|---|')
      for (const it of fo.items) o.push(`| ${it.start}–${it.end} | ${it.end - it.start + 1} | \`${cell(it.label)}\` |`)
    }
  }
  return o.join('\n') + '\n'
}

function componentMd(c) {
  const o = []
  o.push(`## ${c.isHook ? 'Hook' : 'Component'} \`${c.name}\` — lines ${c.start}–${c.end} (${c.lines})`)
  o.push('')
  if (c.props) o.push(`Props: \`${cell(c.props)}\``)
  const small = !c.state.length && !c.effects.length && !c.handlers.length && c.lines < 120
  if (small) {
    o.push(`Presentational (${c.lines} lines, no state/effects/handlers). Renders: ${list((c.render?.tags || []).map(([t, n]) => (n > 1 ? `${t}×${n}` : t)), 12)}`)
    return o
  }
  if (c.state.length) {
    o.push('', `### State (${c.state.length})`, '', '| Line | State | Init | Read by | Written by |', '|---|---|---|---|---|')
    for (const s of c.state) {
      const reads = c.readBy.get(s.name) || []
      const writes = c.writtenBy.get(s.name) || []
      o.push(`| ${s.line} | \`${s.name}\`${s.type ? ` <${cell(s.type)}>` : ''} | ${cell(s.init) || '—'} | ${cell(list(reads, 6))} | ${cell(list(writes, 6))} |`)
    }
  }
  if (c.reducers.length) o.push('', `Reducers: ${c.reducers.map((r) => `\`${r.name}\` (${r.line})`).join(', ')}`)
  if (c.refs.length) o.push('', `Refs (${c.refs.length}): ${c.refs.map((r) => `\`${r.name}\` ${r.line}`).join(' · ')}`)
  if (c.context.length) o.push('', `Context: ${c.context.map((r) => `\`${r.name}\` ← ${r.ctx} (${r.line})`).join(' · ')}`)
  if (c.customHooks.length) {
    o.push('', `### Custom hooks (${c.customHooks.length})`, '', '| Line | Hook | Binding | Reads state |', '|---|---|---|---|')
    for (const h of c.customHooks) o.push(`| ${h.line} | \`${h.hook}\` | \`${cell(clip(h.name, 60))}\` | ${cell(list(h.reads || [], 6))} |`)
  }
  if (c.effects.length) {
    o.push('', `### Effects (${c.effects.length})`, '', '| Lines | Deps | Reads | Writes | Data |', '|---|---|---|---|---|')
    for (const e of c.effects) o.push(`| ${e.start}–${e.end} | ${cell(e.deps)} | ${cell(list(e.reads, 6))} | ${cell(list(e.writes, 6))} | ${cell(dbList(e.db))} |`)
  }
  const memoRows = [...c.memos.map((m) => ({ ...m, k: 'memo' })), ...c.callbacks.map((m) => ({ ...m, k: 'callback' }))].sort((a, b) => a.start - b.start)
  if (memoRows.length) {
    o.push('', `### Memos & callbacks (${memoRows.length})`, '', '| Lines | Kind | Name | Reads | Writes | Data |', '|---|---|---|---|---|---|')
    for (const m of memoRows) o.push(`| ${m.start}–${m.end} | ${m.k} | \`${cell(clip(m.name, 40))}\` | ${cell(list(m.reads, 5))} | ${cell(list(m.writes, 5))} | ${cell(dbList(m.db))} |`)
  }
  if (c.handlers.length) {
    o.push('', `### Handlers & inner functions (${c.handlers.length})`, '', '| Lines | Name | Size | Writes | Calls | Data |', '|---|---|---|---|---|---|')
    for (const h of c.handlers) o.push(`| ${h.start}–${h.end} | \`${cell(h.name)}\`${h.async ? ' (async)' : ''} | ${h.end - h.start + 1} | ${cell(list(h.writes, 6))} | ${cell(list(h.callsHandlers, 5))} | ${cell(dbList(h.db))} |`)
  }
  const bigLocals = c.locals.filter((l) => l.end - l.start + 1 >= 8)
  if (bigLocals.length) {
    o.push('', `### Derived locals ≥8 lines (${bigLocals.length})`, '', '| Lines | Name | Size | JSX | Reads | Writes | Handlers | Children |', '|---|---|---|---|---|---|---|---|')
    for (const l of bigLocals) o.push(`| ${l.start}–${l.end} | \`${cell(l.name)}\` | ${l.end - l.start + 1} | ${l.jsx ? 'yes' : ''} | ${cell(list(l.reads, 6))} | ${cell(list(l.writes, 6))} | ${cell(list(l.callsHandlers, 5))} | ${cell(list([...(l.tags?.keys() || [])], 6))} |`)
    for (const l of bigLocals.filter((x) => x.branches?.length)) o.push('', `Conditional blocks inside \`${l.name}\`:`, '', ...branchTable(l.branches))
  }
  for (const r of c.earlyReturns) {
    o.push('', `### JSX if-block — lines ${r.start}–${r.end}${r.cond ? ` if (\`${cell(r.cond)}\`)` : ''}`, '')
    if (r.reads) o.push(`Reads ${list(r.reads, 10)} · writes ${list(r.writes, 8)} · handlers ${list(r.callsHandlers, 8)} · children ${list([...(r.tags?.keys() || [])], 12)}`)
    if (r.branches?.length) o.push('', ...branchTable(r.branches))
  }
  if (c.render) {
    o.push('', `### Render — lines ${c.render.start}–${c.render.end} (${c.render.lines})`, '')
    o.push(`Child components: ${list((c.render.tags || []).map(([t, n]) => (n > 1 ? `${t}×${n}` : t)), 40)}`)
    if (c.branches.length) o.push('', `Conditional blocks ≥${BRANCH_MIN_LINES} lines (nested one level):`, '', ...branchTable(c.branches))
  }
  return o
}

function branchTable(branches) {
  const o = ['| Lines | Size | Condition | Reads | Writes | Handlers | Children |', '|---|---|---|---|---|---|---|']
  for (const b of flattenBranches(branches)) o.push(`| ${b.depth ? '↳ ' : ''}${b.start}–${b.end} | ${b.lines} | \`${cell(b.cond)}\` | ${cell(list(b.reads, 5))} | ${cell(list(b.writes, 5))} | ${cell(list(b.callsHandlers, 5))} | ${cell(list([...(b.tags?.keys() || [])], 6))} |`)
  return o
}

const dbList = (db) => (db?.length ? list(db.map((d) => (d.kind === 'table' ? d.name : `${d.kind}:${d.name}`)), 5) : '')

// ─── routes ──────────────────────────────────────────────────────────────────

function routes() {
  const file = 'src/App.tsx'
  const { sf } = parse(file)
  const lazyMap = new Map()
  const importMap = new Map()
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.importClause) {
      const r = resolveSpec(file, st.moduleSpecifier.text)
      if (st.importClause.name) importMap.set(st.importClause.name.text, r)
      const nb = st.importClause.namedBindings
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) importMap.set(e.name.text, r)
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const m = d.initializer?.getText(sf).match(/import\(\s*['"]([^'"]+)['"]/)
        if (m) lazyMap.set(d.name.getText(sf), resolveSpec(file, m[1]))
      }
    }
  }
  const rows = []
  const visit = (n, prefix) => {
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && (ts.isJsxElement(n) ? n.openingElement : n).tagName.getText(sf) === 'Route') {
      const open = ts.isJsxElement(n) ? n.openingElement : n
      let p = ''
      let el = ''
      for (const a of open.attributes.properties) {
        if (!ts.isJsxAttribute(a) || !a.initializer) continue
        const an = a.name.getText(sf)
        if (an === 'path') p = ts.isStringLiteral(a.initializer) ? a.initializer.text : a.initializer.getText(sf)
        if (an === 'element') el = a.initializer.getText(sf)
        if (an === 'index') p = '(index)'
      }
      const full = p.startsWith('/') || !prefix ? p : `${prefix.replace(/\/$/, '')}/${p}`
      const tags = [...el.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1])
      const comp = tags.find((t) => lazyMap.has(t) || importMap.has(t)) || tags[tags.length - 1] || ''
      const target = lazyMap.get(comp) || importMap.get(comp) || ''
      const lines = target ? lineCount(fs.readFileSync(path.join(ROOT, target), 'utf8')) : ''
      rows.push({ path: full || '(layout)', component: comp, wrappers: tags.filter((t) => t !== comp), file: target, lines, line: lineOf(sf, n.getStart(sf)) })
      if (ts.isJsxElement(n)) for (const ch of n.children) visit(ch, full || prefix)
      return
    }
    ts.forEachChild(n, (ch) => visit(ch, prefix))
  }
  visit(sf, '')
  const o = ['# Routes (`src/App.tsx`)', '', `> Generated by \`scripts/map-surface.mjs --routes\` at ${git('rev-parse', '--short', 'HEAD')}.`, '', '| Path | Component | Wrappers | File | Lines |', '|---|---|---|---|---|']
  for (const r of rows) o.push(`| \`${cell(r.path)}\` | ${r.component ? '`' + r.component + '`' : '—'} | ${r.wrappers.join(', ') || ''} | ${r.file ? '`' + r.file + '`' : ''} | ${r.lines} |`)
  return o.join('\n') + '\n'
}

// ─── triage ──────────────────────────────────────────────────────────────────

function readMaps() {
  const maps = []
  for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) {
    if (!/_ARCHITECTURE\.md$/.test(f)) continue
    const p = `docs/${f}`
    const text = fs.readFileSync(path.join(ROOT, p), 'utf8')
    const fm = text.match(/^---\n([\s\S]*?)\n---/m)
    const covers = []
    if (fm) {
      const block = fm[1].match(/^covers:\s*\n((?:\s+-\s+.+\n?)+)/m)
      if (block) for (const m of block[1].matchAll(/-\s+`?([^`\s]+)`?/g)) covers.push(m[1])
      const inline = fm[1].match(/^covers:\s*\[(.+)\]/m)
      if (inline) covers.push(...inline[1].split(',').map((s) => s.trim().replace(/[`'"]/g, '')))
    }
    maps.push({ path: p, covers, text, last: git('log', '-1', '--format=%H %cs', '--', p) })
  }
  return maps
}

function triage(min) {
  const maps = readMaps()
  const byFile = new Map()
  for (const m of maps) for (const c of m.covers) byFile.set(c, m)
  // Fallback for maps without `covers:` — the playbook's inventory table pairs file → map.
  const playbook = fs.readFileSync(path.join(ROOT, 'docs/PAGE_DECOMPOSITION_PLAYBOOK.md'), 'utf8')
  for (const row of playbook.split('\n').filter((l) => l.startsWith('| `src/'))) {
    const mapName = row.match(/\(\.\/([A-Z_]+_ARCHITECTURE\.md)\)/)?.[1]
    const m = mapName && maps.find((x) => x.path === `docs/${mapName}`)
    if (!m) continue
    for (const fm of row.split('|')[1].matchAll(/`(src\/[^`]+)`/g)) if (!byFile.has(fm[1])) byFile.set(fm[1], m)
  }
  // Last fallback: a map whose header (first 40 lines) names the file's path or its basename.
  const headerMentions = (f) => maps.find((m) => {
    const head = m.text.split('\n').slice(0, 40).join('\n')
    return head.includes(f) || new RegExp('[`/(]' + path.basename(f).replace('.', '\\.') + '[`)\\s]').test(head)
  })
  const rows = []
  for (const dir of SOURCE_DIRS) {
    for (const f of walkFiles(dir)) {
      if (SKIP_FILE.test(f) || !/\.tsx?$/.test(f)) continue
      const n = lineCount(fs.readFileSync(path.join(ROOT, f), 'utf8'))
      if (n < min) continue
      let m = byFile.get(f)
      let pairedBy = m ? (m.covers.includes(f) ? 'covers' : 'playbook') : ''
      if (!m && (m = headerMentions(f))) pairedBy = 'header'
      let since = ''
      if (m?.last) since = Number(git('rev-list', '--count', `${m.last.split(' ')[0]}..HEAD`, '--', f) || 0)
      const status = !m ? 'NO MAP' : since >= 5 ? 'STALE' : since >= 1 ? 'drifting' : 'fresh'
      rows.push({ f, n, map: m?.path ?? '', mapDate: m?.last.split(' ')[1] ?? '', since, status, covered: pairedBy })
    }
  }
  rows.sort((a, b) => b.n - a.n)
  const o = [`# Map triage — source files ≥ ${min} lines`, '', `> Generated by \`scripts/map-surface.mjs --triage\` at ${git('rev-parse', '--short', 'HEAD')}. STALE = ≥5 commits to the file since its map was last touched.`, '', '| File | Lines | Status | Map | Map touched | Commits since | Paired by |', '|---|---|---|---|---|---|---|']
  for (const r of rows) o.push(`| \`${r.f}\` | ${r.n} | ${r.status} | ${r.map ? '`' + r.map.replace('docs/', '') + '`' : '—'} | ${r.mapDate} | ${r.since} | ${r.covered} |`)
  const count = (s) => rows.filter((r) => r.status === s).length
  o.push('', `${rows.length} files · ${count('NO MAP')} no map · ${count('STALE')} stale · ${count('drifting')} drifting · ${count('fresh')} fresh`)
  return { md: o.join('\n') + '\n', rows }
}

// ─── cli ─────────────────────────────────────────────────────────────────────

function main(argv) {
  const args = [...argv]
  const flag = (f) => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true }
  const opt = (f) => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v }
  const json = flag('--json')
  const out = opt('--out')
  if (flag('--routes')) { process.stdout.write(routes()); return }
  if (flag('--triage')) {
    const t = triage(Number(opt('--min') || 1500))
    process.stdout.write(json ? JSON.stringify(t.rows, null, 2) + '\n' : t.md)
    return
  }
  if (!args.length) { console.error('usage: npm run map -- [--json] [--out <dir>] <file> … | --routes | --triage [--min N]'); process.exit(2) }
  if (out) fs.mkdirSync(out, { recursive: true })
  for (const a of args) {
    const file = rel(a)
    if (!fs.existsSync(path.join(ROOT, file))) { console.error(`no such file: ${file}`); process.exitCode = 1; continue }
    const facts = analyzeFile(file)
    const body = json ? JSON.stringify(facts, (k, v) => (k === 'node' ? undefined : v instanceof Map ? Object.fromEntries(v) : v), 2) + '\n' : toMarkdown(facts)
    if (out) fs.writeFileSync(path.join(out, path.basename(file).replace(/\.[^.]+$/, '') + (json ? '.facts.json' : '.facts.md')), body)
    else process.stdout.write(body + (args.length > 1 ? '\n---\n\n' : ''))
  }
}

main(process.argv.slice(2))
