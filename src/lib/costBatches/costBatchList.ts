/**
 * The batch list (Banking → Cost batches): `cost_batches` rows as the screen reads them, which
 * jobs a batch touched (from `cost_batch_ops.target`, `before_image` and `after_image`), the
 * summary words, and the typed confirmation a revert asks for. Pure.
 */

export type CostBatchRow = {
  id: string
  label: string
  reason: string
  sourceRef: string | null
  authorLabel: string
  authorUserId: string | null
  appliedAt: string
  revertedAt: string | null
  revertReason: string | null
  opCount: number
  /** `summary.by_job` as stored: job id → totals (numbers may arrive as strings from jsonb). */
  byJob: Record<string, { allocated: number; supply: number; clockSessions: number; otherCharges: number; notes: number }>
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** A `cost_batches` row (any shape PostgREST returns) as the list's typed row; `null` when it has no id. */
export function costBatchRowFromDb(raw: unknown): CostBatchRow | null {
  const r = obj(raw)
  if (!r || typeof r.id !== 'string') return null
  const summary = obj(r.summary) ?? {}
  const byJobRaw = obj(summary.by_job) ?? {}
  const byJob: CostBatchRow['byJob'] = {}
  for (const [jobId, v] of Object.entries(byJobRaw)) {
    const t = obj(v) ?? {}
    byJob[jobId] = {
      allocated: Math.round(num(t.allocated) * 100) / 100,
      supply: num(t.supply),
      clockSessions: num(t.clock_sessions),
      otherCharges: Math.round(num(t.other_charges) * 100) / 100,
      notes: num(t.notes),
    }
  }
  return {
    id: r.id,
    label: text(r.label) ?? '',
    reason: text(r.reason) ?? '',
    sourceRef: text(r.source_ref),
    authorLabel: text(r.author_label) ?? 'Cost agent',
    authorUserId: text(r.author_user_id),
    appliedAt: text(r.applied_at) ?? '',
    revertedAt: text(r.reverted_at),
    revertReason: text(r.revert_reason),
    opCount: num(r.op_count),
    byJob,
  }
}

export type CostBatchOpRow = {
  batchId: string
  seq: number
  opType: string
  target: Record<string, unknown>
  beforeImage: Record<string, unknown> | null
  afterImage: Record<string, unknown> | null
  revertedAt: string | null
}

export function costBatchOpRowFromDb(raw: unknown): CostBatchOpRow | null {
  const r = obj(raw)
  if (!r || typeof r.batch_id !== 'string') return null
  return {
    batchId: r.batch_id,
    seq: num(r.seq),
    opType: text(r.op_type) ?? '',
    target: obj(r.target) ?? {},
    beforeImage: obj(r.before_image),
    afterImage: obj(r.after_image),
    revertedAt: text(r.reverted_at),
  }
}

/**
 * Every job an op touched: the target's `job_id`, `to_job_id` and `from_job_id`; a clock session's
 * `job_ledger_id` before and after; an allocation's `job_id` after and in the allocation it replaced.
 */
export function costBatchOpJobIds(op: Pick<CostBatchOpRow, 'target' | 'beforeImage' | 'afterImage'>): string[] {
  const ids = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v) ids.add(v)
  }
  add(op.target.job_id)
  add(op.target.to_job_id)
  add(op.target.from_job_id)
  if (op.beforeImage) {
    add(op.beforeImage.job_ledger_id)
    add(op.beforeImage.job_id)
    add(obj(op.beforeImage.allocation)?.job_id)
    add(obj(op.beforeImage.replaced)?.job_id)
  }
  if (op.afterImage) {
    add(op.afterImage.job_ledger_id)
    add(op.afterImage.job_id)
    add(obj(op.afterImage.allocation)?.job_id)
  }
  return [...ids]
}

export function costBatchOpTouchesJob(op: Pick<CostBatchOpRow, 'target' | 'beforeImage' | 'afterImage'>, jobId: string): boolean {
  return costBatchOpJobIds(op).includes(jobId)
}

