#!/usr/bin/env node
/**
 * One sentence per line in the shared docs (v2.7498).
 *
 * `docs/GLOSSARY.md`, `docs/ACCESS_CONTROL.md` and `docs/LIEN_DESK_ARCHITECTURE.md` are amended by every PR on
 * their surfaces, and each entry was one physical line: 66 glossary lines ran past 3,000 characters and the
 * longest to 28,784. Git merges by line, so two PRs that amended different sentences of one entry conflicted,
 * and on 2026-11-16 the merge queue dropped one PR three times in an afternoon on these files alone.
 *
 * This breaks each prose line after every sentence. Markdown reads a line break inside a paragraph, a list item
 * or a block quote as a space, so the page draws the same and git can merge two amendments to one entry.
 * Mechanical and re-runnable (rebase rule: never hand-resolve its diff; `--resolve` merges a branch cut before
 * the sweep). The rule itself is scripts/lib/docSentenceLines.mjs: split only, never join, and never where the
 * break could change what Markdown draws. Table rows stay one line each: GFM allows nothing else.
 *
 * Usage: node scripts/codemods/doc-sentence-lines.mjs [--dry | --check | --resolve | --prove <rev>] [paths…]
 *   (none)         rewrites the files
 *   --dry          lists what it would split, writes nothing
 *   --check        the same, and exits 1 when a line holds two sentences or runs past its cap
 *   --resolve      after merging main into a branch cut before the sweep, whether git stopped on these docs or
 *                  settled them by itself (`-X ours`, one side's copy taken whole, the merge already committed):
 *                  splits the base and both sides, merges the three again and stages each doc that comes out
 *                  clean; exits 1 when a doc still conflicts, which means both sides changed the same sentence
 *                  or added one at the same spot, and leaves that one marked for a hand
 *   --prove <rev>  renders each file as it stands at <rev> and as it stands on disk, and exits 1 unless the two
 *                  pages are the same HTML once runs of white space outside <pre> are folded to one space
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { longLines, reflowDocument } from '../lib/docSentenceLines.mjs'

/** The docs under the rule. A doc joins the list in the PR that sweeps it. */
const FILES = ['docs/GLOSSARY.md', 'docs/ACCESS_CONTROL.md', 'docs/LIEN_DESK_ARCHITECTURE.md']

/**
 * The longest line the check lets through. A sentence past the prose cap is rewritten as two; a table row past
 * the table cap moves its detail into a paragraph under the table. Both sit just over the longest line the
 * sweep left, so nothing grows past what is there now.
 */
const CAPS = { prose: 2400, table: 4800 }

const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const DRY = CHECK || argv.includes('--dry')
const RESOLVE = argv.includes('--resolve')
const proveAt = argv.indexOf('--prove')
const PROVE = proveAt === -1 ? null : argv[proveAt + 1]
const paths = argv.filter((a, i) => !a.startsWith('--') && (proveAt === -1 || i !== proveAt + 1))
const files = paths.length > 0 ? paths : FILES

/** A page's HTML with white space folded outside <pre>, where Markdown's line breaks are spaces. */
function folded(html) {
  return html
    .split(/(<pre[\s\S]*?<\/pre>)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\s+/g, ' ')))
    .join('')
}

