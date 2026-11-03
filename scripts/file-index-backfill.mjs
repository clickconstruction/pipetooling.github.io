#!/usr/bin/env node
/**
 * The one-time backfill of our own file index (punch list #240, v2.6343): walks every job's and bid's Drive folders
 * through `drive-link`'s `index_job` (PR 1, v2.6319) as the dev, the same door the job window's Index this job's
 * files presses, round after round per home until the function says nothing remains, a pause between calls so the
 * function and Drive breathe (one home at a time as it ships; --workers for more). Every row is written by the
 * function as it goes, so a stopped run loses nothing: the state file marks the homes done and a second run skips
 * them, and the function skips every file already current. An agent session runs it once (the card's rule); the
 * ten-minute sweep keeps the index current after.
 *
 *   node scripts/file-index-backfill.mjs --scope zz --dry-run       the ZZ test homes it would walk, no call
 *   node scripts/file-index-backfill.mjs --scope zz                 the dry run on the ZZ test jobs and bids
 *   node scripts/file-index-backfill.mjs --scope live               the live jobs, oldest number first
 *   node scripts/file-index-backfill.mjs --scope all --workers 2    live jobs, then bids, then paid jobs, two at a time
 *
 * Signs in as the dev-login identity with the secret in `.env.local` (the steps `scripts/lib/paySession.ts` takes), so
 * RLS, the office check and the training-mode block apply as in the app; never the service key from a laptop. The
 * log keeps each home's counts and held files on this computer (`.claude/scratch/`, gitignored); the terminal and the
 * card get counts alone, never a file's name. The rules are pure in `scripts/lib/fileIndexBackfill.mjs`.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  USAGE,
  addRound,
  answerOf,
  emptyTally,
  homeLabel,
  homeOutcome,
  homeRef,
  homesFor,
  homesLeft,
  parseArgs,
  recordOutcome,
  refusalWords,
  retryable,
  roundWords,
  summaryWords,
  totalsOf,
  wantsAnotherRound,
} from './lib/fileIndexBackfill.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_LOGIN_EMAIL = 'robert@douglasmining.com'
/** The back-off after the platform's own refusal. */
const BACKOFF_MS = 5000
const RETRIES = 3