/** `381 allocated ($31,804.23) · 10 invoices · 81 clock sessions · 4 notes` — a batch's summary across every job. */
export function costBatchSummaryWords(byJob: CostBatchRow['byJob'], byOpCounts?: Partial<Record<string, number>>): string {
  let allocated = 0
  let supply = 0
  let clock = 0
  let other = 0
  let notes = 0
  for (const t of Object.values(byJob)) {
    allocated += t.allocated
    supply += t.supply
    clock += t.clockSessions
    other += t.otherCharges
    notes += t.notes
  }
  const parts: string[] = []
  const allocateCount = byOpCounts?.allocate
  if (allocated > 0 || allocateCount) parts.push(allocateCount != null ? `${allocateCount} allocated (${usd(allocated)})` : `allocated ${usd(allocated)}`)
  if (supply > 0) parts.push(`${supply} ${supply === 1 ? 'invoice' : 'invoices'}`)
  if (clock > 0) parts.push(`${clock} clock ${clock === 1 ? 'session' : 'sessions'}`)
  if (other > 0) parts.push(`other charges ${usd(other)}`)
  if (notes > 0) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`)
  return parts.length > 0 ? parts.join(' · ') : 'nothing recorded'
}

/** One line per job in a batch's summary, the jobs that received dollars or rows first. */
export function costBatchJobLines(byJob: CostBatchRow['byJob'], jobLabel: (jobId: string) => string): { jobId: string; label: string; words: string }[] {
  return Object.entries(byJob)
    .map(([jobId, t]) => {
      const parts: string[] = []
      if (t.allocated > 0) parts.push(`allocated ${usd(t.allocated)}`)
      if (t.supply > 0) parts.push(`${t.supply} ${t.supply === 1 ? 'invoice' : 'invoices'}`)
      if (t.clockSessions > 0) parts.push(`${t.clockSessions} clock ${t.clockSessions === 1 ? 'session' : 'sessions'}`)
      if (t.otherCharges > 0) parts.push(`other charges ${usd(t.otherCharges)}`)
      if (t.notes > 0) parts.push(`${t.notes} ${t.notes === 1 ? 'note' : 'notes'}`)
      const weight = t.allocated + t.otherCharges + (t.supply + t.clockSessions) * 1000
      return { jobId, label: jobLabel(jobId), words: parts.join(' · ') || 'note only', weight }
    })
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .map(({ jobId, label, words }) => ({ jobId, label, words }))
}

function usd(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

/** The word a dev types to revert a batch: `revert`, any case, spaces around it ignored. */
export const COST_BATCH_REVERT_WORD = 'revert'

export function costBatchRevertTyped(typed: string): boolean {
  return typed.trim().toLowerCase() === COST_BATCH_REVERT_WORD
}

/** Whether the revert press is live: the batch is not yet reverted, the word is typed, a reason is written. */
export function costBatchRevertReady(batch: Pick<CostBatchRow, 'revertedAt'>, typed: string, reason: string): boolean {
  return batch.revertedAt === null && costBatchRevertTyped(typed) && reason.trim().length > 0
}

/** The batches that touched a job, newest first, from the ops that name it. */
export function costBatchIdsTouchingJob(ops: readonly CostBatchOpRow[], jobId: string): Set<string> {
  const out = new Set<string>()
  for (const op of ops) if (costBatchOpTouchesJob(op, jobId)) out.add(op.batchId)
  return out
}

/** Batches newest first by `applied_at`, the reverted ones keeping their place. */
export function sortCostBatchesNewestFirst<T extends Pick<CostBatchRow, 'appliedAt' | 'id'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt) || a.id.localeCompare(b.id))
}

/** The first eight characters of an id, the way the ops list names a transaction or a session. */
export function costBatchShortId(id: unknown): string {
  return typeof id === 'string' ? id.slice(0, 8) : '—'
}

/**
 * One op in words for the ops list: `$84.10 of tx 3f9a… → J629 · Rough In (from J583 · Diamondback)`,
 * `invoice 44a1… J583 → J629`, `session 55b2… → J629`, `ESTIMATE … $22,857.14 on J629`, `note on J629: …`.
 */
export function costBatchOpWords(op: Pick<CostBatchOpRow, 'opType' | 'target'>, jobLabel: (jobId: string) => string): string {
  const t = op.target
  const job = (v: unknown) => (typeof v === 'string' && v ? jobLabel(v) : '—')
  switch (op.opType) {
    case 'allocate': {
      const from = typeof t.from_job_id === 'string' && t.from_job_id ? ` (from ${jobLabel(t.from_job_id)})` : ''
      return `${usd(num(t.amount))} of tx ${costBatchShortId(t.tx_id)}… → ${job(t.job_id)}${from}`
    }
    case 'supply_repoint':
      return `invoice ${costBatchShortId(t.invoice_id)}… ${job(t.from_job_id)} → ${job(t.to_job_id)}`
    case 'clock_repoint':
      return `session ${costBatchShortId(t.session_id)}… → ${job(t.to_job_id)}`
    case 'other_charge':
      return `${text(t.description) ?? 'charge'} ${usd(num(t.amount))} on ${job(t.job_id)}`
    case 'thread_note': {
      const body = (text(t.body) ?? '').trim()
      return `note on ${job(t.job_id)}: ${body.length > 90 ? `${body.slice(0, 89)}…` : body}`
    }
    default:
      return op.opType || 'op'
  }
}
