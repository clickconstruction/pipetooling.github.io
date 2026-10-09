/**
 * A GC statement never goes out unchecked (v2.5022; the owner's call of 2026-10-09, the gate over the
 * reword). A GC's statement may go out — Share → Draft Message, Copy or Print on its row, an app send
 * (send-gc-statement-email) or a scheduled one (gc-statement-email-dispatch) — only when its bills were
 * checked this week (`gc_review_certifications`, the Wednesday ritual) and have not moved since. A GC
 * with nothing outstanding outside Collections has nothing to check: the week's worklist leaves it out,
 * and its statement is not held.
 *
 * Pure, for the client and both send functions. The client's doors read the row's own status
 * (`gcStatementHeld` over `gcGroupCertStatus`, bill by bill). The send functions read the statement
 * payload, which keys a job with one open bill by the bill where the board keys it by the job, so they
 * compare job by job — on prod every unchanged GC of the week of 2026-10-05 matched that way.
 */

/** The words on the worklist row's locked Send — every door that holds a statement says the same. */
export const GC_STATEMENT_UNCHECKED_WORDS = 'Check the bills first — a statement never goes out unchecked'

/** Monday of the company-calendar week holding `todayYmd` (YYYY-MM-DD) — the certification week's key. */
export function gcCertWeekStartYmd(todayYmd: string): string {
  const [y, m, d] = todayYmd.split('-').map(Number)
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  const dow = new Date(t).getUTCDay()
  return new Date(t - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
}

/** A `gc_review_certifications` row of this week for the GC — the columns the gate reads. */
export type GcStatementCertIn = { certified_at: string; total: number | string; snapshot: unknown }

/** One row of the GC's statement now, outside Collections, netted by the one payment rule. */
export type GcStatementLiveRowIn = { jobId: string; remaining: number | string }

/** Why a statement is held, and the words each reason reads in a stamp, a summary and the whole report. */
export type GcStatementHeldWhy = 'not_checked' | 'changed'
export const GC_STATEMENT_HELD_WHY: Readonly<Record<GcStatementHeldWhy, string>> = {
  not_checked: 'not checked this week',
  changed: 'changed since it was checked',
}

export type GcStatementGateResult =
  | { ok: true; why: 'checked' | 'nothing_to_check' }
  | { ok: false; why: GcStatementHeldWhy; words: string; note: string }

const cents = (n: unknown): number => {
  const v = Math.round(Number(n) * 100)
  return Number.isFinite(v) ? v : 0
}

function centsByJob(rows: readonly GcStatementLiveRowIn[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) out.set(r.jobId, (out.get(r.jobId) ?? 0) + cents(r.remaining))
  return out
}

/** The snapshot's rows as job lines, or null when it cannot be read that way (then the totals decide). */
function snapshotRows(snapshot: unknown): GcStatementLiveRowIn[] | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const rows = (snapshot as { rows?: unknown }).rows
  if (!Array.isArray(rows)) return null
  const out: GcStatementLiveRowIn[] = []
  for (const r of rows) {
    const jobId = (r as { jobId?: unknown } | null)?.jobId
    const remaining = (r as { remaining?: unknown } | null)?.remaining
    if (typeof jobId !== 'string' || !jobId || !Number.isFinite(Number(remaining))) return null
    out.push({ jobId, remaining: Number(remaining) })
  }
  return out
}

function refuse(why: GcStatementHeldWhy): GcStatementGateResult {
  return { ok: false, why, words: GC_STATEMENT_UNCHECKED_WORDS, note: GC_STATEMENT_HELD_WHY[why] }
}

/**
 * May this GC's statement go out? `live` is its statement now outside Collections; `weekCerts` are this
 * week's certifications for it, in any order — the latest stands. Job by job, a cent apart is a change.
 */
export function gcStatementGate(live: readonly GcStatementLiveRowIn[], weekCerts: readonly GcStatementCertIn[]): GcStatementGateResult {
  const liveByJob = centsByJob(live)
  let liveTotal = 0
  for (const c of liveByJob.values()) liveTotal += c
  if (liveTotal <= 0) return { ok: true, why: 'nothing_to_check' }
  let cert: GcStatementCertIn | null = null
  for (const c of weekCerts) if (!cert || c.certified_at > cert.certified_at) cert = c
  if (!cert) return refuse('not_checked')
  const snap = snapshotRows(cert.snapshot)
  if (!snap) return cents(cert.total) === liveTotal ? { ok: true, why: 'checked' } : refuse('changed')
  const certByJob = centsByJob(snap)
  // A job paid to nothing on both sides is no change, whichever side still lists it.
  const jobs = new Set([...certByJob.keys(), ...liveByJob.keys()])
  for (const j of jobs) if ((certByJob.get(j) ?? 0) !== (liveByJob.get(j) ?? 0)) return refuse('changed')
  return { ok: true, why: 'checked' }
}

/** The note a held scheduled send is stamped with — the dispatch's log of why it did not go. */
export function gcStatementRefusedNote(gate: Extract<GcStatementGateResult, { ok: false }>): string {
  return `refused: ${gate.words} (${gate.note})`
}

/**
 * The bulk doors (Share all, Print all and the scheduled whole report) skip a held GC and say so
 * (v2.5022, Punchlist's addition): "3 sent · 2 held: not checked this week". The checked GCs still go.
 */
export function gcBulkHeldSummary(verb: string, going: number, held: readonly GcStatementHeldWhy[]): string {
  const parts = [`${going} ${verb}`]
  for (const why of ['not_checked', 'changed'] as const) {
    const n = held.filter((w) => w === why).length
    if (n > 0) parts.push(`${n} held: ${GC_STATEMENT_HELD_WHY[why]}`)
  }
  return parts.join(' · ')
}

/** The whole report's own lines naming who was left out, one per reason: "Held, not checked this week: TF Harper, Loberg". */
export function gcBulkHeldLines(held: ReadonlyArray<{ name: string; why: GcStatementHeldWhy }>): string[] {
  const out: string[] = []
  for (const why of ['not_checked', 'changed'] as const) {
    const names = held.filter((h) => h.why === why).map((h) => h.name)
    if (names.length > 0) out.push(`Held, ${GC_STATEMENT_HELD_WHY[why]}: ${names.join(', ')}`)
  }
  return out
}
