/**
 * The tests of `gcPaperSend.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { partnerById } from './lookups'
import { paperStep } from './paperSend'
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
