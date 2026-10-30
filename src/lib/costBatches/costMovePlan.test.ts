import { describe, expect, it } from 'vitest'
import { COST_BATCH_LABEL_MAX, COST_BATCH_NOTE_MAX, summarizeCostBatchOps } from './costBatchPayload'
import { buildCostMoveNotes, buildCostMovePlan, costMoveDefaultAllocationNote, costMoveLabel, costMoveSourceNoteBody, costMoveTargetNoteBody, costMoveWhatMoved } from './costMovePlan'
import type { CostMoveRow } from './costMoveRows'

const SOURCE = { id: '11111111-1111-4111-8111-111111111111', label: 'J583 · Diamondback' }
const TARGET = { id: '22222222-2222-4222-8222-222222222222', label: 'J629 · ROUGH IN' }
const USER = '66666666-6666-4666-8666-666666666666'
const TX = '33333333-3333-4333-8333-333333333333'
const INV = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555'

const rows: CostMoveRow[] = [
  { source: 'bank', allocationId: 'a1', txId: TX, postedYmd: '2026-09-10', counterparty: 'Shell', cardId: 'c', cardNickname: null, category: 'Fuel', txAmount: -84.1, allocationAmount: -84.1, note: null },
  { source: 'supply', invoiceId: INV, supplyHouse: 'Reece', invoiceNumber: '4471', invoiceYmd: '2026-10-08', amount: 507.8, pct: 100, isPaid: false, purchaseOrder: null },
  { source: 'clock', sessionId: SESSION, userId: 'u1', personName: 'Malachi', workYmd: '2026-10-26', minutes: 570, approved: true, rejected: false, bidId: null },
  { source: 'other', chargeId: 'o1', description: 'Permit', amount: 100 },
]

const notesInput = { todayYmd: '2026-10-29', sourceJob: SOURCE, targetJob: TARGET, moved: { bank: 381, supply: 10, clock: 81, other: 0 }, allocatedDollars: 31804.23, reason: 'Owner decision 2026-10-29: the trip rows belong to the rough-in draw.', sourceRef: 'HCP583-Sort_v4.md' }

describe('note bodies', () => {
  it('says what moved by source, with the dollars on the bank charges', () => {
    expect(costMoveWhatMoved({ bank: 381, supply: 10, clock: 81, other: 0 }, 31804.23)).toBe('381 bank charges ($31,804.23), 10 supply-house invoices and 81 clock sessions')
    expect(costMoveWhatMoved({ bank: 1, supply: 0, clock: 0, other: 0 }, 84.1)).toBe('1 bank charge ($84.10)')
    expect(costMoveWhatMoved({ bank: 0, supply: 1, clock: 1, other: 0 }, 0)).toBe('1 supply-house invoice and 1 clock session')
    expect(costMoveWhatMoved({ bank: 0, supply: 0, clock: 0, other: 0 }, 0)).toBe('no rows')
  })

  it('writes the target note in the house form, the plan and the no-estimates line', () => {
    expect(costMoveTargetNoteBody(notesInput)).toBe(
      '2026-10-29 — cost batch: 472 rows moved here from J583 · Diamondback — 381 bank charges ($31,804.23), 10 supply-house invoices and 81 clock sessions. Reason: Owner decision 2026-10-29: the trip rows belong to the rough-in draw. Plan: HCP583-Sort_v4.md No estimates in this batch.',
    )
  })

  it('writes the source note as the mirror, and leaves Plan out when there is no source_ref', () => {
    const body = costMoveSourceNoteBody({ ...notesInput, sourceRef: undefined, moved: { bank: 1, supply: 0, clock: 0, other: 0 }, allocatedDollars: 84.1 })
    expect(body).toBe('2026-10-29 — cost batch: 1 row moved from here to J629 · ROUGH IN — 1 bank charge ($84.10). Reason: Owner decision 2026-10-29: the trip rows belong to the rough-in draw. No estimates in this batch.')
  })

  it('clamps a runaway note to the RPC limit', () => {
    const body = costMoveTargetNoteBody({ ...notesInput, reason: 'x'.repeat(3000) })
    expect(body.length).toBe(COST_BATCH_NOTE_MAX)
    expect(body.endsWith('…')).toBe(true)
  })

  it('builds the two thread notes, target first', () => {
    const notes = buildCostMoveNotes(notesInput)
    expect(notes.map((n) => n.job_id)).toEqual([TARGET.id, SOURCE.id])
    expect(notes[0]!.body).toContain('moved here from J583')
    expect(notes[1]!.body).toContain('moved from here to J629')
  })
})

