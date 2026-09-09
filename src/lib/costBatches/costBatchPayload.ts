/**
 * Cost batches (v2.3196) — the client/agent side of `cost_batch_apply(jsonb, boolean)`.
 *
 * A batch is a label, a reason, and an ordered list of operations. The database
 * function is the authority (it re-validates everything and refuses anything it
 * does not recognise); this kernel mirrors its rules so a planner — an agent
 * script today, a dev screen later — can reject a bad payload before the
 * round-trip, and can summarise a plan the way the function's summary will.
 *
 * The five operations, and nothing else:
 *   allocate        bank transaction → job (optionally replacing the allocation on `from_job_id`)
 *   supply_repoint  supply-house invoice allocation → another job
 *   clock_repoint   clock session → another job
 *   other_charge    an Other job charge whose description starts with "ESTIMATE"
 *   thread_note     a note on the job's thread (needs `author_user_id` on the batch)
 */

export type CostBatchAllocateOp = {
  op: 'allocate'
  tx_id: string
  job_id: string
  /** Dollars of the transaction to allocate — always positive; the function stores it with the transaction's sign. */
  amount: number
  note?: string
  /** An existing allocation of the same transaction to remove first (the catch-all job, typically). */
  from_job_id?: string
}
export type CostBatchSupplyRepointOp = {
  op: 'supply_repoint'
  invoice_id: string
  from_job_id: string
  to_job_id: string
}
export type CostBatchClockRepointOp = {
  op: 'clock_repoint'
  session_id: string
  to_job_id: string
}
export type CostBatchOtherChargeOp = {
  op: 'other_charge'
  job_id: string
  description: string
  amount: number
}
export type CostBatchThreadNoteOp = {
  op: 'thread_note'
  job_id: string
  body: string
}

export type CostBatchOp =
  | CostBatchAllocateOp
  | CostBatchSupplyRepointOp
  | CostBatchClockRepointOp
  | CostBatchOtherChargeOp
  | CostBatchThreadNoteOp

export type CostBatchPayload = {
  label: string
  reason: string
  source_ref?: string
  author_label?: string
  author_user_id?: string
  ops: CostBatchOp[]
}

export const COST_BATCH_OP_TYPES = [
  'allocate',
  'supply_repoint',
  'clock_repoint',
  'other_charge',
  'thread_note',
] as const

export const COST_BATCH_LABEL_MAX = 120
export const COST_BATCH_NOTE_MAX = 2000
/** The only way an estimate enters a job from a batch: the description says so, first word. */
export const COST_BATCH_ESTIMATE_PREFIX = 'ESTIMATE'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Every problem with a payload, in op order, as plain sentences ("op 3: …").
 * Empty array ⇒ the function will accept the shape (it may still refuse on
 * live data: a missing job, an over-allocated transaction).
 */
export function validateCostBatchPayload(p: CostBatchPayload): string[] {
  const problems: string[] = []
  if (!nonEmpty(p.label)) problems.push('label is required')
  else if (p.label.trim().length > COST_BATCH_LABEL_MAX)
    problems.push(`label is longer than ${COST_BATCH_LABEL_MAX} characters`)
  if (!nonEmpty(p.reason)) problems.push('reason is required')
  if (p.author_user_id != null && !isUuid(p.author_user_id))
    problems.push('author_user_id is not a uuid')
  if (!Array.isArray(p.ops) || p.ops.length === 0) {
    problems.push('ops must be a non-empty array')
    return problems
  }
  p.ops.forEach((op, i) => {
    const at = `op ${i + 1}`
    switch (op.op) {
      case 'allocate':
        if (!isUuid(op.tx_id))
          problems.push(`${at}: allocate needs tx_id (uuid)`)
        if (!isUuid(op.job_id))
          problems.push(`${at}: allocate needs job_id (uuid)`)
        if (!isFiniteNumber(op.amount) || op.amount <= 0)
          problems.push(`${at}: allocate amount must be > 0`)
        if (op.from_job_id != null && !isUuid(op.from_job_id))
          problems.push(`${at}: from_job_id is not a uuid`)
        if (op.from_job_id != null && op.from_job_id === op.job_id)
          problems.push(`${at}: from_job_id equals job_id`)
        break
      case 'supply_repoint':
        if (!isUuid(op.invoice_id))
          problems.push(`${at}: supply_repoint needs invoice_id (uuid)`)
        if (!isUuid(op.from_job_id) || !isUuid(op.to_job_id))
          problems.push(
            `${at}: supply_repoint needs from_job_id and to_job_id (uuid)`,
          )
        else if (op.from_job_id === op.to_job_id)
          problems.push(`${at}: from_job_id equals to_job_id`)
        break
      case 'clock_repoint':
        if (!isUuid(op.session_id))
          problems.push(`${at}: clock_repoint needs session_id (uuid)`)
        if (!isUuid(op.to_job_id))
          problems.push(`${at}: clock_repoint needs to_job_id (uuid)`)
        break
      case 'other_charge':
        if (!isUuid(op.job_id))
          problems.push(`${at}: other_charge needs job_id (uuid)`)
        if (!isFiniteNumber(op.amount) || op.amount < 0)
          problems.push(`${at}: other_charge amount must be >= 0`)
        if (!nonEmpty(op.description))
          problems.push(`${at}: other_charge needs a description`)
        else if (
          !op.description
            .trim()
            .toUpperCase()
            .startsWith(COST_BATCH_ESTIMATE_PREFIX)
        ) {
          problems.push(
            `${at}: an other_charge from a batch must be described as an ESTIMATE (description starts with "${COST_BATCH_ESTIMATE_PREFIX}")`,
          )
        }
        break
      case 'thread_note':
        if (!isUuid(op.job_id))
          problems.push(`${at}: thread_note needs job_id (uuid)`)
        if (!nonEmpty(op.body)) problems.push(`${at}: thread_note needs a body`)
        else if (op.body.trim().length > COST_BATCH_NOTE_MAX)
          problems.push(
            `${at}: thread_note body is longer than ${COST_BATCH_NOTE_MAX} characters`,
          )
        if (!isUuid(p.author_user_id))
          problems.push(`${at}: thread_note needs author_user_id on the batch`)
        break
      default:
        problems.push(
          `${at}: unknown op "${String((op as { op?: unknown }).op)}"`,
        )
    }
  })
  return problems
}

