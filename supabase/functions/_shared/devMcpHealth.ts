// dev-mcp's health checks (to-dos/mcp-servers.md, PR 5): which RPC each check_ verb reads, and
// the one-line reading put in front of its reply. The RPCs are dev-gated definer functions
// (migration 20260920232141) read over the same GET door as everything else, as the dev.
// The thresholds are docs/DB_FREEZE_RUNBOOK.md's: a sampler gap over 90 s is a freeze window,
// a sample over ~250 ms is the early warning, a Lock wait is Mode A.
// Pure: no env reads, no network.

export const HEALTH_RPCS = {
  check_sampler: 'dev_health_sampler_gaps',
  check_connections: 'dev_health_connections',
  check_locks: 'dev_health_locks',
  check_migration_ledger: 'dev_migration_ledger_tail',
} as const

export type HealthVerb = keyof typeof HEALTH_RPCS

export function isHealthVerb(name: string): name is HealthVerb {
  return Object.prototype.hasOwnProperty.call(HEALTH_RPCS, name)
}

/** The RPC arguments a verb's input becomes. Numbers only; the RPCs clamp their own ranges. */
export function healthRpcArgs(verb: HealthVerb, input: Record<string, unknown>): Record<string, unknown> {
  if (verb === 'check_sampler' && typeof input.hours === 'number') return { p_hours: Math.trunc(input.hours) }
  if (verb === 'check_migration_ledger' && typeof input.n === 'number') return { p_n: Math.trunc(input.n) }
  return {}
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.map(obj) : [])
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The sampler runs every minute: newer than this and it is alive. */
const SAMPLER_STALE_SECONDS = 180
const SLOW_SAMPLE_MS = 250
const CONNECTIONS_WARN_PCT = 80

export function healthReading(verb: HealthVerb, body: unknown): string {
  const b = obj(body)
  switch (verb) {
    case 'check_sampler': {
      const hours = num(b.hours) ?? 24
      const samples = num(b.samples) ?? 0
      if (samples === 0) return `No sampler rows in ${hours} h — the monitor is not running, or this database has none.`
      const gaps = list(b.gaps_over_90s)
      const longest = gaps.reduce((m, g) => Math.max(m, num(g.gap_seconds) ?? 0), 0)
      const slow = num(b.samples_over_250ms) ?? 0
      const slowest = num(obj(b.slowest_sample).sample_duration_ms)
      const gapPart = gaps.length === 0 ? `no gaps over 90 s in ${hours} h` : `${plural(gaps.length, 'gap')} over 90 s in ${hours} h (longest ${Math.round(longest)} s) — each is a freeze window`
      const slowPart = slow === 0 ? `slowest sample ${slowest ?? '?'} ms` : `${plural(slow, 'sample')} over ${SLOW_SAMPLE_MS} ms (slowest ${slowest ?? '?'} ms) — the early warning`
      return `${gapPart}; ${slowPart}.`
    }
    case 'check_connections': {
      const total = num(b.total_conns)
      if (b.sampled_at == null || total == null) return 'No connection sample yet — the monitor is not running, or this database has none.'
      const age = num(b.sample_age_seconds) ?? 0
      const pct = num(b.pct_of_max) ?? 0
      const lockWaits = list(b.by_state).filter((r) => r.wait_event_type === 'Lock').reduce((n, r) => n + (num(r.conns) ?? 0), 0)
      const parts = [`${total} of ${num(b.max_connections) ?? '?'} connections (${pct}%)${pct >= CONNECTIONS_WARN_PCT ? ' — near the ceiling' : ''}`]
      if (lockWaits > 0) parts.push(`${lockWaits} waiting on a lock — check_locks names the blocker`)
      if (age > SAMPLER_STALE_SECONDS) parts.push(`the sample is ${Math.round(age)} s old — the sampler has stopped, which is itself the freeze signature`)
      return `${parts.join('; ')}.`
    }
    case 'check_locks': {
      const waiters = list(b.waiters)
      const blockers = list(b.blockers)
      const idle = list(b.idle_in_transaction_over_60s)
      const idlePart = idle.length > 0 ? ` ${plural(idle.length, 'transaction')} left open over 60 s.` : ''
      if (waiters.length === 0) return `No lock waits right now.${idlePart}`
      const top = blockers[0]
      const named = top ? ` — pid ${String(top.pid)} blocks ${String(top.blocking)}, its transaction open ${String(top.xact_seconds)} s` : ''
      return `${plural(waiters.length, 'backend')} waiting on a lock, behind ${plural(blockers.length, 'blocker')}${named}. Read the runbook before terminating anything.${idlePart}`
    }
    case 'check_migration_ledger': {
      const rows = list(b.newest_first)
      const newest = rows[0]
      if (!newest) return 'The migration ledger is empty.'
      return `${num(b.applied) ?? '?'} applied; newest ${String(newest.version)} ${String(newest.name ?? '')}`.trimEnd() + '. Hold the list against `git ls-tree origin/main supabase/migrations/`; `npm run check:migration-drift` is the authority.'
    }
  }
}

