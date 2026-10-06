#!/usr/bin/env vite-node
/**
 * `npm run check:pronouns` — a WARNING, never a failure (the owner's call, 2026-10-06). For each
 * help guide this change touches, it prints the sentences that open on a bare pronoun pointing
 * back across a full stop ("It shows…", "That means…"), and the paragraphs that open a second
 * sentence on "So", the rule that can fail later. The finder and its reasons are in
 * `src/lib/pronounOpeners.ts`. Repeat the noun where the pronoun could mean more than one thing;
 * leave it where it cannot.
 *
 * In GitHub Actions each finding is also a `::warning` on its line, so it shows on the pull
 * request's Files tab. GitHub draws ten per step; the log keeps every one. Always exits 0, even
 * when something goes wrong inside, so it can never hold a merge.
 *
 * What counts as touched: the guides that differ from the base of this change, read the way the
 * deleted `check-plain-words.ts` read them (v2.4613). In CI on a pull request or a merge-queue
 * build, HEAD is the merge of the change into its base, so the base is HEAD's first parent. Locally,
 * the merge base with `origin/main`. On a push to main there is nothing to compare.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { helpGuidePronounOpeners, type PronounOpener } from '../src/lib/pronounOpeners'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GUIDES = 'src/content/help'
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

const RULE_LABEL: Record<PronounOpener['rule'], string> = {
  pronoun: 'opens on a pronoun',
  so: 'a second "So" in one paragraph (this one can fail later)',
}

/** What to do about it, for the Files tab. */
const RULE_ADVICE: Record<PronounOpener['rule'], string> = {
  pronoun: 'Repeat the noun if the pronoun could mean more than one thing.',
  so: 'Join it to the sentence before with ", so" if both fit in 20 words, or drop the So.',
}

function main(): void {
  const base = baseRef()
  if (!base) {
    console.log('check-pronouns: nothing to compare against (a push to main, or no base reachable).')
    return
  }
  const changed = (tryGit(`diff --name-only --diff-filter=AMR ${base.ref} HEAD -- ${GUIDES}`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => f.endsWith('.md'))
  if (changed.length === 0) {
    console.log(`check-pronouns: no help guide changed against ${base.how}.`)
    return
  }
  const inActions = process.env.GITHUB_ACTIONS === 'true'
  let total = 0
  let annotated = 0
  for (const file of changed) {
    const found = helpGuidePronounOpeners(readFileSync(resolve(ROOT, file), 'utf8'))
    if (found.length === 0) continue
    console.log(`\n${file}: ${found.length}`)
    for (const f of found) {
      total++
      console.log(`  line ${String(f.line).padStart(3)}  ${RULE_LABEL[f.rule]}: ${f.sentence}`)
      if (inActions && annotated < ANNOTATIONS_SHOWN) {
        annotated++
        console.log(`::warning file=${escapeProperty(file)},line=${f.line},title=${escapeProperty(f.rule === 'so' ? 'One So per paragraph' : 'Pronoun opener')}::${escapeData(`${f.sentence} ${RULE_ADVICE[f.rule]}`)}`)
      }
    }
  }
  if (total === 0) {
    console.log(`check-pronouns: ${changed.length} changed guide(s), no sentence opens on a bare pronoun (against ${base.how}).`)
    return
  }
  const more = inActions && total > annotated ? ` The Files tab shows the first ${annotated}; every one is above.` : ''
  console.log(`\ncheck-pronouns: ${total} finding(s) in ${changed.length} changed guide(s), against ${base.how}. A warning, not a failure: repeat the noun where the pronoun could mean more than one thing.${more} The rule: src/lib/pronounOpeners.ts.`)
}

try {
  main()
} catch (e) {
  console.log(`check-pronouns: skipped (${e instanceof Error ? e.message : String(e)}). It only warns, so nothing is held.`)
}
process.exit(0)