export type CostBatchJobSummary = {
  /** Dollars allocated onto the job by `allocate` ops (positive). */
  allocated: number
  supply: number
  clockSessions: number
  otherCharges: number
  notes: number
}

export type CostBatchSummary = {
  opCount: number
  byOp: Record<(typeof COST_BATCH_OP_TYPES)[number], number>
  byJob: Record<string, CostBatchJobSummary>
  /** Jobs an `allocate` op takes an allocation away from, with the dollars leaving each. */
  releasedFrom: Record<string, number>
}

function jobRow(
  byJob: Record<string, CostBatchJobSummary>,
  jobId: string,
): CostBatchJobSummary {
  return (byJob[jobId] ??= {
    allocated: 0,
    supply: 0,
    clockSessions: 0,
    otherCharges: 0,
    notes: 0,
  })
}

/** The same shape the database summary reports, computed from the plan alone. */
export function summarizeCostBatchOps(ops: CostBatchOp[]): CostBatchSummary {
  const s: CostBatchSummary = {
    opCount: ops.length,
    byOp: {
      allocate: 0,
      supply_repoint: 0,
      clock_repoint: 0,
      other_charge: 0,
      thread_note: 0,
    },
    byJob: {},
    releasedFrom: {},
  }
  for (const op of ops) {
    if (!(op.op in s.byOp)) continue
    s.byOp[op.op] += 1
    switch (op.op) {
      case 'allocate':
        jobRow(s.byJob, op.job_id).allocated += op.amount
        if (op.from_job_id)
          s.releasedFrom[op.from_job_id] =
            (s.releasedFrom[op.from_job_id] ?? 0) + op.amount
        break
      case 'supply_repoint':
        jobRow(s.byJob, op.to_job_id).supply += 1
        break
      case 'clock_repoint':
        jobRow(s.byJob, op.to_job_id).clockSessions += 1
        break
      case 'other_charge':
        jobRow(s.byJob, op.job_id).otherCharges += op.amount
        break
      case 'thread_note':
        jobRow(s.byJob, op.job_id).notes += 1
        break
    }
  }
  for (const row of Object.values(s.byJob)) {
    row.allocated = Math.round(row.allocated * 100) / 100
    row.otherCharges = Math.round(row.otherCharges * 100) / 100
  }
  return s
}

/** Build a payload and throw on the first problem — for scripts that would rather fail loudly. */
export function buildCostBatchPayload(
  input: CostBatchPayload,
): CostBatchPayload {
  const problems = validateCostBatchPayload(input)
  if (problems.length > 0)
    throw new Error(`cost batch payload: ${problems.join('; ')}`)
  return {
    label: input.label.trim(),
    reason: input.reason.trim(),
    ...(input.source_ref ? { source_ref: input.source_ref } : {}),
    ...(input.author_label ? { author_label: input.author_label } : {}),
    ...(input.author_user_id ? { author_user_id: input.author_user_id } : {}),
    ops: input.ops,
  }
}
