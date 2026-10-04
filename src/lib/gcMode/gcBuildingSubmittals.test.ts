/**
 * GC mode — design spike: submittals (gcBuildingSubmittals.ts, the reducer's submittal moves).
 * Fair Oaks D's register: the panelboards approved late on the second round, the fire alarm with
 * the architect, Summit's flashing drawings waiting on us and needed today, the controls not sent.
 */
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, stageProgress, submittalCounts, submittalHolding, submittalRows, type GcAction, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}
const row = (s: GcState, id: string) => submittalRows(s, fairOaks(s)).find((r) => r.submittal.id === id)
const play = (s: GcState, ...actions: GcAction[]) => actions.reduce(gcReducer, s)
const flashing = 'fairoaksd-sub-6'

describe('submittals', () => {
  it('reads whose move each is, when it is needed and how late', () => {
    const s = initialGcState()
    expect(submittalRows(s, fairOaks(s)).map((r) => [r.submittal.number, r.state, r.neededBy, r.daysLate])).toEqual([
      ['26 24 16-01', 'approved', '2026-08-24', 15],
      ['28 31 11-01', 'architect', '2026-10-19', 0],
      ['23 81 19-01', 'approved', '2026-09-12', 0],
      ['23 09 23-01', 'trade', '2026-10-23', 0],
      ['07 54 23-01', 'approved', '2026-09-14', 0],
      ['07 62 00-01', 'us', '2026-10-02', 0],
    ])
    expect(submittalCounts(s, fairOaks(s))).toEqual({ trade: 1, us: 1, architect: 1, approved: 3, late: 0 })
    expect(row(s, 'fairoaksd-sub-1')?.company).toBe('Pecan Valley Electric')
  })

  it('holds the schedule lines it covers until approved, and the ring card says what waits on us', () => {
    const s = initialGcState()
    expect(submittalHolding(fairOaks(s), 'froof-3')?.number).toBe('07 62 00-01')
    expect(submittalHolding(fairOaks(s), 'felec-2')).toBeNull()
    expect(stageProgress(s, fairOaks(s)).also).toContain('Submittal 07 62 00-01, Sheet metal and flashing, from Summit Roofing waits on us. It is needed today.')
  })

  it('goes to the architect, back to revise, round again, and is approved', () => {
    const s = initialGcState()
    const toArchitect: GcAction = { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: flashing }
    const sent = gcReducer(s, toArchitect)
    expect(row(sent, flashing)?.state).toBe('architect')
    // Revise needs a note.
    expect(gcReducer(sent, { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: flashing, answer: 'revise', note: ' ' })).toBe(sent)
    const back = gcReducer(sent, { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: flashing, answer: 'revise', note: 'Show the cleat spacing at the coping.' })
    expect(row(back, flashing)?.state).toBe('trade')
    expect(back.log[0]?.text).toBe('Marsh & Vale Architects sent it back to revise: submittal 07 62 00-01, Sheet metal and flashing. Show the cleat spacing at the coping.')
    const done = play(
      back,
      { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: flashing, file: 'Summit-flashing-r1.pdf', note: 'Cleat spacing added.' },
      toArchitect,
      { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: flashing, answer: 'approved as noted', note: 'Use 24 gauge at the corners.' },
    )
    expect(row(done, flashing)).toMatchObject({ state: 'approved', approvedOn: '2026-10-02', daysLate: 0 })
    expect(row(done, flashing)?.submittal.rounds).toHaveLength(2)
    expect(submittalHolding(fairOaks(done), 'froof-3')).toBeNull()
  })

  it('takes each move only in its turn', () => {
    const s = initialGcState()
    // Not the trade's move: it is with us.
    expect(gcReducer(s, { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: flashing, file: 'x.pdf', note: '' })).toBe(s)
    // The trade's move needs a file.
    expect(gcReducer(s, { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-4', file: ' ', note: '' })).toBe(s)
    // Nothing to send on until it came in.
    expect(gcReducer(s, { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-4' })).toBe(s)
  })

  it('adds one to the register, numbered by its spec section, and needed by its work less the lead days', () => {
    const s = gcReducer(initialGcState(), {
      type: 'addSubmittal',
      projectId: 'fairoaksd',
      packageId: 'felec',
      title: 'Site lighting fixtures',
      kind: 'product data',
      specSection: '26 56 00',
      lineIds: ['felec-5', 'nope'],
      leadDays: 21,
    })
    const r = row(s, 'fairoaksd-sub-7')
    expect(r?.submittal).toMatchObject({ number: '26 56 00-01', lineIds: ['felec-5'], askedOn: '2026-10-02', rounds: [] })
    // Site lighting starts Oct 19; 21 days before is Sep 28, already past.
    expect([r?.state, r?.neededBy, r?.daysLate]).toEqual(['trade', '2026-09-28', 4])
    expect(stageProgress(s, fairOaks(s)).also).toContain('Submittal 26 56 00-01, Site lighting fixtures, from Pecan Valley Electric is 4 days late. They have not sent it yet.')
  })
})
