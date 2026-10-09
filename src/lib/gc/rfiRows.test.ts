import { describe, expect, it } from 'vitest'
import { rfiRows } from './buildingRfis'
import { initialGcState } from './schedule/testState'
import { addRfiPayload, answerRfiPayload, holdsForSheets, rfiExtras, rfiFromRows, rfisFromRows, withRfis, type RfiTables } from './rfiRows'
import type { GcState, Rfi } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

/** A project's RFIs as the two tables would hold them. The holds come back in no order, as a read may give them. */
function rowsOf(projectId: string, rfis: Rfi[]): RfiTables {
  return {
    rfis: rfis.map((r) => ({
      id: r.id,
      project_id: projectId,
      number: r.number,
      question: r.question,
      sheets: r.sheets,
      package_id: r.packageId,
      asked_by_company_id: r.partnerId,
      recorded_by: r.partnerId ? null : 'user-1',
      asked_on: r.askedOn,
      needed_days: r.neededDays,
      sent_to_architect_on: r.sentToArchitectOn,
      email_send_log_id: null,
      answered_on: r.answer?.on ?? null,
      answer_text: r.answer?.text ?? null,
      answered_by: r.answer?.by ?? null,
      impact: r.answer?.impact ?? null,
      cost: r.answer?.cost ?? 0,
      days: r.answer?.days ?? 0,
      change_order_id: r.changeOrderId,
      created_at: '2026-08-01T00:00:00Z',
    })),
    holds: rfis.flatMap((r) => r.holds.map((id) => ({ rfi_id: r.id, scope_item_id: id }))).reverse(),
  }
}

describe('RFIs from their rows', () => {
  it('reads Fair Oaks D’s four back as the prototype holds them', () => {
    const rfis = fairOaks(initialGcState()).rfis ?? []
    expect(rfis).toHaveLength(4)
    expect(rfisFromRows('fairoaksd', rowsOf('fairoaksd', rfis))).toEqual([...rfis].sort((a, b) => a.number - b.number))
  })

  it('gives the kernels the same RFIs: whose move, when needed, and what can start a change order', () => {
    const state = initialGcState()
    const rfis = fairOaks(state).rfis ?? []
    const without: GcState = { ...state, projects: state.projects.map((p) => ({ ...p, rfis: [] })) }
    const read = withRfis(without, rowsOf('fairoaksd', rfis))
    const words = (s: GcState) => rfiRows(s, fairOaks(s)).map((r) => `${r.label} ${r.state} ${r.needed ?? '-'} ${r.canStartChangeOrder}`)
    expect(words(read)).toEqual(words(state))
    expect(words(read)).toContain('RFI-001 answered - true')
  })

  it('keeps an answer’s cost a number and a missing answer null', () => {
    const rfis = fairOaks(initialGcState()).rfis ?? []
    const tables = rowsOf('p', rfis)
    // A numeric column can come back from the API as a string; the kernel reads a number.
    const asText = { ...tables, rfis: tables.rfis.map((r) => ({ ...r, cost: String(r.cost) as unknown as number })) }
    const first = rfisFromRows('p', asText).find((r) => r.number === 1)
    expect(first?.answer).toEqual(rfis.find((r) => r.number === 1)?.answer)
    expect(first?.answer?.cost).toBe(3800)
    const open = rfiFromRows({ ...tables.rfis[0]!, answered_on: null, answer_text: null, answered_by: null, impact: null }, [])
    expect(open.answer).toBeNull()
    expect(open.holds).toEqual([])
  })

  it('says an answerer or an impact the app does not know in words', () => {
    const tables = rowsOf('p', fairOaks(initialGcState()).rfis ?? [])
    const answered = tables.rfis.find((r) => r.answered_on !== null)!
    expect(() => rfiFromRows({ ...answered, answered_by: 'owner' }, [])).toThrow('An RFI\'s answerer reads "owner", which the app does not know.')
    expect(() => rfiFromRows({ ...answered, impact: 'maybe' }, [])).toThrow('An RFI\'s impact reads "maybe", which the app does not know.')
  })

  it('keeps the email that took it and who of ours typed it beside the kernel’s shape', () => {
    const tables = rowsOf('p', fairOaks(initialGcState()).rfis ?? [])
    const sent = { ...tables, rfis: tables.rfis.map((r) => (r.number === 3 ? { ...r, email_send_log_id: 'log-3' } : r)) }
    const extras = rfiExtras(sent)
    const third = sent.rfis.find((r) => r.number === 3)!
    expect(extras.get(third.id)).toEqual({ emailSendLogId: 'log-3', recordedBy: null })
    expect(extras.get(sent.rfis.find((r) => r.number === 1)!.id)).toEqual({ emailSendLogId: null, recordedBy: 'user-1' })
  })
})

describe('what the presses send', () => {
  it('asks with the words trimmed, each sheet and line once, and whole days', () => {
    expect(
      addRfiPayload({ projectId: 'p', question: '  Slab thickness at grid C? ', sheets: [' S-101 ', '', 'S-101', 'S-102'], packageId: 'k', askedByCompanyId: 'c', holds: ['a', 'b', 'a'], neededDays: 4.6 }),
    ).toEqual({ projectId: 'p', question: 'Slab thickness at grid C?', sheets: ['S-101', 'S-102'], packageId: 'k', askedByCompanyId: 'c', holds: ['a', 'b'], neededDays: 5 })
  })

  it('leaves days that are not a number of none or more to the database’s default', () => {
    expect(addRfiPayload({ projectId: 'p', question: 'Q', sheets: [], packageId: null, askedByCompanyId: null, holds: [], neededDays: -1 })).not.toHaveProperty('neededDays')
    expect(addRfiPayload({ projectId: 'p', question: 'Q', sheets: [], packageId: null, askedByCompanyId: null, holds: [], neededDays: Number.NaN })).not.toHaveProperty('neededDays')
  })

  it('answers with a cost and days only when it adds cost', () => {
    expect(answerRfiPayload({ text: ' Use 6 in. ', by: 'architect', impact: 'cost', cost: 3800.4, days: 1.6 })).toEqual({ text: 'Use 6 in.', by: 'architect', impact: 'cost', cost: 3800, days: 2 })
    expect(answerRfiPayload({ text: 'Revised detail', by: 'us', impact: 'plans', cost: 500, days: 3 })).toEqual({ text: 'Revised detail', by: 'us', impact: 'plans', cost: 0, days: 0 })
  })

  it('points at the lines whose own sheets the question names, without case or spaces', () => {
    expect(holdsForSheets(['s-101', ' m-101 '], { footings: ['S-101'], duct: ['M-101', 'M-102'], slab: ['S-102'], none: null })).toEqual(['footings', 'duct'])
    expect(holdsForSheets([], { footings: ['S-101'] })).toEqual([])
  })
})
