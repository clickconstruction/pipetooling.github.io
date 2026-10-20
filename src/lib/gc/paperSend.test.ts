/**
 * The tests of `gcPaperSend.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { ymdAddDays } from '../../utils/dateUtils'
import { partnerById } from './lookups'
import { paperStep } from './paperSend'
import { INSURANCE_ASK_DAYS, insuranceRenewals } from './promises'
import { initialGcState } from './schedule/testState'
import type { GcState, Partner } from './types'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

const step = (state: GcState, id: string, key: string) => paperStep(state, partner(state, id), key)

describe('send a paper from the company window (the owner, 2026-10-04)', () => {
  it('each paper has one next step, named for what happens', () => {
    const state = initialGcState()
    // Bluebonnet's master agreement went Sep 30 and is not signed: remind them.
    expect(step(state, 'bluebonnet', 'msa')).toMatchObject({
      mode: 'reminder',
      verb: 'Remind them',
      dayWord: 'Sign by',
      history: 'First sent Sep 30, 2 days ago. This is the first reminder.',
    })
    // Hillside has none: send it to sign. A signed one has nothing to send.
    expect(step(state, 'hillside', 'msa')).toMatchObject({ mode: 'first', verb: 'Send to sign' })
    expect(step(state, 'pecanvalley', 'msa')).toBeNull()
    // Insurance that ran out, a missing W-9, an owed waiver, a drafted statement of work.
    expect(step(state, 'pecanvalley', 'insurance')).toMatchObject({ mode: 'first', verb: 'Ask for it', dayWord: 'Send by', title: 'Ask for the renewed insurance certificate' })
    expect(step(state, 'hillside', 'w9')).toMatchObject({ mode: 'first', verb: 'Ask for it', title: 'Ask for their W-9' })
    expect(step(state, 'pecanvalley', 'waivers-felec')).toMatchObject({ verb: 'Ask for the waiver', draws: [1], what: 'the unconditional lien waiver on draw 1' })
    expect(step(state, 'kendall', 'sow-dhvac')).toMatchObject({ mode: 'first', verb: 'Send to sign' })
    // Insurance good for months has nothing to send.
    expect(step(state, 'ironhorse', 'insurance')).toBeNull()
  })
})

describe('a paper its portal started or sent (P5b-2)', () => {
  it('reads a certificate that came in from the portal as still owed, with the day it came, until it is marked good', () => {
    const state = initialGcState()
    const p = { ...partner(state, 'pecanvalley'), coiReceived: { id: 'paper-1', sentOn: '2026-10-01', expires: '2027-10-01' } }
    const s = paperStep(state, p, 'insurance')
    expect(s).toMatchObject({ mode: 'first', verb: 'Ask for it', history: 'Came in from their portal Oct 1. It counts once it is marked good.' })
  })

  it('reads a W-9 started in the portal, with no send of ours, as started there', () => {
    const state = initialGcState()
    const p = { ...partner(state, 'hillside'), w9SentOn: '2026-10-01' }
    expect(paperStep(state, p, 'w9')).toMatchObject({ mode: 'first', verb: 'Ask for it', history: 'Started in their portal Oct 1.' })
    expect(paperStep(state, partner(state, 'hillside'), 'w9')).toMatchObject({ history: 'Not asked yet.' })
  })
})

describe('the insurance ask and the renewal list read one window', () => {
  it('asks for the renewed certificate on exactly the days the renewal list chases it, so the two never drift', () => {
    const state = initialGcState()
    const offsets = [-5, 0, INSURANCE_ASK_DAYS - 1, INSURANCE_ASK_DAYS, INSURANCE_ASK_DAYS + 1, INSURANCE_ASK_DAYS + 60]
    const read = offsets.map((d) => {
      const p = { ...partner(state, 'ironhorse'), coiExpires: ymdAddDays(state.today, d) }
      const withP = { ...state, partners: state.partners.map((x) => (x.id === p.id ? p : x)) }
      return [d, paperStep(withP, p, 'insurance') !== null, insuranceRenewals(withP).some((r) => r.partner.id === p.id)]
    })
    expect(read.every(([, asks, renews]) => asks === renews)).toBe(true)
    expect(read.map(([d, asks]) => [d, asks])).toEqual([
      [-5, true],
      [0, true],
      [INSURANCE_ASK_DAYS - 1, true],
      [INSURANCE_ASK_DAYS, true],
      [INSURANCE_ASK_DAYS + 1, false],
      [INSURANCE_ASK_DAYS + 60, false],
    ])
  })
})
