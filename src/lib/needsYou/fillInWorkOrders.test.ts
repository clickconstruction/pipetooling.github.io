import { describe, expect, it } from 'vitest'
import { EMPTY_WORK_ORDER_DECISION, workOrderDecisionReady, workOrderFillInRows, workOrderTrailWords, workOrderWrites, type WorkOrderSources } from './fillInWorkOrders'

const NOW = Date.parse('2026-10-29T15:00:00Z')

const sources = (): WorkOrderSources => ({
  drafts: [
    { id: 'wo-2', person_id: 'p-2', display_name: 'Rudy Vega', job_id: 'j-983', created_at: '2026-10-21T14:00:00Z', offer_scope_snapshot: { anchor: 'job', lines: [{ label: 'Rough-in', amount: null }, { label: 'Top-out', amount: null }, { label: 'Trim-set', amount: null }, { label: 'Gas test', amount: null }, { label: 'Haul off', amount: null }] }, proposed_start: '2026-11-03', proposed_end: '2026-11-07' },
    { id: 'wo-1', person_id: 'p-1', display_name: 'Dale Brennan', job_id: 'j-650', created_at: '2026-10-27T14:00:00Z', offer_scope_snapshot: null, proposed_start: null, proposed_end: null },
    { id: 'wo-3', person_id: 'p-3', display_name: 'Ana Ruiz', job_id: null, created_at: '2026-10-28T14:00:00Z', offer_scope_snapshot: { lines: [{ label: 'Water heater swap', amount: null }] }, proposed_start: null, proposed_end: null },
  ],
  jobs: [
    { id: 'j-983', hcp_number: '983', click_number: null, job_name: 'Water Heater removal', job_address: null },
    { id: 'j-650', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: null },
  ],
  hints: [
    { jobId: 'j-983', rough_in: 2000, top_out: 1400, trim_set: 800, total: 4200 },
    { jobId: 'j-650', rough_in: 0, top_out: 0, trim_set: 0, total: 0 },
  ],
  nowMs: NOW,
})

describe('fillInWorkOrders · the rows (punch list #178, PR 5)', () => {
  it('one row per draft, oldest first, titled by the sub, the job and the day', () => {
    const rows = workOrderFillInRows(sources())
    expect(rows.map((r) => r.commitmentId)).toEqual(['wo-2', 'wo-1', 'wo-3'])
    expect(rows[0]!.title).toBe('Rudy Vega · #983 Water Heater removal · drafted Oct 21')
    expect(rows[2]!.title).toBe('Ana Ruiz · no job yet · drafted Oct 28')
    expect(rows[0]!.doorHref).toBe('/jobs?tab=subs&wo=wo-2')
    expect(rows[0]!.severity).toBe('amber')
    expect(rows[0]!.ageDays).toBe(8)
  })

  it('says what the app knows: the draft, the scope, the window, the bid’s sub labor', () => {
    const [two, one, three] = workOrderFillInRows(sources())
    expect(two!.knows).toEqual([
      'Drafted for Rudy Vega Oct 21, 8 days ago.',
      'Scope: Rough-in, Top-out, Trim-set, Gas test and 1 more.',
      'Proposed Nov 3 to Nov 7.',
      'From the bid: $4,200.00 sub labor. Rough-in $2,000.00, top-out $1,400.00, trim-set $800.00.',
    ])
    expect(two!.hint).toEqual({ rough_in: 2000, top_out: 1400, trim_set: 800, total: 4200 })
    // A zero total is no hint.
    expect(one!.knows).toEqual(['Drafted for Dale Brennan Oct 27, 2 days ago.', 'No scope lines ticked yet.', 'No bid behind the job, so no price hint.'])
    expect(one!.hint).toBeNull()
    expect(three!.knows[2]).toBe('No job on the draft yet, so no price hint.')
  })

  it('is ready with a price above zero, writes the assembler’s one column, and the trail says where the send waits', () => {
    const [row] = workOrderFillInRows(sources())
    expect(workOrderDecisionReady(EMPTY_WORK_ORDER_DECISION)).toBe(false)
    expect(workOrderDecisionReady({ amount: '0' })).toBe(false)
    expect(workOrderDecisionReady({ amount: 'abc' })).toBe(false)
    expect(workOrderDecisionReady({ amount: ' 4200 ' })).toBe(true)
    expect(workOrderWrites(row!, EMPTY_WORK_ORDER_DECISION)).toBeNull()
    const w = workOrderWrites(row!, { amount: '4200.005' })!
    expect(w).toEqual({ commitmentId: 'wo-2', amount: 4200.01 })
    expect(workOrderTrailWords(w)).toBe('priced $4,200.01 · the board\'s Next is Send for signature')
  })
})
