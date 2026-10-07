#!/usr/bin/env node
/**
 * Lift kernels from the GC mode prototype to main, word for word (written for the schedule's PR 1a,
 * 2026-10-07; to-dos/gc-mode/mockups/schedule-pr1a.md). Run it on the spike, where src/lib/gcMode is
 * on disk:
 *
 *   node to-dos/gc-mode/scripts/lift-extract.cjs to-dos/gc-mode/scripts/<lift>.json <outDir>
 *
 * The config lists, for each file on main, the spike file it comes from and the exports that move
 * ("all", or a list, less any that stay). Every top-level declaration those exports need from the
 * same spike file comes along, with its comments, in the spike's order. A declaration they need from
 * another spike file must move in another entry, or be one main already has (`existing`), or be a
 * type the config places (`types`). Anything else stops the run and names what is missing.
 * Imports are written from what each file's declarations use. The files land in <outDir> under
 * main's paths; a file marked `append` holds only what is added to the file main already has.
 */
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript'))
const [configPath, outDir] = process.argv.slice(2)
if (!configPath || !outDir) {
  console.error('usage: node lift-extract.cjs <config.json> <outDir>')
  process.exit(2)
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const spikeDir = path.join(root, config.spikeDir ?? 'src/lib/gcMode')
const mainBase = config.mainBase ?? 'src/lib/gc'

const files = fs.readdirSync(spikeDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => path.join(spikeDir, f))
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true, noEmit: true }
const program = ts.createProgram(files, options)
const checker = program.getTypeChecker()
// The test files get their own program, so their names resolve too.
const testFiles = (config.tests || []).map((t) => path.join(spikeDir, t.from))
const testProgram = testFiles.length ? ts.createProgram([...files, ...testFiles], options) : null
const base = (f) => path.basename(f, '.ts')

/** The names a top-level statement declares. */
function declared(s) {
  if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) return s.name ? [s.name.text] : []
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []))
  return []
}
const isTypeDecl = (s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)

/** Every top-level declaration of every source file reachable from the spike, by "file#name". */
const decls = new Map()
const topOf = (node) => {
  let n = node
  while (n.parent && !ts.isSourceFile(n.parent)) n = n.parent
  return n
}
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || sf.fileName.includes('node_modules')) continue
  for (const s of sf.statements) for (const name of declared(s)) decls.set(`${sf.fileName}#${name}`, { sf, s, name, type: isTypeDecl(s) })
}

