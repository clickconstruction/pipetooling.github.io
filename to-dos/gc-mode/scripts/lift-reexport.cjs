#!/usr/bin/env node
/**
 * The spike's follow-up to a lift (written for the schedule's PR 1a, 2026-10-07): once main's copy is
 * merged into the spike, each spike file deletes what moved and re-exports it from main, so there is
 * one copy and every caller, and the barrel, reads as before. Run it on the spike, after main is
 * merged in, with the placements lift-extract.cjs wrote for the lift:
 *
 *   LIFT_PLACEMENTS=<file> node to-dos/gc-mode/scripts/lift-extract.cjs <lift.json> <scratch dir>
 *   node to-dos/gc-mode/scripts/lift-reexport.cjs <file> [--write]
 *
 * For each spike file it deletes the moved declarations with their comments, re-exports the
 * exported ones from main, imports from main what the code that stays still uses, and drops the
 * imports nothing uses any more. A private helper that moved and is still used by code that stays
 * keeps its copy in the spike file, and the run lists it: the next lift takes it. Without --write it
 * only reports.
 */
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript'))
const [placementsPath, flag] = process.argv.slice(2)
if (!placementsPath) {
  console.error('usage: node lift-reexport.cjs <placements.json> [--write]')
  process.exit(2)
}
const write = flag === '--write'
const moved = JSON.parse(fs.readFileSync(placementsPath, 'utf8'))
// Main's own folder, from the placements: "src/lib/gc".
const mainOf = (Object.values(moved)[0]?.to ?? 'src/lib/gc/x.ts').split('/').slice(0, 3).join('/')
const spikeDir = path.join(root, 'src/lib/gcMode')
const files = fs.readdirSync(spikeDir).filter((f) => f.endsWith('.ts')).map((f) => path.join(spikeDir, f))
const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true, noEmit: true })
const checker = program.getTypeChecker()

