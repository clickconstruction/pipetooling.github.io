/**
 * Move cost: the whole batch from a selection — the move ops, one `thread_note` on the target job
 * and one on the source job in the house form (`docs/COST_BATCHES.md` → The convention, rule 4:
 * "note every touched job"), the label, and the payload `cost_batch_apply` takes. Pure; the
 * screen passes today's date and the job words.
 */
import { buildCostBatchPayload, validateCostBatchPayload, type CostBatchOp, type CostBatchPayload, type CostBatchThreadNoteOp, COST_BATCH_LABEL_MAX, COST_BATCH_NOTE_MAX } from './costBatchPayload'
import { buildCostMoveOps, type CostMoveOps, type CostMoveRow, type CostMoveSource } from './costMoveRows'

export type CostMoveJobWords = {
  id: string
  /** The job as the app names it, `J583 · Diamondback`. */
  label: string
}

export type CostMoveNotesInput = {
  /** `YYYY-MM-DD`, company time — the note opens on it. */
  todayYmd: string
  sourceJob: CostMoveJobWords
  targetJob: CostMoveJobWords
  moved: Record<CostMoveSource, number>
  allocatedDollars: number
  reason: string
  sourceRef?: string
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** `381 bank charges ($31,804.23), 10 supply-house invoices and 81 clock sessions` — the moved rows in words, by source. */
export function costMoveWhatMoved(moved: Record<CostMoveSource, number>, allocatedDollars: number): string {
  const parts: string[] = []
  if (moved.bank > 0) parts.push(`${plural(moved.bank, 'bank charge', 'bank charges')} (${usd(allocatedDollars)})`)
  if (moved.supply > 0) parts.push(plural(moved.supply, 'supply-house invoice', 'supply-house invoices'))
  if (moved.clock > 0) parts.push(plural(moved.clock, 'clock session', 'clock sessions'))
  if (parts.length === 0) return 'no rows'
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function usd(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

const rowsCount = (moved: Record<CostMoveSource, number>): number => moved.bank + moved.supply + moved.clock

/** The note on the job that received the rows: `<date> — cost batch: N rows moved here from <job> — … Reason: … Plan: … No estimates in this batch.` */
export function costMoveTargetNoteBody(input: CostMoveNotesInput): string {
  const n = rowsCount(input.moved)
  const head = `${input.todayYmd} — cost batch: ${plural(n, 'row', 'rows')} moved here from ${input.sourceJob.label} — ${costMoveWhatMoved(input.moved, input.allocatedDollars)}.`
  return clampNote([head, tail(input)].join(' '))
}

/** The note on the job the rows left: `<date> — cost batch: N rows moved from here to <job> — … ` */
export function costMoveSourceNoteBody(input: CostMoveNotesInput): string {
  const n = rowsCount(input.moved)
  const head = `${input.todayYmd} — cost batch: ${plural(n, 'row', 'rows')} moved from here to ${input.targetJob.label} — ${costMoveWhatMoved(input.moved, input.allocatedDollars)}.`
  return clampNote([head, tail(input)].join(' '))
}

function tail(input: CostMoveNotesInput): string {
  const bits = [`Reason: ${input.reason.trim()}`]
  if (input.sourceRef?.trim()) bits.push(`Plan: ${input.sourceRef.trim()}`)
  bits.push('No estimates in this batch.')
  return bits.join(' ')
}

function clampNote(body: string): string {
  if (body.length <= COST_BATCH_NOTE_MAX) return body
  return `${body.slice(0, COST_BATCH_NOTE_MAX - 1)}…`
}

/** The two `thread_note` ops — target first, then source — the batch ends with. */
export function buildCostMoveNotes(input: CostMoveNotesInput): CostBatchThreadNoteOp[] {
  return [
    { op: 'thread_note', job_id: input.targetJob.id, body: costMoveTargetNoteBody(input) },
    { op: 'thread_note', job_id: input.sourceJob.id, body: costMoveSourceNoteBody(input) },
  ]
}

/** `Move cost: J583 · Diamondback → J629 · Rough In (2026-10-29)`, cut to the label's limit. */
export function costMoveLabel(sourceJob: CostMoveJobWords, targetJob: CostMoveJobWords, todayYmd: string): string {
  const full = `Move cost: ${sourceJob.label} → ${targetJob.label} (${todayYmd})`
  if (full.length <= COST_BATCH_LABEL_MAX) return full
  return `${full.slice(0, COST_BATCH_LABEL_MAX - 1)}…`
}

/** The allocation note the screen offers by default: `Move cost 2026-10-29`. */
export function costMoveDefaultAllocationNote(todayYmd: string): string {
  return `Move cost ${todayYmd}`
}

export type CostMovePlanInput = {
  todayYmd: string
  sourceJob: CostMoveJobWords
  targetJob: CostMoveJobWords
  rows: readonly CostMoveRow[]
  reason: string
  sourceRef?: string
  /** The dev the notes are written as (`users.id`, = the signed-in auth id). */
  authorUserId: string
  authorLabel?: string
  allocationNote?: string
}

export type CostMovePlan = {
  payload: CostBatchPayload | null
  /** The move ops and the holds, before the notes. */
  move: CostMoveOps
  /** Every op, move ops first, the two notes last. */
  ops: CostBatchOp[]
  /** Why there is no payload: nothing movable selected, no target, the same job both ways, a bad shape. */
  problems: string[]
}

/**
 * The plan from a selection: the move ops, the two notes, the payload. `payload` is null and
 * `problems` says why when the plan cannot be applied (no movable rows, source = target, the
 * payload kernel refuses the shape). Nothing here touches the database.
 */
export function buildCostMovePlan(input: CostMovePlanInput): CostMovePlan {
  const problems: string[] = []
  if (input.sourceJob.id === input.targetJob.id) problems.push('Pick a different job to move the rows to: the target is the job they are on.')
  const move = buildCostMoveOps({ sourceJobId: input.sourceJob.id, targetJobId: input.targetJob.id, rows: input.rows, allocationNote: input.allocationNote })
  if (move.ops.length === 0) problems.push('Nothing selected can move. Tick a bank, supply-house or clock row.')
  if (!input.reason.trim()) problems.push('Write the reason: it is kept on the batch and in both notes.')
  const notes = buildCostMoveNotes({
    todayYmd: input.todayYmd,
    sourceJob: input.sourceJob,
    targetJob: input.targetJob,
    moved: move.moved,
    allocatedDollars: move.allocatedDollars,
    reason: input.reason,
    sourceRef: input.sourceRef,
  })
  const ops: CostBatchOp[] = [...move.ops, ...notes]
  if (problems.length > 0) return { payload: null, move, ops, problems }
  const draft: CostBatchPayload = {
    label: costMoveLabel(input.sourceJob, input.targetJob, input.todayYmd),
    reason: input.reason,
    ...(input.sourceRef?.trim() ? { source_ref: input.sourceRef.trim() } : {}),
    author_label: input.authorLabel?.trim() || 'Move cost screen',
    author_user_id: input.authorUserId,
    ops,
  }
  const shape = validateCostBatchPayload(draft)
  if (shape.length > 0) return { payload: null, move, ops, problems: shape }
  return { payload: buildCostBatchPayload(draft), move, ops, problems: [] }
}
