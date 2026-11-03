/**
 * The one-time backfill of our own file index (punch list #240, v2.6343): the pure rules of
 * `scripts/file-index-backfill.mjs`, which walks every job's and bid's Drive folders through `drive-link`'s
 * `index_job` (PR 1, v2.6319) as the dev, round after round per home until nothing remains. Plain JS with no
 * imports, so `src/lib/documents/fileIndexBackfill.test.ts` reads it as the runner does: which homes a scope walks
 * and in what order, how a home's rounds add up, what a held file's reason counts as, what the log line and the
 * summary say (counts only, never a file's name), and how a stopped run resumes.
 */

/** The scopes the runner takes: the ZZ test homes (the dry run), the live jobs, the bids, the paid jobs, or all three in that order. */
export const SCOPES = ['zz', 'live', 'bids', 'paid', 'all']

/** How many rounds one home gets at most: forty files a round, so 2,400 files. */
/** The pause between one home's calls as it ships: a few seconds, as the deep-search session asked. */
export const PAUSE_MS = 2000
export const MAX_ROUNDS = 60

/** The reasons a file's row has no text, as `file_index.text_why` names them. */
export const HELD_WHYS = ['scan', 'kind', 'big', 'slow', 'error']

/** The ZZ convention (`_shared/zzTestJob.ts`): a name that starts with ZZ, any case, after trimming. */
export function isZzName(name) {
  return /^zz/i.test(String(name ?? '').trim())
}

/** A job or bid row's folder link as the app keeps it: a Drive folder link or a bare id; anything else is no folder. */
export function hasFolderLink(link) {
  const t = String(link ?? '').trim()
  return /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[\w-]{20,}/.test(t) || /^[\w-]{20,}$/.test(t)
}

/** A job or bid number as a number for ordering; a blank or wordy number sorts last. */
function numberOf(s) {
  const n = Number(String(s ?? '').trim())
  return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : Number.POSITIVE_INFINITY
}