function declared(s) {
  if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) return s.name ? [s.name.text] : []
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []))
  return []
}
const isExported = (s) => (s.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
/** The names a set of statements reference that resolve to the given symbols. */
function referenced(stmts, symbols) {
  const hit = new Set()
  const visit = (n) => {
    if (ts.isIdentifier(n)) {
      const sym = checker.getSymbolAtLocation(n)
      if (sym && symbols.has(sym)) hit.add(symbols.get(sym))
    }
    ts.forEachChild(n, visit)
  }
  for (const s of stmts) visit(s)
  return hit
}
function rel(fromFile, toMain) {
  let r = path.relative(path.dirname(fromFile), path.join(root, toMain)).replace(/\.ts$/, '')
  if (!r.startsWith('.')) r = './' + r
  return r
}

const byFile = new Map()
for (const [k, v] of Object.entries(moved)) {
  const [file, name] = k.split('#')
  const abs = path.join(root, file)
  if (!byFile.has(abs)) byFile.set(abs, new Map())
  byFile.get(abs).set(name, v)
}

const report = []
for (const [file, names] of byFile) {
  const sf = program.getSourceFile(file)
  if (!sf) throw new Error(`no spike file ${path.relative(root, file)}`)
  const imports = sf.statements.filter(ts.isImportDeclaration)
  const body = sf.statements.filter((s) => !ts.isImportDeclaration(s))
  const isMoved = (s) => declared(s).length > 0 && declared(s).every((n) => names.has(n))
  for (const s of body) if (declared(s).some((n) => names.has(n)) && !isMoved(s)) throw new Error(`${path.basename(file)}: a statement both moves and stays (${declared(s).join(', ')})`)
  const gone = body.filter(isMoved)
  let stays = body.filter((s) => !isMoved(s))
  // A moved private helper still used by what stays keeps its copy here, until the lift that takes its user.
  const kept = []
  for (;;) {
    const symbols = new Map()
    for (const s of gone) if (!isExported(s) && !kept.includes(s)) for (const d of s.declarationList ? s.declarationList.declarations : [s]) { const sym = checker.getSymbolAtLocation(d.name); if (sym) symbols.set(sym, s) }
    const need = referenced([...stays, ...kept], symbols)
    const fresh = [...need].filter((s) => !kept.includes(s))
    if (fresh.length === 0) break
    kept.push(...fresh)
  }
  const deleted = gone.filter((s) => !kept.includes(s))
  stays = [...stays, ...kept].sort((a, b) => a.pos - b.pos)

  // What the code that stays uses from what moved: imported from main.
  const movedSymbols = new Map()
  for (const s of deleted) for (const d of s.declarationList ? s.declarationList.declarations : [s]) { const sym = checker.getSymbolAtLocation(d.name); if (sym) movedSymbols.set(sym, declared(s).find((n) => n === d.name.getText()) ?? declared(s)[0]) }
  const usedHere = referenced(stays, movedSymbols)
  // What moved and was exported: re-exported from main.
  const lines = new Map() // main file -> { importValues, importTypes, exportValues, exportTypes }
  const slot = (to) => {
    if (!lines.has(to)) lines.set(to, { iv: new Set(), it: new Set(), ev: new Set(), et: new Set() })
    return lines.get(to)
  }
  for (const s of deleted) for (const n of declared(s)) {
    const { to, type } = names.get(n)
    if (isExported(s)) slot(to)[type ? 'et' : 'ev'].add(n)
    if (usedHere.has(n)) slot(to)[type ? 'it' : 'iv'].add(n)
  }
  // The imports nothing left uses are dropped, one name at a time.
  const importSymbols = new Map()
  for (const imp of imports) {
    const nb = imp.importClause && imp.importClause.namedBindings
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) { const sym = checker.getSymbolAtLocation(el.name); if (sym) importSymbols.set(sym, el) }
  }
  const stillUsed = referenced(stays, importSymbols)
  const newImports = imports.map((imp) => {
    const clause = imp.importClause
    const nb = clause && clause.namedBindings
    if (!nb || !ts.isNamedImports(nb) || clause.name) return imp.getText(sf)
    const keep = nb.elements.filter((el) => stillUsed.has(el))
    if (keep.length === 0) return null
    if (keep.length === nb.elements.length) return imp.getText(sf)
    return `import ${clause.isTypeOnly ? 'type ' : ''}{ ${keep.map((el) => el.getText(sf)).join(', ')} } from ${imp.moduleSpecifier.getText(sf)}`
  })
  const fromMain = []
  for (const [to, l] of [...lines.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const from = rel(file, to)
    if (l.it.size) fromMain.push(`import type { ${[...l.it].sort().join(', ')} } from '${from}'`)
    if (l.iv.size) fromMain.push(`import { ${[...l.iv].sort().join(', ')} } from '${from}'`)
    if (l.et.size) fromMain.push(`export type { ${[...l.et].sort().join(', ')} } from '${from}'`)
    if (l.ev.size) fromMain.push(`export { ${[...l.ev].sort().join(', ')} } from '${from}'`)
  }

  // The new text: what came before the first import, the imports that stay, main's lines, then what stays.
  const head = imports.length ? sf.text.slice(0, imports[0].getStart()) : sf.text.slice(0, (body[0] ?? sf).getFullStart())
  const importBlock = newImports.filter(Boolean).join('\n')
  const intro = '// What moved to main (the real build) is re-exported from there, so there is one copy.'
  // Each declaration that stays keeps the blank line above it, as the spike had it.
  const rest = stays.map((s) => sf.text.slice(s.getFullStart(), s.getEnd())).join('').replace(/^\s+/, '')
  let text = `${head}${importBlock}${importBlock ? '\n' : ''}${fromMain.length ? `${intro}\n${fromMain.join('\n')}\n` : ''}\n${rest}\n`.replace(/\n{3,}/g, '\n\n')
  // One intro a file, above its first line from main: an earlier follow-up's may have sat on an import that is gone now.
  const mainFrom = `from '${rel(file, mainOf)}/`
  const textLines = text.split('\n').filter((l) => l !== intro)
  const first = textLines.findIndex((l) => /^(import|export) /.test(l) && l.includes(mainFrom))
  if (first >= 0) textLines.splice(first, 0, intro)
  text = textLines.join('\n')
  report.push(`${path.relative(root, file)}: ${deleted.length} deleted, ${[...lines.values()].reduce((a, l) => a + l.ev.size + l.et.size, 0)} re-exported, ${usedHere.size} imported from main, ${imports.length - newImports.filter(Boolean).length} imports dropped${kept.length ? `; kept here, still used by what stays: ${kept.map((s) => declared(s).join(',')).join(', ')}` : ''}`)
  if (write) fs.writeFileSync(file, text)
}
console.log(report.join('\n'))
console.log(write ? 'written' : '(report only; --write to write)')
