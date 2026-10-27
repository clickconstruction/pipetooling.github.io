#!/usr/bin/env vite-node
/**
 * `npm run check:empty-words` (punch list #184, sweep C): an empty state names the next press. For
 * each `src/**\/*.tsx` this change touches (never a test), it reads the bare empty sentences a
 * component writes straight into its markup (`src/lib/emptyStateCheck.ts`: a JSX text or a string
 * literal child that opens on No, Nothing, None or Nobody and names no press, outside an
 * `<EmptyState>`). A finding on a line this change wrote FAILS (exit 1, a `::error` on its line in
 * GitHub Actions); a finding on a line the change left alone is only counted ("N more on unchanged
 * lines"), so the legacy sentences never block a PR and `-- --all` lists them too.
 *
 * What counts as touched: the files that differ from the base of this change, read the way
 * `check-pronoun-openers.ts` reads the guides. In CI on a pull request or a merge-queue build, HEAD
 * is the merge of the change into its base, so the base is HEAD's first parent. Locally, the merge
 * base with `origin/main`. On a push to main there is nothing to compare.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BARE_EMPTY_ADVICE, bareEmptyOnChangedLines, bareEmptySentences } from '../src/lib/emptyStateCheck'
import { changedLinesFromDiff } from '../src/lib/pronounOpeners'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = 'src'
const ANNOTATIONS_SHOWN = 10

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function tryGit(cmd: string): string | null {
  try {
    return git(cmd)
  } catch {
    return null
  }
}

/** The base to compare against, or null when there is nothing to compare. */
function baseRef(): { ref: string; how: string } | null {
  const event = process.env.GITHUB_EVENT_NAME
  if (event === 'push') return null
  if (event === 'pull_request' || event === 'merge_group') {
    tryGit('fetch -q --deepen=1')
    if (tryGit('rev-parse --verify HEAD^2') !== null) return { ref: 'HEAD^1', how: "the merge's first parent" }
  }
  if (tryGit('rev-parse --verify origin/main') === null) tryGit('fetch -q origin main')
  const base = tryGit('merge-base origin/main HEAD')
  if (base) return { ref: base, how: 'the merge base with origin/main' }
  if (tryGit('rev-parse --verify origin/main') !== null) return { ref: 'origin/main', how: 'origin/main (no merge base reachable)' }
  return null
}

/** GitHub's annotation text: one line, its special characters escaped. */
const escapeData = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escapeProperty = (s: string) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')

/** A component source, never a test. */
const isComponentSource = (f: string) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')

function main(): number {
  const base = baseRef()
  if (!base) {
    console.log('check-empty-words: nothing to compare against (a push to main, or no base reachable).')
    return 0
  }
  const changed = (tryGit(`diff --name-only --diff-filter=AMR ${base.ref} HEAD -- ${SOURCES}`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(isComponentSource)
  if (changed.length === 0) {
    console.log(`check-empty-words: no component changed against ${base.how}.`)
    return 0
  }
  const inActions = process.env.GITHUB_ACTIONS === 'true'
  const all = process.argv.includes('--all')
  let failing = 0
  let elsewhereTotal = 0
  let annotated = 0
  for (const file of changed) {
    const everything = bareEmptySentences(readFileSync(resolve(ROOT, file), 'utf8'), file)
    const split = bareEmptyOnChangedLines(everything, changedLinesFromDiff(tryGit(`diff -U0 ${base.ref} HEAD -- ${file}`) ?? ''))
    const listed = all ? everything : split.onChanged
    const elsewhere = all ? 0 : split.elsewhere
    elsewhereTotal += elsewhere
    failing += split.onChanged.length
    if (listed.length === 0 && elsewhere === 0) continue
    console.log(`\n${file}: ${split.onChanged.length} on the lines this change wrote${elsewhere > 0 ? ` · ${elsewhere} more on unchanged lines` : ''}`)
    const changedLines = new Set(split.onChanged.map((f) => f.line))
    for (const f of listed) {
      const wrote = changedLines.has(f.line)
      console.log(`  line ${String(f.line).padStart(4)}  ${wrote ? 'FAIL' : 'old '}  ${f.text}`)
      if (inActions && wrote && annotated < ANNOTATIONS_SHOWN) {
        annotated++
        console.log(`::error file=${escapeProperty(file)},line=${f.line},title=${escapeProperty('Bare empty state')}::${escapeData(`${f.text} ${BARE_EMPTY_ADVICE}`)}`)
      }
    }
  }
  const untouched = elsewhereTotal > 0 ? ` ${elsewhereTotal} more sit on lines this change left alone; \`npm run check:empty-words -- --all\` lists them.` : ''
  if (failing === 0) {
    console.log(`\ncheck-empty-words: ${changed.length} changed component(s), no bare empty sentence on the lines this change wrote (against ${base.how}).${untouched}`)
    return 0
  }
  const more = inActions && failing > annotated ? ` The Files tab shows the first ${annotated}; every one is above.` : ''
  console.log(`\ncheck-empty-words: ${failing} bare empty sentence(s) on the lines this change wrote, in ${changed.length} changed component(s), against ${base.how}.${more}${untouched}\n${BARE_EMPTY_ADVICE}`)
  return 1
}

try {
  process.exit(main())
} catch (e) {
  console.log(`check-empty-words: could not run (${e instanceof Error ? e.message : String(e)}).`)
  process.exit(1)
}
