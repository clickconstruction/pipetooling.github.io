#!/usr/bin/env node
/**
 * Lays an `.append` file that lift-extract.cjs wrote into the main file it is for (written for the
 * schedule's PR 1b-i, 2026-10-07). Run it where main's files are on disk (the lift's branch):
 *
 *   node to-dos/gc-mode/scripts/lift-append.cjs <outDir>/src/lib/gc/types.ts.append src/lib/gc/types.ts [--write]
 *
 * A declaration main has already (a trimmed shape the lift writes again with more fields) replaces
 * main's, with the comment touching it. A new one goes in the spike's order: before the next one main
 * has, or at the end. The "Imports for the top of the file" join main's imports from the same module.
 * Without --write it only reports.
 */
const fs = require('fs')
const path = require('path')

const ts = require(path.join(process.cwd(), 'node_modules/typescript'))
const [appendPath, mainPath, flag] = process.argv.slice(2)
if (!appendPath || !mainPath) {
  console.error('usage: node lift-append.cjs <file.append> <main file> [--write]')
  process.exit(2)
}
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true)
const app = parse(appendPath, fs.readFileSync(appendPath, 'utf8'))
const main = parse(mainPath, fs.readFileSync(mainPath, 'utf8'))

function declared(s) {
  if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) return s.name ? [s.name.text] : []
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []))
  return []
}
/** Where a statement starts with the comment touching it (after the last blank line above it). */
function touchingStart(sf, s) {
  const lead = sf.text.slice(s.getFullStart(), s.getStart())
  const m = lead.match(/^[\s\S]*\n[ \t]*\n/)
  return s.getFullStart() + (m ? m[0].length : lead.match(/^\n*/)[0].length)
}
const block = (sf, s) => sf.text.slice(touchingStart(sf, s), s.getEnd())

const mainBy = new Map()
for (const s of main.statements) for (const n of declared(s)) mainBy.set(n, s)
const adds = app.statements.filter((s) => declared(s).length)
const edits = [] // { at, end, text }
const report = []
adds.forEach((s, i) => {
  const name = declared(s)[0]
  const there = mainBy.get(name)
  if (there) {
    const same = block(main, there) === block(app, s)
    edits.push({ at: touchingStart(main, there), end: there.getEnd(), text: block(app, s) })
    report.push(`${name}: ${same ? 'the same as main has' : 'replaces main’s'}`)
    return
  }
  const next = adds.slice(i + 1).map((x) => mainBy.get(declared(x)[0])).find(Boolean)
  if (next) edits.push({ at: touchingStart(main, next), end: touchingStart(main, next), text: `${block(app, s)}\n\n` })
  else edits.push({ at: main.text.replace(/\s+$/, '').length, end: main.text.replace(/\s+$/, '').length, text: `\n\n${block(app, s)}` })
  report.push(`${name}: new${next ? `, before ${declared(next)[0]}` : ', at the end'}`)
})

// The imports the append lists for the top of the file, joined with main's from the same module.
const wanted = app.statements.filter(ts.isImportDeclaration)
for (const imp of wanted) {
  const from = imp.moduleSpecifier.text
  const typeOnly = !!(imp.importClause && imp.importClause.isTypeOnly)
  const names = imp.importClause.namedBindings.elements.map((e) => e.getText(app))
  const mine = main.statements.find((s) => ts.isImportDeclaration(s) && s.moduleSpecifier.text === from && !!(s.importClause && s.importClause.isTypeOnly) === typeOnly)
  if (mine) {
    const all = [...new Set([...mine.importClause.namedBindings.elements.map((e) => e.getText(main)), ...names])].sort()
    edits.push({ at: mine.getStart(), end: mine.getEnd(), text: `import ${typeOnly ? 'type ' : ''}{ ${all.join(', ')} } from '${from}'` })
    report.push(`import from '${from}': ${all.join(', ')}`)
  } else {
    const last = main.statements.filter(ts.isImportDeclaration).pop()
    const line = `import ${typeOnly ? 'type ' : ''}{ ${names.sort().join(', ')} } from '${from}'`
    if (last) edits.push({ at: last.getEnd(), end: last.getEnd(), text: `\n${line}` })
    else throw new Error(`no imports in ${mainPath} to add '${from}' beside: add it by hand`)
    report.push(`import from '${from}': new`)
  }
}

let text = main.text
// From the end, so each edit's place holds; two at one place go in the order they were made.
for (const e of edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.at - a.at || b.i - a.i)) text = text.slice(0, e.at) + e.text + text.slice(e.end)
text = text.replace(/\s*$/, '\n')
console.log(report.join('\n'))
if (flag === '--write') fs.writeFileSync(mainPath, text)
console.log(flag === '--write' ? `written ${mainPath}` : '(report only; --write to write)')
