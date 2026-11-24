/**
 * The tests of `gcDecline.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { TAKEN_BACK_TITLE, askTakenBack, declineReasonWords, declinedTitle, declinedWords, partnerDeclines } from './decline'
import { priceStanding } from './priceStanding'
import { initialGcState } from './schedule/testState'

describe('why a company is out (the owner, 2026-10-04)', () => {
  it("an 'other' reason reads as their words", () => {
    expect(declineReasonWords({ reason: 'other', note: 'owner is a competitor of theirs', on: '2026-10-02' })).toBe('owner is a competitor of theirs')
  })
})

// v2.8490: an ask we took back after the company heard about it. Closed like a pass, and never read as their answer.
describe('an ask we took back (v2.8490)', () => {
  /** The clinic's sitework with Hillside's opened ask closed as ours, as `gc_take_ask_back` leaves the row. */
  function tookBack() {
    const base = clinicBoardRows()
    return boardStateFromRows(clinicBoardRows({ invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'withdrawn', declined_on: '2026-10-07' } : i)) }))
  }

  it('reads off the row as ours, with its own chip and hover', () => {
    const invite = tookBack().projects[0]!.packages[0]!.invites.find((i) => i.id === 'i2')!
    expect([invite.status, invite.declinedWhy, invite.declineReason]).toEqual(['declined', 'withdrawn', undefined])
    expect(askTakenBack(invite)).toBe(true)
    expect(declinedWords(invite)).toBe('we took it back')
    expect(declinedTitle(invite)).toBe(TAKEN_BACK_TITLE)
  })

  it('a pass of theirs is not ours, by phone or in their portal', () => {
    expect(askTakenBack({ status: 'declined', declinedWhy: 'cant' })).toBe(false)
    expect(askTakenBack({ status: 'declined' })).toBe(false)
    // A stray answer on an ask still open closes nothing.
    expect(askTakenBack({ status: 'opened', declinedWhy: 'withdrawn' })).toBe(false)
  })

  it('is not one of the times they passed', () => {
    expect(partnerDeclines(tookBack(), 'hillside')).toEqual([])
  })

  it('the price line says we took it back, never that they said no', () => {
    const s = initialGcState()
    const project = s.projects.find((p) => p.id === 'boerne')!
    const steel = project.packages.find((k) => k.trade === 'Structural steel')!
    const passed = steel.invites.find((i) => i.status === 'declined')!
    passed.declinedWhy = 'withdrawn'
    delete passed.declineReason
    const words = priceStanding(s, project).rows.find((r) => r.pkg.trade === 'Structural steel')!.words
    expect(words).toBe('Bexar Steel Erectors has not opened it. We took the ask back from Comal Iron. Quotes are due Thu Oct 8. Our budget is shown.')
  })
})
