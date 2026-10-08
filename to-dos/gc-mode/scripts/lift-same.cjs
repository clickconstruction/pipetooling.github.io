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
 * It prints a table for the PR body, and exits 1 when anything differs. A file a lift appends to (and
 * `append` types) is compared on every declaration it shares with the spike's file: what an earlier
 * lift moved, re-exported on the spike since its follow-up, is main's alone (the schedule's 1b-i).
 *
 * Once a lift has merged, its follow-up pins the config to its pair (2026-10-07, the lead's gate):
 * `"pin": { "main": <the lift's merge commit on main>, "spike": <the spike just before its follow-up> }`.
 * A pinned config with no spike ref given reads main at `pin.main` through git, not from disk, so main's
 * later edits to a lifted file (a new filter, a new refusal) never show as a difference. An inequality the
 * pair already had, explained, goes in `pin.known` as `{ "<declaration>": "<why>" }`: it is reported,
 * not counted, and a known one that has become equal is reported too. `superseded` marks a config that
 * never merged as one lift. Every config at once, the release helper's check:
 *
 *   node to-dos/gc-mode/scripts/lift-same.cjs --all
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript'))
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('usage: node lift-same.cjs <lift.json> [spike ref] | --all')
  process.exit(2)
}
// Git runs in the repository (LIFT_REPO when main's files are checked out somewhere else).
const repo = process.env.LIFT_REPO ?? root
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const short = (ref) => git('rev-parse', '--short', ref).trim()

const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true)
/** A file at a commit, or null when the commit has no such file. */
function atRef(ref, rel) {
  try {
    return parse(rel, execFileSync('git', ['-C', repo, 'show', `${ref}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch {
    return null
  }
}

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
/** Every it(...) or test(...) in a file, by its title: a title several tests share keeps them all, in the file's order. */
function testsOf(sf) {
  const m = new Map()
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['it', 'test'].includes(n.expression.text) && n.arguments.length >= 2) {
      const title = n.arguments[0].getText(sf)
      m.set(title, [...(m.get(title) ?? []), n])
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return m
}

/** One config against main and the spike. Returns its table, its known inequalities and how many differ. */
function compare(config, mainFile, spikeFile) {
  const spikeDir = config.spikeDir ?? 'src/lib/gcMode'
  const mainBase = config.mainBase ?? 'src/lib/gc'
  const known = config.pin?.known ?? {}
  const knownSeen = new Set()
  const rows = []
  let bad = 0
  /** False for an inequality the pair already had (pin.known): reported, not counted. */
  const keep = (n) => {
    if (!(n in known)) return true
    knownSeen.add(n)
    return false
  }
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
        if (Array.isArray(names) && !names.includes(n)) continue
        if (names === 'shared' && !sMap.has(n)) continue
        const o = sMap.get(n)
        if (!o) {
          if (keep(n)) differ.push(`${n} (not on the spike)`)
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
          if (keep(n)) differ.push(`${n} (fields: ${off.map((m) => m.name.getText(main)).join(', ')})`)
          continue
        }
        if (keep(n)) differ.push(n)
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
    const flat = (text) => text.replace(/^[ \t]+/gm, '')
    for (const [title, calls] of testsOf(main)) {
      const ours = theirs.get(title) ?? []
      // A moved test is the same when any spike test of its title is word for word it (the spike has titles in more than one describe).
      for (const call of calls) {
        if (ours.some((o) => flat(call.getText(main)) === flat(o.getText(spike)))) same++
        else differ.push(`${title}${ours.length ? '' : ' (not on the spike)'}`)
      }
    }
    bad += differ.length
    rows.push([mainRel, spikeRel, same, 0, differ.length, differ.join('; ')])
  }

  // A main file several entries write (planQuestions.ts from gcPlans and gcStageHealth) is checked per entry on the names its spike file has.
  const writers = (to) => config.files.filter((x) => x.to === to).length
  for (const e of config.files) check(path.join(mainBase, e.to), path.join(spikeDir, e.from + '.ts'), e.append || writers(e.to) > 1 ? 'shared' : null)
  for (const t of config.types || []) check(path.join(mainBase, t.to), path.join(spikeDir, (t.from ?? 'gcTypes') + '.ts'), t.whole ? (t.append ? 'shared' : null) : Object.keys(t.fields || {}))
  for (const t of config.tests || []) checkTests(path.join(mainBase, t.to), path.join(spikeDir, t.from))
  const knownNow = Object.entries(known).map(([n, why]) => ({ n, why, still: knownSeen.has(n) }))
  return { rows, bad, knownNow }
}

/** Main and the spike for a config: its pin, unless a spike ref is given (then main is on disk, as before pins). */
function sides(config, spikeRefArg) {
  if (config.pin?.main && config.pin?.spike && !spikeRefArg) {
    return { mainFile: (rel) => atRef(config.pin.main, rel), spikeFile: (rel) => atRef(config.pin.spike, rel) ?? parse(rel, ''), title: `main at ${short(config.pin.main)}, the spike at ${short(config.pin.spike)} (pinned)` }
  }
  const spikeRef = spikeRefArg ?? 'origin/spike/gc-mode'
  return {
    mainFile: (rel) => (fs.existsSync(path.join(root, rel)) ? parse(rel, fs.readFileSync(path.join(root, rel), 'utf8')) : null),
    spikeFile: (rel) => atRef(spikeRef, rel) ?? parse(rel, ''),
    title: `spike/gc-mode at ${short(spikeRef)}`,
  }
}

const knownWords = (knownNow) =>
  knownNow.map((k) => (k.still ? `Known: ${k.n}, ${k.why}` : `Known and now the same, so drop it from pin.known: ${k.n}`)).join('\n')

if (args[0] === '--all') {
  const dir = path.dirname(__filename)
  let total = 0
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.lift.json')).sort()) {
    const config = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (config.superseded) {
      console.log(`${f}: superseded, ${config.superseded}`)
      continue
    }
    if (!config.pin?.main || !config.pin?.spike) {
      console.log(`${f}: not pinned (its lift has not merged, or its follow-up has not pinned it)`)
      continue
    }
    const s = sides(config)
    const { rows, bad, knownNow } = compare(config, s.mainFile, s.spikeFile)
    total += bad
    const knownLine = knownNow.length ? ` (${knownNow.length} known)` : ''
    console.log(`${f}: ${bad === 0 ? 'the same' : `${bad} differ`}${knownLine}, ${s.title}`)
    for (const [m, , , , n, why] of rows) if (n) console.log(`  ${m}: ${why}`)
    for (const k of knownNow) if (!k.still) console.log(`  Known and now the same, so drop it from pin.known: ${k.n}`)
  }
  process.exit(total === 0 ? 0 : 1)
}

const [configPath, spikeRefArg] = args
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const s = sides(config, spikeRefArg)
const { rows, bad, knownNow } = compare(config, s.mainFile, s.spikeFile)
console.log(`Word for word: ${s.title} (to-dos/gc-mode/scripts/lift-same.cjs):\n`)
console.log('| On main | From the spike | The same | Trimmed, each field the same | Differs |')
console.log('|---|---|---|---|---|')
for (const [m, sp, same, trimmed, n, why] of rows) console.log(`| \`${m}\` | \`${path.basename(sp)}\` | ${same} | ${trimmed || ''} | ${n ? `${n}: ${why}` : 'none'} |`)
if (knownNow.length) console.log(`\n${knownWords(knownNow)}`)
console.log(`\n${bad === 0 ? 'Every declaration and test is the same as the spike’s.' : `${bad} differ.`}`)
process.exit(bad === 0 ? 0 : 1)