function readEnvLocal() {
  const candidates = [join(ROOT, '.env.local'), join(ROOT, '..', '..', '..', '.env.local')]
  const file = candidates.find((p) => existsSync(p))
  if (!file) throw new Error('.env.local not found beside the repo or in the main checkout')
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  )
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Mint a magic link and verify it in one go; a sibling's mint for the same account kills ours, so three tries. */
async function signIn(env) {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const secret = env.VITE_DEV_LOGIN_SECRET
  if (!url || !anon || !secret) throw new Error('.env.local needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET')
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: true } })
  let last = 'no try'
  for (let i = 0; i < RETRIES; i++) {
    const res = await fetch(`${url}/functions/v1/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon, 'X-Dev-Login-Secret': secret },
      body: JSON.stringify({ email: DEV_LOGIN_EMAIL, redirectTo: 'http://localhost:5173/' }),
    })
    if (!res.ok) throw new Error(`dev-login refused (${res.status}): the secret in .env.local may be stale`)
    const { action_link } = await res.json()
    const tokenHash = action_link ? new URL(action_link).searchParams.get('token') : null
    if (!tokenHash) throw new Error('dev-login returned no action link')
    const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (!error) {
      const { data } = await supabase.auth.getUser()
      console.log(`signed in as ${data.user?.email ?? '?'}`)
      return supabase
    }
    last = error.message
    await sleep(1500)
  }
  throw new Error(`the magic link did not verify after ${RETRIES} tries: ${last}`)
}

/** Every job and bid with a folder link, as the dev reads them. */
async function readHomes(supabase, scope) {
  const [jobs, bids] = await Promise.all([
    supabase.from('jobs_ledger').select('id, hcp_number, job_name, customer_name, status, google_drive_link').not('google_drive_link', 'is', null).limit(5000),
    supabase.from('bids').select('id, bid_number, project_name, drive_link').not('drive_link', 'is', null).limit(5000),
  ])
  if (jobs.error) throw new Error(`the jobs did not read: ${jobs.error.message}`)
  if (bids.error) throw new Error(`the bids did not read: ${bids.error.message}`)
  return homesFor(jobs.data ?? [], bids.data ?? [], scope)
}

/** One call to index_job; the platform's own refusal is tried again, the function's words are the home's refusal. */
async function indexRound(supabase, home, retry) {
  let last = null
  for (let i = 0; i < RETRIES; i++) {
    const r = await supabase.functions.invoke('drive-link', { body: { action: 'index_job', job: homeRef(home), retry } })
    if (!r.error) return { ok: true, answer: answerOf(r.data) }
    const ctx = r.error.context
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    last = { status, words: refusalWords(status, body) || r.error.message }
    if (!retryable(status)) return { ok: false, ...last }
    await sleep(BACKOFF_MS * (i + 1))
  }
  return { ok: false, ...last }
}

/** A home, round after round, to its outcome line. */
async function walkHome(supabase, home, retry, pauseMs) {
  const started = Date.now()
  let tally = emptyTally()
  while (true) {
    const r = await indexRound(supabase, home, retry)
    if (!r.ok) {
      console.log(`${homeLabel(home)}: refused, ${r.words}`)
      return homeOutcome(home, tally, Date.now() - started, r.words)
    }
    tally = addRound(tally, r.answer)
    console.log(roundWords(home, tally))
    if (!wantsAnotherRound(tally)) break
    await sleep(pauseMs)
  }
  return homeOutcome(home, tally, Date.now() - started, null)
}

function loadState(path) {
  if (!existsSync(path)) return { done: {} }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { done: {} }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  const scratch = join(ROOT, '.claude', 'scratch')
  mkdirSync(scratch, { recursive: true })
  const statePath = args.state ?? join(scratch, `file-index-backfill.${args.scope}.state.json`)
  const logPath = args.log ?? join(scratch, `file-index-backfill.${args.scope}.log.jsonl`)

  const env = readEnvLocal()
  const supabase = await signIn(env)
  let homes = await readHomes(supabase, args.scope)
  if (args.home) homes = homes.filter((h) => h.id === args.home)
  if (args.limit) homes = homes.slice(0, args.limit)
  const state = loadState(statePath)
  const left = homesLeft(homes, Object.keys(state.done ?? {}), args.again)
  const jobs = homes.filter((h) => h.kind === 'job').length
  console.log(`${homes.length} homes in scope ${args.scope} (${jobs} jobs, ${homes.length - jobs} bids); ${left.length} to walk, ${homes.length - left.length} done before`)
  if (args.dryRun) {
    for (const h of left.slice(0, 12)) console.log(`  ${homeLabel(h)}`)
    if (left.length > 12) console.log(`  and ${left.length - 12} more`)
    return
  }
  if (!state.startedAt) state.startedAt = new Date().toISOString()
  state.scope = args.scope
  state.done = state.done ?? {}

  const queue = [...left]
  const outcomes = []
  const worker = async () => {
    while (queue.length > 0) {
      const home = queue.shift()
      const out = await walkHome(supabase, home, args.retry, args.pauseMs)
      if (queue.length > 0) await sleep(args.pauseMs)
      outcomes.push(out)
      appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), ...out }) + '\n')
      Object.assign(state, recordOutcome(state, out))
      writeFileSync(statePath, JSON.stringify(state, null, 1))
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.workers, queue.length) }, worker))

  const run = totalsOf(outcomes)
  const whole = totalsOf([...Object.values(state.done), ...Object.values(state.stopped ?? {})])
  console.log(`\nThis run: ${summaryWords(run)}`)
  console.log(`Scope so far: ${summaryWords(whole)}`)
  state.summary = { at: new Date().toISOString(), ...whole }
  writeFileSync(statePath, JSON.stringify(state, null, 1))
  console.log(`log: ${logPath}\nstate: ${statePath}`)
}

main().catch((e) => {
  console.error(String((e && e.message) || e))
  process.exit(1)
})
