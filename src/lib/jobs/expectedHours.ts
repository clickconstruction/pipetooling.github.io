/**
 * The expected hours ledger, read (punch list #242, PR 2). `job_expected_hours` holds one
 * row per change, append-only: the row with no `cleared_at` is the job's open target, a
 * row whose `cleared_at` equals a later row's `set_at` was replaced by it, and a row cleared
 * with no successor was *back to the budget*. From the rows this kernel reads the open
 * target per job, the history as the board's Recent changes strip (newest first), and the
 * one move *Undo the last change* makes: the job goes back to what it read before the
 * latest change. Pure.
 */
export type ExpectedHoursRow = {
  id: string
  job_id: string
  hours: number | string
  from_hours: number | string | null
  set_by: string | null
  set_by_name: string | null
  set_at: string
  why: string
  cleared_at: string | null
  cleared_by: string | null
  cleared_by_name: string | null
}

/** A job's open target: who set it, when, from what and why. */
export type ExpectedHoursTarget = { id: string; jobId: string; hours: number; from: number | null; by: string; at: string; why: string }

/** One change on the strip: a target set, or a target cleared back to the budget. */
export type ExpectedHoursChange =
  | { kind: 'set'; id: string; jobId: string; hours: number; from: number | null; by: string; at: string; why: string }
  | { kind: 'clear'; id: string; jobId: string; from: number; by: string; at: string }

/** What Undo does: set the job back to an earlier target, or clear it back to the budget. */
export type ExpectedHoursUndo = { kind: 'set'; jobId: string; hours: number; from: number | null; why: string } | { kind: 'clear'; jobId: string }

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

const who = (name: string | null | undefined): string => (name ?? '').trim() || 'the office'

function targetOf(r: ExpectedHoursRow): ExpectedHoursTarget {
  return { id: r.id, jobId: r.job_id, hours: num(r.hours) ?? 0, from: num(r.from_hours), by: who(r.set_by_name), at: r.set_at, why: r.why }
}

/** The open target per job: the newest row with no `cleared_at`. */
export function openTargetsOf(rows: ReadonlyArray<ExpectedHoursRow>): Map<string, ExpectedHoursTarget> {
  const out = new Map<string, ExpectedHoursTarget>()
  for (const r of rows) {
    if (r.cleared_at != null) continue
    const cur = out.get(r.job_id)
    if (!cur || r.set_at > cur.at) out.set(r.job_id, targetOf(r))
  }
  return out
}

/** True when another row on the same job was set in the instant this one was cleared: it replaced this one. */
function replaced(r: ExpectedHoursRow, rows: ReadonlyArray<ExpectedHoursRow>): boolean {
  return r.cleared_at != null && rows.some((o) => o.id !== r.id && o.job_id === r.job_id && o.set_at === r.cleared_at)
}

/** Every change, newest first: each row as a set, and each row cleared with no successor as a clear too. */
export function changesOf(rows: ReadonlyArray<ExpectedHoursRow>, limit = 50): ExpectedHoursChange[] {
  const out: ExpectedHoursChange[] = []
  for (const r of rows) {
    const t = targetOf(r)
    out.push({ kind: 'set', ...t })
    if (r.cleared_at != null && !replaced(r, rows)) out.push({ kind: 'clear', id: r.id, jobId: r.job_id, from: t.hours, by: who(r.cleared_by_name), at: r.cleared_at })
  }
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.kind === 'clear' ? -1 : 1))
  return out.slice(0, limit)
}

/** The words one change reads on the strip: *110 → 96 h · Robert · why*, or *110 → budget · Robert · back to the budget*. */
export function changeWords(c: ExpectedHoursChange): string {
  if (c.kind === 'clear') return `${Math.round(c.from)} → budget · ${c.by} · back to the budget`
  return `${c.from != null ? `${Math.round(c.from)} → ` : ''}${Math.round(c.hours)} h · ${c.by} · ${c.why}`
}

/**
 * The move Undo makes against the latest change: after a set, back to the target it replaced
 * (or the budget when it replaced none); after a clear, the cleared target again.
 */
export function undoOf(rows: ReadonlyArray<ExpectedHoursRow>): ExpectedHoursUndo | null {
  const latest = changesOf(rows, 1)[0]
  if (!latest) return null
  if (latest.kind === 'clear') return { kind: 'set', jobId: latest.jobId, hours: latest.from, from: null, why: `undo: back to ${Math.round(latest.from)} h` }
  const before = rows.find((r) => r.job_id === latest.jobId && r.id !== latest.id && r.cleared_at === latest.at)
  if (before) {
    const hours = num(before.hours) ?? 0
    return { kind: 'set', jobId: latest.jobId, hours, from: latest.hours, why: `undo: back to ${Math.round(hours)} h` }
  }
  return { kind: 'clear', jobId: latest.jobId }
}
