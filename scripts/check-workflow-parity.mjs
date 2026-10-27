#!/usr/bin/env node
/**
 * Asserts that the typecheck and lint cache ci.yml restores is the one warm-caches.yml saves, and that the
 * checks run where the merge queue runs them and nowhere else.
 *
 * History. Until 2026-10-27 this script held the `checks` jobs of ci.yml and deploy.yml to the same multiset
 * of `run:` commands: deploy.yml ran its own copy of the checks on main, and a check present there but missing
 * from ci.yml (the timezone check, PR #649) merged green and then failed every deploy from v2.965 to v2.985.
 * deploy.yml now runs no check. Nothing reaches main except through the merge queue (the "main merge queue"
 * ruleset has no bypass actors), and the queue runs ci.yml's checks job on the merged content before it lands,
 * so there is one list of checks and no second list for it to drift from.
 *
 * What can still drift silently is the cache key. ci.yml restores `.cache` by a key and a restore-keys prefix,
 * warm-caches.yml saves it by a key, and the two files cannot share one expression (hashFiles is a step-level
 * function). A mismatch fails nothing: every typecheck and lint just goes cold again, about six minutes a run
 * over some three hundred runs a day. So this script fails CI when
 *   - the `key:` of ci.yml's actions/cache/restore step differs from the `key:` of warm-caches.yml's
 *     actions/cache/save step, or a `restore-keys:` entry in either file is not a prefix of that key;
 *   - warm-caches.yml does not run on push to main, the branch every other ref restores from;
 *   - ci.yml runs on push: that run repeated the queue's on main (28 minutes of runner time a merge).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function workflowLines(file) {
  return fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8').split('\n')
}

const indentOf = (l) => /^\s*/.exec(l)[0].length

/** The `key:` and `restore-keys:` entries of the first `uses: actions/cache/<action>@…` step in a workflow. */
function cacheStep(file, action) {
  const lines = workflowLines(file)
  const at = lines.findIndex((l) => new RegExp(`^\\s+uses:\\s+actions/cache/${action}@`).test(l))
  if (at === -1) throw new Error(`${file}: no actions/cache/${action} step`)
  let key = null
  const restoreKeys = []
  let restoreIndent = -1
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    if (/^\s+-\s+(name|uses|run):/.test(l) || /^  \w[\w-]*:\s*$/.test(l)) break
    if (restoreIndent >= 0 && indentOf(l) > restoreIndent) {
      restoreKeys.push(l.trim())
      continue
    }
    restoreIndent = -1
    const k = /^\s+key:\s+(.+?)\s*$/.exec(l)
    if (k) {
      key = k[1]
      continue
    }
    const r = /^(\s+)restore-keys:\s*(.*?)\s*$/.exec(l)
    if (r) {
      if (r[2] && r[2] !== '|') restoreKeys.push(r[2])
      else restoreIndent = r[1].length
    }
  }
  if (!key) throw new Error(`${file}: the actions/cache/${action} step has no key:`)
  return { key, restoreKeys }
}

/** Whether a workflow's `on:` block has `push:` with `branches:` listing main. */
function pushesToMain(file) {
  const lines = workflowLines(file)
  const on = lines.findIndex((l) => /^on:\s*$/.test(l))
  if (on === -1) return false
  let inPush = false
  let inBranches = false
  for (let i = on + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || /^\s*#/.test(l)) continue
    if (/^\S/.test(l)) break
    if (/^  push:\s*$/.test(l)) {
      inPush = true
      inBranches = false
      continue
    }
    if (/^  \S/.test(l)) {
      inPush = false
      inBranches = false
      continue
    }
    if (inPush && /^    branches:\s*$/.test(l)) {
      inBranches = true
      continue
    }
    if (inPush && inBranches && /^\s+-\s+['"]?main['"]?\s*$/.test(l)) return true
  }
  return false
}

/** Whether a workflow's `on:` block has a `push:` trigger at all. */
function hasPushTrigger(file) {
  const lines = workflowLines(file)
  const on = lines.findIndex((l) => /^on:\s*$/.test(l))
  if (on === -1) return false
  for (let i = on + 1; i < lines.length; i++) {
    const l = lines[i]
    if (/^\S/.test(l)) break
    if (/^  push:/.test(l)) return true
  }
  return false
}

const problems = []

const restore = cacheStep('ci.yml', 'restore')
const save = cacheStep('warm-caches.yml', 'save')
const warmRestore = cacheStep('warm-caches.yml', 'restore')

if (restore.key !== save.key) {
  problems.push(
    `ci.yml restores the cache by\n    ${restore.key}\n  but warm-caches.yml saves it by\n    ${save.key}\n  so no run would ever find it.`,
  )
}
for (const [file, step] of [
  ['ci.yml', restore],
  ['warm-caches.yml', warmRestore],
]) {
  if (step.restoreKeys.length === 0) problems.push(`${file}: the restore step has no restore-keys, so only a cache from this exact commit would ever be found.`)
  for (const prefix of step.restoreKeys) {
    if (!save.key.startsWith(prefix)) problems.push(`${file}: restore-keys entry is not a prefix of the key warm-caches.yml saves by:\n    ${prefix}\n    ${save.key}`)
  }
}
if (!pushesToMain('warm-caches.yml')) {
  problems.push('warm-caches.yml does not run on push to main; every other ref restores the cache main saved, so nothing would ever be warm.')
}
if (hasPushTrigger('ci.yml')) {
  problems.push(
    "ci.yml runs on push. Nothing reaches main except through the merge queue, which already ran this job on the merged content; a push run repeated it (28 minutes of runner time a merge until 2026-10-27). The caches are warmed by warm-caches.yml.",
  )
}

if (problems.length) {
  console.error('Workflow parity FAILED:')
  for (const p of problems) console.error(`- ${p}`)
  process.exit(1)
}
console.log(
  `workflow parity OK: ci.yml restores the cache warm-caches.yml saves (${restore.restoreKeys.length + warmRestore.restoreKeys.length} restore-keys prefixes), warm-caches.yml runs on push to main, ci.yml does not.`,
)