function byNumber(ascending) {
  return (a, b) => {
    const na = numberOf(a.number)
    const nb = numberOf(b.number)
    if (na !== nb) return ascending ? na - nb : nb - na
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/** A Pipeline job as a home: its number, its ZZ-ness (its own name or its customer's), its status and its folder. */
export function jobHome(j) {
  return { kind: 'job', id: j.id, number: String(j.hcp_number ?? '').trim(), zz: isZzName(j.job_name) || isZzName(j.customer_name), status: j.status ?? null, link: j.google_drive_link ?? null }
}

/** A bid as a home. */
export function bidHome(b) {
  return { kind: 'bid', id: b.id, number: String(b.bid_number ?? '').trim(), zz: isZzName(b.project_name), status: null, link: b.drive_link ?? null }
}

/**
 * The homes a scope walks, in order: `live` is every job with a folder not Paid in Full, oldest number first;
 * `bids` every bid with a folder, newest first; `paid` the Paid in Full jobs, newest first; `all` is live, then
 * bids, then paid; `zz` is every ZZ test home among them, jobs then bids. A row with no folder link is never a home.
 */
export function homesFor(jobs, bids, scope) {
  const jobHomes = jobs.map(jobHome).filter((h) => hasFolderLink(h.link))
  const bidHomes = bids.map(bidHome).filter((h) => hasFolderLink(h.link))
  const live = jobHomes.filter((h) => h.status !== 'paid').sort(byNumber(true))
  const paid = jobHomes.filter((h) => h.status === 'paid').sort(byNumber(false))
  const allBids = bidHomes.sort(byNumber(false))
  switch (scope) {
    case 'live':
      return live
    case 'bids':
      return allBids
    case 'paid':
      return paid
    case 'all':
      return [...live, ...allBids, ...paid]
    case 'zz':
      return [...live, ...paid, ...allBids].filter((h) => h.zz)
    default:
      throw new Error(`scope must be one of ${SCOPES.join(', ')}, got "${scope}"`)
  }
}

/** The `job` a call to `index_job` names. */
export function homeRef(home) {
  return home.kind === 'bid' ? { bid_id: home.id } : { jobs_ledger_id: home.id }
}

/** A home's label for the terminal: its kind and number, never a name. */
export function homeLabel(home) {
  return `${home.kind} ${home.number || home.id.slice(0, 8)}`
}

const str = (v) => (typeof v === 'string' ? v : null)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** The function's answer to `index_job`, read defensively: an unknown shape reads as nothing done and nothing left. */
export function answerOf(d) {
  const o = d && typeof d === 'object' ? d : {}
  const held = []
  for (const raw of Array.isArray(o.held) ? o.held : []) {
    const h = raw && typeof raw === 'object' ? raw : {}
    const why = HELD_WHYS.find((w) => w === h.why)
    if (typeof h.id === 'string' && why) held.push({ id: h.id, name: str(h.name) ?? h.id, why })
  }
  return { indexed: num(o.indexed), held, remaining: num(o.remaining), total: num(o.total) }
}

export const emptyTally = () => ({ indexed: 0, held: [], remaining: 0, total: 0, rounds: 0 })

/**
 * The tally after one more round: the counts add up, and once the home is done the held list is the answer's, which
 * the function fills with every held row of the home (the client's press reads it the same way).
 */
export function addRound(t, a) {
  const done = a.remaining === 0
  return { indexed: t.indexed + a.indexed, held: done ? a.held : [...t.held, ...a.held], remaining: a.remaining, total: a.total || t.total, rounds: t.rounds + 1 }
}

/** Whether the home gets another round. */
export function wantsAnotherRound(t) {
  return t.remaining > 0 && t.rounds < MAX_ROUNDS
}

/** The held files by reason. */
export function heldCounts(held) {
  const out = { scan: 0, kind: 0, big: 0, slow: 0, error: 0 }
  for (const h of held) if (h.why in out) out[h.why] += 1
  return out
}

/**
 * One home's line in the log: counts, the rounds and the time, the refusal when the function refused the home, and
 * the held files with their reasons (the log stays on this computer; the card gets the counts alone).
 */
export function homeOutcome(home, tally, ms, error) {
  const held = heldCounts(tally.held)
  const heldFiles = tally.held.length
  return {
    kind: home.kind,
    id: home.id,
    number: home.number,
    files: tally.total,
    indexed: tally.indexed,
    withText: error ? 0 : Math.max(0, tally.total - heldFiles),
    held,
    heldFiles: tally.held,
    rounds: tally.rounds,
    remaining: tally.remaining,
    ms,
    error: error ?? null,
  }
}

/**
 * The state after one home: done when the walk ended clean, so a second run skips it; a home the function refused or
 * stopped on, or that ran out of rounds, stays to walk again with its counts kept apart. A worker stopped at the CPU limit
 * answers a refusal after rows are already written, so a refusal never means the home was not read. File names never go in
 * the state.
 */
export function recordOutcome(state, out) {
  const { heldFiles: _names, ...counts } = out
  const done = { ...(state.done ?? {}) }
  const stopped = { ...(state.stopped ?? {}) }
  if (out.error || out.remaining > 0) {
    delete done[out.id]
    stopped[out.id] = counts
  } else {
    delete stopped[out.id]
    done[out.id] = counts
  }
  return { ...state, done, stopped }
}

/** The totals over every home's line. */
export function totalsOf(outcomes) {
  const t = { homes: 0, jobs: 0, bids: 0, files: 0, indexed: 0, withText: 0, held: { scan: 0, kind: 0, big: 0, slow: 0, error: 0 }, stopped: 0, unfinished: 0, rounds: 0, ms: 0 }
  for (const o of outcomes) {
    t.homes += 1
    if (o.kind === 'bid') t.bids += 1
    else t.jobs += 1
    if (o.error) {
      t.stopped += 1
      continue
    }
    t.files += o.files
    t.indexed += o.indexed
    t.withText += o.withText
    for (const k of HELD_WHYS) t.held[k] += o.held[k] ?? 0
    if (o.remaining > 0) t.unfinished += 1
    t.rounds += o.rounds
    t.ms += o.ms
  }
  return t
}

const n = (v) => Number(v).toLocaleString('en-US')
const plural = (count, one, many) => `${n(count)} ${count === 1 ? one : many}`

/** Why a held file was held, in the office's words, as a count. */
function heldWords(held) {
  const parts = []
  if (held.scan) parts.push(`${n(held.scan)} ${held.scan === 1 ? 'scan' : 'scans'}`)
  if (held.kind) parts.push(`${n(held.kind)} of a kind the index does not read`)
  if (held.big) parts.push(`${n(held.big)} too big`)
  if (held.slow) parts.push(`${n(held.slow)} slow`)
  if (held.error) parts.push(`${n(held.error)} failed`)
  return parts.join(', ')
}

/** The summary, counts only: what was walked, what has text, what has none and why, what could not be opened. */
export function summaryWords(t) {
  const homes = `${plural(t.homes, 'home', 'homes')} (${plural(t.jobs, 'job', 'jobs')}, ${plural(t.bids, 'bid', 'bids')})`
  const none = t.files - t.withText
  const held = heldWords(t.held)
  const parts = [`${plural(t.files, 'file', 'files')}`, `${n(t.withText)} with text`, `${n(none)} with none${held ? ` (${held})` : ''}`]
  let line = `Walked ${homes}: ${parts.join(', ')}.`
  if (t.stopped) line += ` ${plural(t.stopped, 'home', 'homes')} the function refused or stopped on, to walk again.`
  if (t.unfinished) line += ` ${plural(t.unfinished, 'home', 'homes')} still ${t.unfinished === 1 ? 'has' : 'have'} files to go.`
  return line
}

/** The line after one round, as the runner prints it. */
export function roundWords(home, t) {
  const left = t.remaining > 0 ? `, ${n(t.remaining)} to go` : ''
  return `${homeLabel(home)}: ${n(t.indexed)} indexed, ${n(t.held.length)} held${left} (round ${t.rounds})`
}

/** The homes a run still has to walk: every one not in the state as done, or every one with `again`. */
export function homesLeft(homes, doneIds, again) {
  if (again) return homes
  const done = new Set(doneIds)
  return homes.filter((h) => !done.has(h.id))
}

/** The function's refusal in words: its own error line when it has one, else the status. */
export function refusalWords(status, body) {
  const words = body && typeof body === 'object' && typeof body.error === 'string' ? body.error.trim() : ''
  return words || `HTTP ${status}`
}

/** Whether a refusal is worth a second try: the platform's own 5xx or 429, never the function's 4xx words. */
export function retryable(status) {
  return status === 429 || (status >= 500 && status <= 599)
}

/** The runner's arguments. */
export function parseArgs(argv) {
  const a = { scope: 'zz', workers: 1, pauseMs: PAUSE_MS, dryRun: false, again: false, retry: false, limit: null, home: null, state: null, log: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i] ?? ''
    if (k === '--scope') a.scope = v()
    else if (k === '--workers') a.workers = Math.max(1, Math.min(8, Number(v()) || 1))
    else if (k === '--pause') a.pauseMs = Math.max(0, Math.min(60_000, Number(v()) || 0))
    else if (k === '--dry-run') a.dryRun = true
    else if (k === '--again') a.again = true
    else if (k === '--retry') a.retry = true
    else if (k === '--limit') a.limit = Math.max(1, Number(v()) || 1)
    else if (k === '--home') a.home = v()
    else if (k === '--state') a.state = v()
    else if (k === '--log') a.log = v()
    else if (k === '--help' || k === '-h') a.help = true
    else throw new Error(`unknown argument ${k}`)
  }
  if (!SCOPES.includes(a.scope)) throw new Error(`--scope must be one of ${SCOPES.join(', ')}, got "${a.scope}"`)
  return a
}

export const USAGE = `usage: node scripts/file-index-backfill.mjs [--scope zz|live|bids|paid|all] [--workers 1] [--pause 2000] [--dry-run] [--again] [--retry] [--limit N] [--home <uuid>] [--state <file>] [--log <file>]
  --scope     which homes to walk (zz: the ZZ test jobs and bids, the dry run; all: live jobs, then bids, then paid jobs)
  --workers   homes walked at once (1 to 8)
  --pause     milliseconds between one home's calls (0 to 60000), so the function and Drive breathe
  --dry-run   list the homes and stop, no call to the function
  --again     walk homes the state file already marks done
  --retry     take held rows (slow, failed, too big) again
  --limit N   the first N homes of the scope
  --home      one job's or bid's id
  --state     the resume file (default .claude/scratch/file-index-backfill.<scope>.state.json)
  --log       the log, one line per home (default .claude/scratch/file-index-backfill.<scope>.log.jsonl)`