describe('label and defaults', () => {
  it('names the move and the day, and cuts a long label', () => {
    expect(costMoveLabel(SOURCE, TARGET, '2026-10-29')).toBe('Move cost: J583 · Diamondback → J629 · ROUGH IN (2026-10-29)')
    const long = costMoveLabel({ ...SOURCE, label: 'A'.repeat(100) }, { ...TARGET, label: 'B'.repeat(100) }, '2026-10-29')
    expect(long.length).toBe(COST_BATCH_LABEL_MAX)
    expect(costMoveDefaultAllocationNote('2026-10-29')).toBe('Move cost 2026-10-29')
  })
})

describe('buildCostMovePlan', () => {
  const base = { todayYmd: '2026-10-29', sourceJob: SOURCE, targetJob: TARGET, rows, reason: 'Owner call', sourceRef: 'plan.md', authorUserId: USER, allocationNote: 'Move cost 2026-10-29' }

  it('builds the payload: move ops, then the two notes; the Other charge is held, not dropped', () => {
    const plan = buildCostMovePlan(base)
    expect(plan.problems).toEqual([])
    expect(plan.payload).not.toBeNull()
    expect(plan.payload!.label).toBe('Move cost: J583 · Diamondback → J629 · ROUGH IN (2026-10-29)')
    expect(plan.payload!.source_ref).toBe('plan.md')
    expect(plan.payload!.author_user_id).toBe(USER)
    expect(plan.payload!.author_label).toBe('Move cost screen')
    expect(plan.payload!.ops.map((o) => o.op)).toEqual(['allocate', 'supply_repoint', 'clock_repoint', 'thread_note', 'thread_note'])
    expect(plan.move.skipped).toHaveLength(1)
    expect(plan.move.skipped[0]!.row.source).toBe('other')
    const summary = summarizeCostBatchOps(plan.payload!.ops)
    expect(summary.byJob[TARGET.id]).toEqual({ allocated: 84.1, supply: 1, clockSessions: 1, otherCharges: 0, notes: 1 })
    expect(summary.byJob[SOURCE.id]).toEqual({ allocated: 0, supply: 0, clockSessions: 0, otherCharges: 0, notes: 1 })
    expect(summary.releasedFrom[SOURCE.id]).toBe(84.1)
  })

  it('refuses the same job both ways, an empty selection and a blank reason, with the words', () => {
    expect(buildCostMovePlan({ ...base, targetJob: SOURCE }).problems).toContain('Pick a different job to move the rows to: the target is the job they are on.')
    const empty = buildCostMovePlan({ ...base, rows: [rows[3]!] })
    expect(empty.payload).toBeNull()
    expect(empty.problems).toEqual(['Nothing selected can move. Tick a bank, supply-house or clock row.'])
    expect(buildCostMovePlan({ ...base, reason: '  ' }).problems).toEqual(['Write the reason: it is kept on the batch and in both notes.'])
  })

  it('hands the payload kernel the shape to check: a bad author id is refused there', () => {
    const plan = buildCostMovePlan({ ...base, authorUserId: 'not-a-uuid' })
    expect(plan.payload).toBeNull()
    expect(plan.problems.some((p) => p.includes('author_user_id'))).toBe(true)
  })
})
