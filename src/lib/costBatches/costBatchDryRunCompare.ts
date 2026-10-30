/**
 * The dry run against the plan (`docs/COST_BATCHES.md` → The convention, rule 2): `cost_batch_apply`
 * returns `{ batch_id, dry_run, op_count, by_job: { <job>: { allocated, supply, clock_sessions,
 * other_charges, notes } }, ops }`; the plan's own `summarizeCostBatchOps` says what it expects.
 * They must agree to the cent on every job and field before Apply is live. Pure: the screen
 * passes the RPC's JSON reply.
 */
import type { CostBatchSummary } from './costBatchPayload'

export type CostBatchJobTotals = {
  allocated: number
  supply: number
  clockSessions: number
  otherCharges: number
  notes: number
}

export type CostBatchApplyResult = {
  batchId: string | null
  dryRun: boolean
  opCount: number
  byJob: Record<string, CostBatchJobTotals>
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The RPC's reply as typed totals; `null` when it is not the summary shape (an error body, a string). */
export function parseCostBatchApplyResult(reply: unknown): CostBatchApplyResult | null {
  const r = obj(reply)
  if (!r || !('by_job' in r)) return null
  const byJobRaw = obj(r.by_job) ?? {}
  const byJob: Record<string, CostBatchJobTotals> = {}
  for (const [jobId, v] of Object.entries(byJobRaw)) {
    const row = obj(v) ?? {}
    byJob[jobId] = {
      allocated: round2(num(row.allocated)),
      supply: num(row.supply),
      clockSessions: num(row.clock_sessions),
      otherCharges: round2(num(row.other_charges)),
      notes: num(row.notes),
    }
  }
  return {
    batchId: typeof r.batch_id === 'string' && r.batch_id ? r.batch_id : null,
    dryRun: r.dry_run === true,
    opCount: num(r.op_count),
    byJob,
  }
}

export type CostBatchCompareField = keyof CostBatchJobTotals

export const COST_BATCH_COMPARE_FIELDS: readonly CostBatchCompareField[] = ['allocated', 'supply', 'clockSessions', 'otherCharges', 'notes']

export const COST_BATCH_FIELD_LABELS: Record<CostBatchCompareField, string> = {
  allocated: 'Allocated',
  supply: 'Invoices',
  clockSessions: 'Clock sessions',
  otherCharges: 'Other charges',
  notes: 'Notes',
}

export type CostBatchCompareLine = {
  jobId: string
  field: CostBatchCompareField
  plan: number
  dryRun: number
  ok: boolean
}

export type CostBatchComparison = {
  /** True only when every job and field agrees to the cent and the op counts match. */
  matches: boolean
  lines: CostBatchCompareLine[]
  /** Sentences for what disagrees: a job only one side names, a field off by cents, an op count. */
  problems: string[]
  opCount: { plan: number; dryRun: number }
}

const CENT = 0.005

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fieldEqual(field: CostBatchCompareField, a: number, b: number): boolean {
  if (field === 'allocated' || field === 'otherCharges') return Math.abs(round2(a) - round2(b)) < CENT
  return a === b
}

/**
 * Every job either side names, every field, compared to the cent (dollars) or exactly (counts).
 * `jobLabel` turns an id into the words the problems read.
 */
export function compareDryRunToPlan(plan: CostBatchSummary, dryRun: CostBatchApplyResult, jobLabel: (jobId: string) => string = (id) => id): CostBatchComparison {
  const jobIds = [...new Set([...Object.keys(plan.byJob), ...Object.keys(dryRun.byJob)])].sort()
  const lines: CostBatchCompareLine[] = []
  const problems: string[] = []
  const zero: CostBatchJobTotals = { allocated: 0, supply: 0, clockSessions: 0, otherCharges: 0, notes: 0 }
  for (const jobId of jobIds) {
    const p = plan.byJob[jobId]
    const d = dryRun.byJob[jobId]
    if (!p) problems.push(`The dry run touched ${jobLabel(jobId)}, which the plan does not name.`)
    if (!d) problems.push(`The plan names ${jobLabel(jobId)}, which the dry run did not touch.`)
    const pv = p ?? zero
    const dv = d ?? zero
    for (const field of COST_BATCH_COMPARE_FIELDS) {
      const ok = fieldEqual(field, pv[field], dv[field])
      lines.push({ jobId, field, plan: pv[field], dryRun: dv[field], ok })
      if (!ok && p && d) {
        const words = field === 'allocated' || field === 'otherCharges' ? `${usd(pv[field])} planned, ${usd(dv[field])} in the dry run` : `${pv[field]} planned, ${dv[field]} in the dry run`
        problems.push(`${jobLabel(jobId)} · ${COST_BATCH_FIELD_LABELS[field]}: ${words}.`)
      }
    }
  }
  if (plan.opCount !== dryRun.opCount) problems.push(`Op count: ${plan.opCount} planned, ${dryRun.opCount} in the dry run.`)
  return { matches: problems.length === 0, lines, problems, opCount: { plan: plan.opCount, dryRun: dryRun.opCount } }
}

function usd(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

/**
 * The plan's fingerprint: the payload as JSON, so the screen can tell that the plan it dry-ran is
 * the plan it is about to apply (any change to the selection, the target, the reason or the notes
 * changes it). The dev-mcp door hashes the same way (`devMcpWrites.ts` → planHash); this one needs
 * no crypto because it never leaves the page.
 */
export function costBatchPlanSignature(payload: unknown): string {
  return JSON.stringify(payload)
}
