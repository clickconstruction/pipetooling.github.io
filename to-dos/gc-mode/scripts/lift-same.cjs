#!/usr/bin/env node
/**
 * Is the lift word for word? (Written for the schedule's PR 1a, 2026-10-07; reused by every lift that
 * follows: 1b, B2, U2, O2.) For each file a lift config places on main, compares every declaration main
 * has from the lift with the spike's declaration of the same name, comments included. A trimmed shape
 * is compared field by field; a test is compared by its title. Run it where main's files are on disk
 * (the lift's branch), with the spike read through git:
 *
 *   node to-dos/gc-mode/scripts/lift-same.cjs <lift.json> [spike ref, default origin/spike/gc-mode]
 *
 * It prints a table for the PR body, and exits 1 when anything differs.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript'))
const [configPath, spikeRef = 'origin/spike/gc-mode'] = process.argv.slice(2)
if (!configPath) {
  console.error('usage: node lift-same.cjs <lift.json> [spike ref]')
  process.exit(2)
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const spikeDir = config.spikeDir ?? 'src/lib/gcMode'
const mainBase = config.mainBase ?? 'src/lib/gc'
// Git runs in the repository (LIFT_REPO when main's files are checked out somewhere else).
const repo = process.env.LIFT_REPO ?? root
const spikeSha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', spikeRef], { encoding: 'utf8' }).trim()

const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true)
const spikeFile = (rel) => parse(rel, execFileSync('git', ['-C', repo, 'show', `${spikeRef}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const mainFile = (rel) => (fs.existsSync(path.join(root, rel)) ? parse(rel, fs.readFileSync(path.join(root, rel), 'utf8')) : null)

function declared(s) {
  if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) return s.name ? [s.name.text] : []
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []))
  return []
}
/** A declaration's text with the comments touching it (after the last blank line above it; a file's header or a section rule is not compared). */
function withDoc(sf, node) {
  const lead = sf.text.slice(node.getFullStart(), node.getStart())
  const touching = lead.split(/\n[ \t]*\n/).pop()
  const doc = /\/\/ -{5,}/.test(touching) ? '' : touching
  return (doc + node.getText(sf)).replace(/^[ \t]+/gm, '').trim()
}
const byName = (sf) => {
  const m = new Map()
  for (const s of sf.statements) for (const n of declared(s)) m.set(n, s)
  return m
}
/** Every it(...) or test(...) in a file, by its title. */
function testsOf(sf) {
  const m = new Map()
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['it', 'test'].includes(n.expression.text) && n.arguments.length >= 2) m.set(n.arguments[0].getText(sf), n)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return m
}

const rows = []
let bad = 0
function check(mainRel, spikeRel, names) {
  const main = mainFile(mainRel)
  if (!main) {
    rows.push([mainRel, spikeRel, 0, 0, 1, 'missing on main'])
    bad++
    return
  }
  const spike = spikeFile(spikeRel)
  const sMap = byName(spike)
  let same = 0
  let trimmed = 0
  const differ = []
  for (const s of main.statements) {
    for (const n of declared(s)) {
      if (names && !names.includes(n)) continue
      const o = sMap.get(n)
      if (!o) {
        differ.push(`${n} (not on the spike)`)
        continue
      }
      if (withDoc(main, s) === withDoc(spike, o)) {
        same++
        continue
      }
      // A trimmed shape: every field main keeps is the spike's field, word for word.
      if (ts.isInterfaceDeclaration(s) && ts.isInterfaceDeclaration(o)) {
        const fields = new Map(o.members.map((m) => [m.name && m.name.getText(spike), m]))
        const off = s.members.filter((m) => !fields.has(m.name.getText(main)) || withDoc(main, m) !== withDoc(spike, fields.get(m.name.getText(main))))
        if (off.length === 0) {
          trimmed++
          continue
        }
        differ.push(`${n} (fields: ${off.map((m) => m.name.getText(main)).join(', ')})`)
        continue
      }
      differ.push(n)
    }
  }
  bad += differ.length
  rows.push([mainRel, spikeRel, same, trimmed, differ.length, differ.join('; ')])
}
function checkTests(mainRel, spikeRel) {
  const main = mainFile(mainRel)
  if (!main) return
  const spike = spikeFile(spikeRel)
  const theirs = testsOf(spike)
  let same = 0
  const differ = []
  for (const [title, call] of testsOf(main)) {
    const o = theirs.get(title)
    if (o && call.getText(main).replace(/^[ \t]+/gm, '') === o.getText(spike).replace(/^[ \t]+/gm, '')) same++
    else differ.push(`${title}${o ? '' : ' (not on the spike)'}`)
  }
  bad += differ.length
  rows.push([mainRel, spikeRel, same, 0, differ.length, differ.join('; ')])
}

for (const e of config.files) check(path.join(mainBase, e.to), path.join(spikeDir, e.from + '.ts'), e.append ? e.moves : null)
for (const t of config.types || []) check(path.join(mainBase, t.to), path.join(spikeDir, (t.from ?? 'gcTypes') + '.ts'), t.whole ? null : Object.keys(t.fields || {}))
for (const t of config.tests || []) checkTests(path.join(mainBase, t.to), path.join(spikeDir, t.from))

console.log(`Word for word against spike/gc-mode at ${spikeSha} (to-dos/gc-mode/scripts/lift-same.cjs):\n`)
console.log('| On main | From the spike | The same | Trimmed, each field the same | Differs |')
console.log('|---|---|---|---|---|')
for (const [m, s, same, trimmed, n, why] of rows) console.log(`| \`${m}\` | \`${path.basename(s)}\` | ${same} | ${trimmed || ''} | ${n ? `${n}: ${why}` : 'none'} |`)
console.log(`\n${bad === 0 ? 'Every declaration and test is the same as the spike’s.' : `${bad} differ.`}`)
process.exit(bad === 0 ? 0 : 1)