/** One OPTIONS probe of one edge function, as check_edge_boot records it. */
export type EdgeBootProbe = { name: string; status: number | null; bootError: boolean; error?: string }

/** A function that cannot boot answers 503 with BOOT_ERROR in the body — whatever the method. */
export function isBootError(status: number, bodyText: string): boolean {
  return status === 503 && /BOOT_ERROR/i.test(bodyText)
}

/**
 * The platform allows an edge function about 60 calls a minute to other functions ("Rate limit
 * exceeded for function", found live 2026-09-20: the first 60 of 123 probes answered, the rest
 * were refused). So one call probes one batch, under that ceiling, and hands back a cursor.
 */
export const EDGE_BOOT_BATCH = 50

/** The next batch of names after `after` (exclusive; names are sorted), and the cursor for the one after it. */
export function edgeBootBatch(names: readonly string[], after?: string | null, size: number = EDGE_BOOT_BATCH): { batch: string[]; nextAfter: string | null; remaining: number } {
  const sorted = [...names].sort()
  const cursor = (after ?? '').trim()
  const rest = cursor ? sorted.filter((n) => n > cursor) : sorted
  const batch = rest.slice(0, Math.max(1, size))
  const remaining = rest.length - batch.length
  return { batch, nextAfter: remaining > 0 ? (batch[batch.length - 1] ?? null) : null, remaining }
}

const isRateLimited = (p: EdgeBootProbe) => p.status === 429 || /rate limit/i.test(p.error ?? '')

export type EdgeBootReport = {
  reading: string
  boot_errors: string[]
  /** Refused by the platform's function-to-function rate limit — says nothing about the function. */
  rate_limited: string[]
  unreachable: { name: string; error: string }[]
  probed: number
  total: number
  /** Pass as `after` to probe the next batch; null when this was the last one. */
  next_after: string | null
}

export function edgeBootReport(probes: EdgeBootProbe[], opts: { total?: number; nextAfter?: string | null } = {}): EdgeBootReport {
  const total = opts.total ?? probes.length
  const nextAfter = opts.nextAfter ?? null
  const bootErrors = probes.filter((p) => p.bootError).map((p) => p.name).sort()
  const rateLimited = probes.filter((p) => !p.bootError && isRateLimited(p)).map((p) => p.name).sort()
  const unreachable = probes.filter((p) => !p.bootError && !isRateLimited(p) && p.status === null).map((p) => ({ name: p.name, error: p.error ?? 'no answer' }))
  const booted = probes.length - bootErrors.length - rateLimited.length - unreachable.length
  const first = probes.map((p) => p.name).sort()[0]
  const last = probes.map((p) => p.name).sort()[probes.length - 1]
  const span = probes.length > 0 && probes.length < total ? ` (${first} → ${last}, ${probes.length} of ${total})` : ''

  const parts: string[] = []
  if (bootErrors.length > 0) parts.push(`${plural(bootErrors.length, 'function')} cannot boot: ${bootErrors.join(', ')} — redeploy from a tree that bundles`)
  if (rateLimited.length > 0) parts.push(`${plural(rateLimited.length, 'probe')} refused by the platform's rate limit (about 60 function-to-function calls a minute) — that says nothing about those functions; wait a minute and probe them again`)
  if (unreachable.length > 0) parts.push(`${plural(unreachable.length, 'probe')} got no answer in time`)
  const verdict = parts.length === 0 ? `All ${probes.length} probed edge functions boot${span}.` : `${parts.join('; ')}. ${booted} of ${probes.length} probed boot${span}.`
  const more = nextAfter ? ` More to probe: call again with after: "${nextAfter}" — in about a minute, to stay under the rate limit.` : ''
  return { reading: verdict + more, boot_errors: bootErrors, rate_limited: rateLimited, unreachable, probed: probes.length, total, next_after: nextAfter }
}