/** What a statement uses: the top-level declarations (in any file) its identifiers resolve to. */
const usesCache = new Map()
function uses(sf, s) {
  if (usesCache.has(s)) return usesCache.get(s)
  const out = new Map()
  const visit = (n) => {
    if (ts.isIdentifier(n)) {
      let sym = checker.getSymbolAtLocation(n)
      if (sym && sym.flags & ts.SymbolFlags.Alias) {
        try {
          sym = checker.getAliasedSymbol(sym)
        } catch {}
      }
      const d = sym && sym.declarations && sym.declarations[0]
      if (d && !d.getSourceFile().isDeclarationFile && !d.getSourceFile().fileName.includes('node_modules')) {
        const top = topOf(d)
        if (ts.isSourceFile(top.parent) && top !== s) for (const name of declared(top)) if (name === sym.getName()) out.set(`${top.getSourceFile().fileName}#${name}`, true)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(s)
  usesCache.set(s, [...out.keys()])
  return usesCache.get(s)
}

// Where each moving declaration lands: "spikeFile#name" -> main path.
const placed = new Map()
const spikePath = (b) => path.join(spikeDir, b + '.ts')
for (const e of config.files) {
  const sf = program.getSourceFile(spikePath(e.from))
  if (!sf) throw new Error(`no spike file ${e.from}`)
  const exported = sf.statements.filter((s) => (ts.getCombinedModifierFlags(s.declarationList ? s.declarationList.declarations[0] : s) & ts.ModifierFlags.Export) || (s.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)).flatMap(declared)
  const moves = (e.moves === 'all' ? exported : e.moves).filter((n) => !(e.stays || []).includes(n))
  for (const n of moves) if (!exported.includes(n) && !declared(sf.statements.find((s) => declared(s).includes(n)) ?? {}).length) throw new Error(`${e.from} has no ${n}`)
  e._moves = moves
  e._sf = sf
}
for (const t of config.types || []) for (const name of t.names) placed.set(`${spikePath(t.from ?? 'gcTypes')}#${name}`, t.to)
for (const [name, to] of Object.entries(config.existing || {})) placed.set(name.includes('#') ? path.join(root, name.split('#')[0]) + '#' + name.split('#')[1] : `${spikePath(config.existingFrom?.[name] ?? '')}#${name}`, to)

// Each entry's closure inside its own spike file; what it needs from elsewhere is checked after.
for (const e of config.files) {
  const want = new Set(e._moves.map((n) => `${e._sf.fileName}#${n}`))
  const stack = [...want]
  while (stack.length) {
    const k = stack.pop()
    const d = decls.get(k)
    if (!d) throw new Error(`no declaration ${k}`)
    for (const u of uses(d.sf, d.s)) if (u.startsWith(e._sf.fileName + '#') && !want.has(u) && !placed.has(u)) {
      want.add(u)
      stack.push(u)
    }
  }
  e._want = want
  for (const k of want) if (!placed.has(k)) placed.set(k, e.to)
}

// Everything a placed declaration uses must be placed too, or on main already.
const missing = new Set()
for (const e of config.files) for (const k of e._want) for (const u of uses(decls.get(k).sf, decls.get(k).s)) if (!placed.has(u)) missing.add(`${path.relative(root, k)} uses ${path.relative(root, u)}`)
if (missing.size) {
  console.error(`Not placed (move it in an entry, add it to "existing", or place the type):\n  ${[...missing].join('\n  ')}`)
  process.exit(1)
}

/** A relative import path from one main file to another. */
function rel(from, to) {
  let r = path.relative(path.dirname(from), to).replace(/\.ts$/, '')
  if (!r.startsWith('.')) r = './' + r
  return r
}
/**
 * A statement with the comments above it, word for word. The first statement after a file's imports
 * keeps only the comments touching it: the ones above a blank line there are the spike file's own
 * header or description, which do not belong to what moves.
 */
const firstAfterImports = (sf) => sf.statements.find((x) => !ts.isImportDeclaration(x))
const fullText = (sf, s) => {
  const text = sf.text.slice(s.getFullStart(), s.getEnd()).replace(/^\s*\n/, '')
  if (s !== firstAfterImports(sf)) return text
  const lead = sf.text.slice(s.getFullStart(), s.getStart())
  return lead.split(/\n[ \t]*\n/).pop().replace(/^\n+/, '') + s.getText(sf)
}

const written = []
for (const e of config.files) {
  const out = path.join(mainBase, e.to)
  const stmts = e._sf.statements.filter((s) => declared(s).some((n) => e._want.has(`${e._sf.fileName}#${n}`)))
  const imports = new Map() // target -> { values: Set, types: Set }
  for (const s of stmts) for (const u of uses(e._sf, s)) {
    const to = placed.get(u)
    if (!to || to === e.to) continue
    const d = decls.get(u)
    const name = u.split('#')[1]
    if (!imports.has(to)) imports.set(to, { values: new Set(), types: new Set() })
    imports.get(to)[d && d.type ? 'types' : 'values'].add(name)
  }
  const lines = [...imports.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([to, { values, types }]) => {
      const from = rel(out, path.join(mainBase, to))
      const r = []
      if (types.size) r.push(`import type { ${[...types].sort().join(', ')} } from '${from}'`)
      if (values.size) r.push(`import { ${[...values].sort().join(', ')} } from '${from}'`)
      return r
    })
  const body = stmts.map((s) => fullText(e._sf, s).replace(/^\n+/, '')).join('\n\n')
  const text = (e.append ? '' : `${(e.header ?? '').trim()}\n`) + (lines.length ? lines.join('\n') + '\n\n' : e.append ? '' : '\n') + body + '\n'
  const dest = path.join(outDir, out + (e.append ? '.append' : ''))
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, text)
  written.push(`${out}${e.append ? ' (append)' : ''}: ${stmts.length} declarations from ${e.from}, ${e._moves.length} exported`)
}
// The types placed whole, word for word, in the order the spike's file has them.
for (const t of config.types || []) {
  if (!t.whole) continue
  const sf = program.getSourceFile(spikePath(t.from ?? 'gcTypes'))
  const stmts = sf.statements.filter((s) => declared(s).some((n) => t.names.includes(n)))
  const uses_ = new Map()
  for (const s of stmts) for (const u of uses(sf, s)) {
    const to = placed.get(u)
    if (!to || to === t.to) continue
    if (!uses_.has(to)) uses_.set(to, new Set())
    uses_.get(to).add(u.split('#')[1])
  }
  const out = path.join(mainBase, t.to)
  const lines = [...uses_.entries()].map(([to, names]) => `import type { ${[...names].sort().join(', ')} } from '${rel(out, path.join(mainBase, to))}'`)
  const body = stmts.map((s) => fullText(sf, s).replace(/^\n+/, '')).join('\n\n')
  const dest = path.join(outDir, out)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, `${(t.header ?? '').trim()}\n${lines.length ? lines.join('\n') + '\n' : ''}\n${body}\n`)
  written.push(`${out}: ${stmts.length} types, whole`)
}
// The types placed trimmed: the prototype's name with only the listed fields, each with its own
// comment, in the order the spike's file has them. A lane that lifts more kernels lists more fields.
for (const t of config.types || []) {
  if (!t.fields) continue
  const sf = program.getSourceFile(spikePath(t.from ?? 'gcTypes'))
  const out = path.join(mainBase, t.to)
  const usesOf = new Map()
  const blocks = []
  for (const s of sf.statements) {
    const name = declared(s)[0]
    if (!name || !t.fields[name]) continue
    if (t.fields[name] === 'all') {
      // Whole, word for word: an alias, or a shape small enough to keep as it is.
      blocks.push(fullText(sf, s).replace(/^\n+/, ''))
      for (const u of uses(sf, s)) {
        const to = placed.get(u)
        if (!to) throw new Error(`${name} uses ${path.relative(root, u)}, which is not placed`)
        if (to === t.to) continue
        if (!usesOf.has(to)) usesOf.set(to, new Set())
        usesOf.get(to).add(u.split('#')[1])
      }
      continue
    }
    if (!ts.isInterfaceDeclaration(s)) throw new Error(`${name} is not an interface: list it as "all"`)
    const keep = t.fields[s.name.text]
    const members = s.members.filter((m) => m.name && keep.includes(m.name.getText()))
    const gone = keep.filter((f) => !members.some((m) => m.name.getText() === f))
    if (gone.length) throw new Error(`${s.name.text} has no ${gone.join(', ')}`)
    const lead = sf.text.slice(s.getFullStart(), s.getStart()).replace(/^\s*\n/, '')
    blocks.push(`${lead}export interface ${s.name.text} {\n${members.map((m) => sf.text.slice(m.getFullStart(), m.getEnd()).replace(/^\n+/, '')).join('\n')}\n}`)
    for (const m of members) for (const u of uses(sf, m)) {
      const to = placed.get(u)
      if (!to) throw new Error(`${s.name.text}.${m.name.getText()} uses ${path.relative(root, u)}, which is not placed`)
      if (to === t.to) continue
      if (!usesOf.has(to)) usesOf.set(to, new Set())
      usesOf.get(to).add(u.split('#')[1])
    }
  }
  const missingNames = Object.keys(t.fields).filter((n) => !sf.statements.some((s) => declared(s)[0] === n))
  if (missingNames.length) throw new Error(`not in ${t.from ?? 'gcTypes'}: ${missingNames.join(', ')}`)
  const lines = [...usesOf.entries()].map(([to, names]) => `import type { ${[...names].sort().join(', ')} } from '${rel(out, path.join(mainBase, to))}'`)
  const dest = path.join(outDir, out + (t.append ? '.append' : ''))
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, `${lines.length ? `// Imports for the top of the file:\n${lines.join('\n')}\n\n` : ''}${(t.header ?? '').trim()}\n\n${blocks.join('\n\n')}\n`)
  written.push(`${out}${t.append ? ' (append)' : ''}: ${blocks.length} types, trimmed`)
}
// The tests: from each spike test file, the tests that reach only what this lift places (or a
// stand-in, like the test data for the prototype's fixture), with what they use from the file, under
// their describe blocks, word for word. A test that reaches anything else (the prototype's reducer,
// a kernel that stays) stays in the spike, and the run lists it.
for (const t of config.tests || []) {
  const file = path.join(spikeDir, t.from)
  const sf = testProgram.getSourceFile(file)
  if (!sf) throw new Error(`no test file ${t.from}`)
  const tc = testProgram.getTypeChecker()
  const out = path.join(mainBase, t.to)
  const isCall = (s, names) => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && ts.isIdentifier(s.expression.expression) && names.includes(s.expression.expression.text)
  const bodyOf = (s) => {
    const fn = s.expression.arguments[1]
    return fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isBlock(fn.body) ? fn.body : null
  }
  /** The unit holding a declaration: the statement in the file or in a describe body that declares it. */
  const unitOf = (d) => {
    let n = d
    while (n.parent && !ts.isSourceFile(n.parent) && !(ts.isBlock(n.parent) && ts.isArrowFunction(n.parent.parent) && n.parent.parent.parent && ts.isCallExpression(n.parent.parent.parent) && ['describe'].includes(n.parent.parent.parent.expression.getText()))) n = n.parent
    return n.parent ? n : null
  }
  const ext = new Map() // a unit -> { ok, imports: Map(mainPath -> {values, types}), vitest: Set, units: Set }
  const reach = (unit) => {
    if (ext.has(unit)) return ext.get(unit)
    const r = { ok: true, why: [], imports: new Map(), vitest: new Set(), units: new Set() }
    ext.set(unit, r)
    const visit = (n) => {
      if (ts.isIdentifier(n)) {
        let sym = tc.getSymbolAtLocation(n)
        // A name the file imports from vitest, by the file's own local name.
        const spec = sym && sym.declarations && sym.declarations[0]
        if (spec && ts.isImportSpecifier(spec) && spec.parent.parent.parent.moduleSpecifier.text === 'vitest') {
          r.vitest.add(n.text)
          ts.forEachChild(n, visit)
          return
        }
        if (sym && sym.flags & ts.SymbolFlags.Alias) {
          try {
            sym = tc.getAliasedSymbol(sym)
          } catch {}
        }
        const d = sym && sym.declarations && sym.declarations[0]
        if (d) {
          const dsf = d.getSourceFile()
          if (dsf.fileName.includes('node_modules')) {
            // vitest's own declarations (a matcher, say) and anything else from a package: nothing to import.
          } else if (dsf === sf) {
            const u = unitOf(d)
            if (u && u !== unit && !isCall(u, ['it', 'test', 'describe'])) {
              r.units.add(u)
              const sub = reach(u)
              if (!sub.ok) {
                r.ok = false
                r.why.push(...sub.why)
              }
            }
          } else if (!dsf.isDeclarationFile && !dsf.fileName.includes('node_modules') && declared(topOf(d)).includes(sym.getName())) {
            // A top-level declaration in another file (a field of one, like `state.projects`, is not).
            const top = topOf(d)
            const key = `${dsf.fileName}#${sym.getName()}`
            const to = (config.standIns || {})[path.relative(root, dsf.fileName) + '#' + sym.getName()] ?? placed.get(key) ?? (config.outside || {})[path.relative(root, dsf.fileName)]
            if (!to) {
              r.ok = false
              r.why.push(path.relative(root, key))
            } else {
              const target = to.startsWith('src/') ? to : path.join(mainBase, to)
              if (!r.imports.has(target)) r.imports.set(target, { values: new Set(), types: new Set() })
              r.imports.get(target)[isTypeDecl(top) ? 'types' : 'values'].add(sym.getName())
            }
          }
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(unit)
    return r
  }
  const kept = []
  const left = []
  /** A describe body's (or the file's) statements, with only kept tests and the units they use. */
  function emit(stmts) {
    const need = new Set()
    const parts = []
    for (const s of stmts) {
      if (isCall(s, ['it', 'test'])) {
        const r = reach(s)
        const title = s.expression.arguments[0].getText()
        if (r.ok) {
          kept.push(title)
          const all = new Set([s])
          const stack = [...r.units]
          while (stack.length) {
            const u = stack.pop()
            if (all.has(u)) continue
            all.add(u)
            stack.push(...reach(u).units)
          }
          for (const u of all) need.add(u)
          parts.push(s)
        } else left.push(`${title}: ${[...new Set(reach(s).why)].slice(0, 3).join(', ')}`)
      } else if (isCall(s, ['describe'])) {
        const body = bodyOf(s)
        const inner = body ? emit(body.statements) : null
        if (inner && inner.text) {
          for (const u of inner.need) need.add(u)
          parts.push({ describe: s, text: inner.text })
        }
      } else parts.push(s)
    }
    const texts = parts
      .filter((p) => p.describe || need.has(p) || isCall(p, ['it', 'test']))
      .map((p) => {
        if (p.describe) {
          const s = p.describe
          const lead = sf.text.slice(s.getFullStart(), s.getStart()).replace(/^\s*\n/, '')
          const indent = lead.match(/[ \t]*$/)[0]
          return `${lead}describe(${s.expression.arguments[0].getText()}, () => {\n${p.text}\n${indent}})`
        }
        return fullText(sf, p)
      })
    return { text: parts.some((p) => p.describe || isCall(p, ['it', 'test'])) ? texts.join('\n\n') : '', need }
  }
  const body = emit(sf.statements.filter((s) => !ts.isImportDeclaration(s)))
  const imports = new Map()
  const vitest = new Set()
  for (const [u, r] of ext) {
    if (!body.need.has(u) || !r.ok) continue
    for (const v of r.vitest) vitest.add(v)
    for (const [to, { values, types }] of r.imports) {
      if (!imports.has(to)) imports.set(to, { values: new Set(), types: new Set() })
      values.forEach((v) => imports.get(to).values.add(v))
      types.forEach((v) => imports.get(to).types.add(v))
    }
  }
  // The describe blocks are written around the kept tests, so their name is added here.
  if (/^\s*describe\(/m.test(body.text)) vitest.add('describe')
  const lines = [`import { ${[...vitest].sort().join(', ')} } from 'vitest'`]
  for (const [to, { values, types }] of [...imports.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const from = rel(out, to)
    if (types.size) lines.push(`import type { ${[...types].sort().join(', ')} } from '${from}'`)
    if (values.size) lines.push(`import { ${[...values].sort().join(', ')} } from '${from}'`)
  }
  if (kept.length) {
    const dest = path.join(outDir, out)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, `${(t.header ?? '').trim()}\n${lines.join('\n')}\n\n${body.text}\n`)
  }
  written.push(`${kept.length ? out : '(nothing written)'}: ${kept.length} tests kept from ${t.from}, ${left.length} stay`)
  if (process.env.LIFT_VERBOSE) for (const l of left) written.push(`  stays: ${l}`)
}
console.log(written.join('\n'))
