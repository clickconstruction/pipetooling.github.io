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
 *
 * Since 2026-11-25 ci.yml is three jobs (the static checks, the tests in legs, and the `checks` gate branch
 * protection requires), so three more things can drift without a red run, and this fails CI on each:
 *   - a job of ci.yml that typechecks or lints without restoring the cache first, or by another key;
 *   - the `checks` gate missing, not running under always(), or not needing every other job of ci.yml and
 *     asking each for 'success': a leg outside the gate could fail and the build still merge;
 *   - the merge queue's shard list not being every shard of one count ("1/3", "2/3", "3/3"), or no step running
 *     `--shard=${{ matrix.part }}`: a missing shard is a part of the suite no build runs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function workflowLines(file) {
  return fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8').split('\n')
}

const indentOf = (l) => /^\s*/.exec(l)[0].length

/** The `key:` and `restore-keys:` entries of every `uses: actions/cache/<action>@…` step in a workflow, with its line. */
function cacheSteps(file, action) {
  const lines = workflowLines(file)
  const uses = new RegExp(`^\\s+uses:\\s+actions/cache/${action}@`)
  const found = lines.flatMap((l, i) => (uses.test(l) ? [i] : []))
  if (found.length === 0) throw new Error(`${file}: no actions/cache/${action} step`)
  return found.map((at) => ({ ...cacheStepAt(file, action, lines, at), line: at }))
}

/** The first such step. */
function cacheStep(file, action) {
  return cacheSteps(file, action)[0]
}

function cacheStepAt(file, action, lines, at) {
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

/** A workflow's jobs: `[{ id, start, end, lines }]`, `start` and `end` being line indexes in the file. */
function jobsOf(file) {
  const lines = workflowLines(file)
  const at = lines.findIndex((l) => /^jobs:\s*$/.test(l))
  if (at === -1) return []
  const jobs = []
  for (let i = at + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) break
    const m = /^ {2}([\w-]+):\s*$/.exec(lines[i])
    if (!m) continue
    if (jobs.length) jobs[jobs.length - 1].end = i
    jobs.push({ id: m[1], start: i, end: lines.length })
  }
  return jobs.map((j) => ({ ...j, lines: lines.slice(j.start, j.end) }))
}

/** What ci.yml's gate and legs must hold. Returns the problems, [] when sound. */
function ciJobProblems() {
  const out = []
  const jobs = jobsOf('ci.yml')
  const restores = cacheSteps('ci.yml', 'restore')

  // A job that typechecks or lints restores the cache first.
  for (const job of jobs) {
    const first = job.lines.findIndex((l) => /^\s+run:\s+npm run (typecheck|lint)\s*$/.test(l))
    if (first === -1) continue
    const restored = restores.some((r) => r.line > job.start && r.line < job.start + first)
    if (!restored) out.push(`ci.yml: the job "${job.id}" typechecks or lints without restoring the cache warm-caches.yml saves, so it runs cold every time.`)
  }

  // The gate.
  const gate = jobs.find((j) => j.id === 'checks')
  if (!gate) {
    out.push('ci.yml has no job named "checks". Branch protection requires that name; without it no pull request can merge.')
  } else {
    const others = jobs.filter((j) => j.id !== 'checks').map((j) => j.id)
    if (others.length === 0) out.push('ci.yml: "checks" is the only job. Since 2026-11-25 it is the gate over the legs that do the work.')
    const needsLine = gate.lines.find((l) => /^\s+needs:/.test(l)) ?? ''
    const needs = (/\[(.*)\]/.exec(needsLine)?.[1] ?? needsLine.replace(/^\s+needs:/, '')).split(',').map((x) => x.trim()).filter(Boolean)
    const ifAt = gate.lines.findIndex((l) => /^\s+if:/.test(l))
    const condition = ifAt === -1 ? '' : gate.lines.slice(ifAt, ifAt + 6).join(' ')
    if (!condition.includes('always()')) {
      out.push('ci.yml: the "checks" gate does not run under always(). Without it a failed leg skips the gate, and a skipped required check passes.')
    }
    for (const id of others) {
      if (!needs.includes(id)) out.push(`ci.yml: the "checks" gate does not need the job "${id}", so that job can fail and the build still merge.`)
      if (!condition.includes(`needs.${id}.result == 'success'`)) out.push(`ci.yml: the "checks" gate does not ask needs.${id}.result == 'success', so a failed or cancelled "${id}" would pass.`)
    }
    if (!gate.lines.some((l) => /^\s+exit 1\s*$/.test(l))) out.push('ci.yml: the "checks" gate has no `exit 1`. It runs only when a leg did not pass, and must fail then.')
  }

  // The shards.
  const all = workflowLines('ci.yml')
  const partLine = all.find((l) => /^\s+part:\s/.test(l) && l.includes('merge_group'))
  const list = partLine ? /merge_group'\s*&&\s*'(\[[^']*\])'/.exec(partLine)?.[1] : null
  let shards = null
  try {
    shards = list ? JSON.parse(list) : null
  } catch {
    shards = null
  }
  if (!Array.isArray(shards) || shards.length === 0) {
    out.push("ci.yml: no `part:` matrix line gives the merge queue its shards (github.event_name == 'merge_group' && '[\"1/3\", \"2/3\", \"3/3\"]').")
  } else {
    const n = shards.length
    const want = Array.from({ length: n }, (_, i) => `${i + 1}/${n}`)
    if (JSON.stringify([...shards].sort()) !== JSON.stringify([...want].sort())) {
      out.push(`ci.yml: the merge queue's shards are ${JSON.stringify(shards)}, not every shard of ${n} (${JSON.stringify(want)}), so part of the suite runs in no build.`)
    }
    if (!all.some((l) => /^\s+run:\s+npx vitest run --shard=\$\{\{ matrix\.part \}\}\s*$/.test(l))) {
      out.push('ci.yml: no step runs `npx vitest run --shard=${{ matrix.part }}`, so the merge queue runs no shard of the suite.')
    }
  }
  return { problems: out, jobs: jobs.map((j) => j.id), shards: Array.isArray(shards) ? shards.length : 0, restores }
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
const ci = ciJobProblems()
problems.push(...ci.problems)
for (const step of ci.restores) {
  if (step.key !== save.key) problems.push(`ci.yml line ${step.line + 1} restores the cache by a key warm-caches.yml does not save by:\n    ${step.key}\n    ${save.key}`)
}
for (const [file, step] of [
  ...ci.restores.map((step) => ['ci.yml', step]),
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
  `workflow parity OK: ci.yml restores the cache warm-caches.yml saves (${restore.restoreKeys.length + warmRestore.restoreKeys.length} restore-keys prefixes), warm-caches.yml runs on push to main, ci.yml does not; the "checks" gate needs every other job (${ci.jobs.filter((j) => j !== 'checks').join(', ')}), and the merge queue runs ${ci.shards} shards.`,
)