if (PROVE) {
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  const { marked } = require('marked')
  let differ = 0
  for (const file of files) {
    const before = execFileSync('git', ['show', `${PROVE}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
    const after = readFileSync(file, 'utf8')
    const a = folded(marked.parse(before, { gfm: true }))
    const b = folded(marked.parse(after, { gfm: true }))
    if (a === b) {
      console.log(`same page: ${file} (${a.length.toLocaleString('en-US')} characters of HTML at ${PROVE} and on disk)`)
      continue
    }
    differ++
    let at = 0
    while (at < a.length && a[at] === b[at]) at++
    console.log(`DIFFERENT: ${file}, first at character ${at}`)
    console.log(`  ${PROVE}: …${a.slice(Math.max(0, at - 80), at + 120)}…`)
    console.log(`  on disk: …${b.slice(Math.max(0, at - 80), at + 120)}…`)
  }
  process.exit(differ > 0 ? 1 : 0)
}

if (RESOLVE) {
  const git = (args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })
  const commitOf = (name) => {
    const r = git(['rev-parse', '--verify', '--quiet', `${name}^{commit}`])
    return r.status === 0 ? r.stdout.trim() : null
  }
  const show = (spec) => {
    const r = git(['show', spec])
    return r.status === 0 ? r.stdout : null
  }
  // The merge being resolved: one stopped part way (MERGE_HEAD), or one just committed (HEAD has two parents).
  // The second is how a merge that git settled by itself (`-X ours`, one side's copy taken whole) is found again.
  const mergeHead = commitOf('MERGE_HEAD')
  const merge = mergeHead
    ? { ours: commitOf('HEAD'), theirs: mergeHead, committed: false }
    : commitOf('HEAD^2')
      ? { ours: commitOf('HEAD^1'), theirs: commitOf('HEAD^2'), committed: true }
      : null
  const bases = merge ? git(['merge-base', '--all', merge.ours, merge.theirs]).stdout.split('\n').filter(Boolean) : []
  // Stages 1, 2 and 3 of an unmerged path are the base, this side and the other side.
  const unmerged = new Set(
    git(['ls-files', '-u', '--', ...files])
      .stdout.split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t')[1]),
  )
  const dir = mkdtempSync(path.join(tmpdir(), 'doc-lines-'))
  let stuck = 0
  let staged = 0

  /** Splits the three copies a sentence a line, merges them again, and stages the doc when it comes out clean. */
  const mergeSplit = (file, [ours, base, theirs], how) => {
    if ([ours, base, theirs].includes(null)) {
      console.log(`${file}: one side added or deleted the whole file, so this one is merged by hand`)
      stuck++
      return
    }
    const names = ['ours', 'base', 'theirs'].map((n) => path.join(dir, n))
    ;[ours, base, theirs].forEach((text, i) => writeFileSync(names[i], reflowDocument(text).text))
    const merged = git(['merge-file', '-p', '-L', 'ours', '-L', 'base', '-L', 'theirs', ...names])
    if (merged.status === null || merged.status < 0 || merged.status > 126) {
      console.log(`${file}: git merge-file failed: ${merged.stderr.trim()}`)
      stuck++
      return
    }
    writeFileSync(file, merged.stdout)
    if (merged.status === 0) {
      execFileSync('git', ['add', '--', file])
      staged++
      console.log(`${file}: ${how} and staged`)
    } else {
      stuck++
      console.log(`${file}: ${merged.status} place${merged.status === 1 ? '' : 's'} where both sides changed the same sentence, or added one at the same spot; marked in the file for a hand`)
    }
  }

  for (const file of files) {
    if (unmerged.has(file)) {
      mergeSplit(file, [2, 1, 3].map((stage) => show(`:${stage}:${file}`)), 'merged a sentence a line')
      continue
    }
    const { text, split } = reflowDocument(readFileSync(file, 'utf8'))
    if (split.length === 0) continue
    if (merge && bases.length === 1) {
      // Git settled this doc by itself and it still holds a line with two sentences: one side's copy of an entry
      // won whole, and the other side's sentences in it are gone. Merge it again from the merge's own copies,
      // unless someone has changed it since the merge: that change is theirs to keep.
      if (git(['diff', '--quiet', ...(merge.committed ? ['HEAD'] : []), '--', file]).status !== 0) {
        console.log(`${file}: changed since the merge, so this one is merged by hand (or set the change aside and run this again)`)
        stuck++
        continue
      }
      mergeSplit(file, [merge.ours, bases[0], merge.theirs].map((rev) => show(`${rev}:${file}`)), 'merged again from both sides, a sentence a line,')
    } else if (merge) {
      console.log(`${file}: the merge has ${bases.length === 0 ? 'no' : 'more than one'} merge base, so this one is merged by hand`)
      stuck++
    } else {
      // No merge to read: a whole entry written as one line is split where it stands.
      writeFileSync(file, text)
      execFileSync('git', ['add', '--', file])
      staged++
      console.log(`${file}: ${split.length} line${split.length === 1 ? '' : 's'} split and staged`)
    }
  }
  rmSync(dir, { recursive: true, force: true })
  if (staged === 0 && stuck === 0) console.log('Nothing to resolve: these docs hold one sentence a line.')
  if (staged > 0 && merge?.committed) console.log('The merge itself is already committed, so commit these docs on top of it.')
  process.exit(stuck > 0 ? 1 : 0)
}

let left = 0
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const { text, split } = reflowDocument(source)
  if (split.length > 0) {
    const pieces = split.reduce((n, s) => n + s.pieces, 0)
    console.log(`${file}: ${split.length} line${split.length === 1 ? '' : 's'} ${DRY ? (split.length === 1 ? 'holds' : 'hold') : 'held'} more than one sentence${DRY ? '' : `, now ${pieces} lines`}`)
    if (DRY) {
      for (const s of split.slice(0, 20)) console.log(`  ${file}:${s.line}  ${s.pieces} sentences  ${s.starts}…`)
      if (split.length > 20) console.log(`  … and ${split.length - 20} more`)
      left += split.length
    } else writeFileSync(file, text)
  }
  if (CHECK) {
    const long = longLines(text, CAPS)
    for (const l of long) {
      console.log(`  ${file}:${l.line}  ${l.length.toLocaleString('en-US')} characters, over the ${l.kind === 'table' ? 'table row' : 'sentence'} cap of ${CAPS[l.kind].toLocaleString('en-US')}  ${l.starts}…`)
    }
    left += long.length
  }
}
if (CHECK && left > 0) {
  console.log('\nA line in these docs holds one sentence, so two PRs that amend one entry still merge.')
  console.log('Fix: node scripts/codemods/doc-sentence-lines.mjs   (a line over its cap is rewritten by hand: two sentences, or a table cell moved under the table)')
  console.log('Right after merging main into a branch: node scripts/codemods/doc-sentence-lines.mjs --resolve, which merges these docs again a sentence a line so neither side loses one')
  process.exit(1)
}
if (CHECK) console.log(`${files.length} doc${files.length === 1 ? '' : 's'}: one sentence a line, none over its cap`)
