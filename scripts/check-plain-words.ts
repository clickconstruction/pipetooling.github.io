#!/usr/bin/env vite-node
/**
 * `npm run check:plain-words` — a help guide this change touches must read by the
 * plain-words rules (`src/lib/plainWords.ts`; the convention since v2.4233). A touched guide
 * still on `LEGACY_PLAIN_WORDS_GUIDES` fails: rewrite it by the rules and remove its row.
 * Exit 1 on an error (CI). Nothing is written.
 *
 * What counts as touched: the guides that differ from the base of this change. In CI on a
 * pull request or a merge-queue build, HEAD is the merge of the change into its base, so
 * the base is HEAD's first parent (one `--deepen=1` away on a shallow checkout). Locally,
 * the merge base with `origin/main`. On a push to main there is nothing to compare — the
 * PR gate already ran this — so the check passes.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { helpGuidePlainWordsFailures } from '../src/lib/plainWords'
import { LEGACY_PLAIN_WORDS_GUIDES } from '../src/lib/plainWordsLegacy'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GUIDES = 'src/content/help'

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

function main(): void {
  const base = baseRef()
  if (!base) {
    console.log('check-plain-words: nothing to compare against (a push to main, or no base reachable) — the PR gate holds the rule.')
    return
  }
  const changed = (tryGit(`diff --name-only --diff-filter=AMR ${base.ref} HEAD -- ${GUIDES}`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => f.endsWith('.md'))
  if (changed.length === 0) {
    console.log(`check-plain-words OK: no help guide changed against ${base.how}.`)
    return
  }
  const errors: string[] = []
  for (const file of changed) {
    const slug = basename(file, '.md')
    if (LEGACY_PLAIN_WORDS_GUIDES.has(slug)) {
      errors.push(`${file} changed but is still on LEGACY_PLAIN_WORDS_GUIDES (src/lib/plainWordsLegacy.ts): rewrite it by the plain-words rules and remove its row.`)
      continue
    }
    const failures = helpGuidePlainWordsFailures(readFileSync(resolve(ROOT, file), 'utf8'))
    for (const f of failures) errors.push(`${file}: ${f}`)
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`  ERROR  ${e}`)
    console.error(`check-plain-words: ${errors.length} error(s) in ${changed.length} changed guide(s). The rules: src/lib/plainWords.ts.`)
    process.exit(1)
  }
  console.log(`check-plain-words OK: ${changed.length} changed guide(s) read in plain words (against ${base.how}).`)
}

main()
