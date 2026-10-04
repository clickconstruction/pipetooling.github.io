import { describe, expect, it } from 'vitest'
import { declinedTitle, declinedWords, declineReasonWords, gcReducer, initialGcState, partnerDeclines } from './gcModel'

describe('why a company is out (the owner, 2026-10-04)', () => {
  it('says the reason in the chip and the note in the hover', () => {
    const state = gcReducer(initialGcState(), {
      type: 'officeDecline',
      projectId: 'boerne',
      packageId: 'roof',
      inviteId: 'roof-bluebonnet',
      why: 'wont',
      reason: 'busy',
      note: 'both crews are on a school job',
    })
    const invite = state.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'roof')?.invites.find((i) => i.id === 'roof-bluebonnet')
    if (!invite) throw new Error('no invite')
    expect(declinedWords(invite)).toBe('will not do it · too busy')
    expect(declinedTitle(invite)).toBe(`too busy: both crews are on a school job. Written down Oct 2.`)
    expect(state.log[0]?.text).toBe('Bluebonnet Roofing will not do Roofing. Why: too busy, "both crews are on a school job". Offer it to the next company.')
    expect(partnerDeclines(state, 'bluebonnet').map((d) => d.pkg.trade)).toEqual(['Roofing'])
  })

  it('keeps the old words when no reason was given', () => {
    const state = gcReducer(initialGcState(), { type: 'officeDecline', projectId: 'boerne', packageId: 'roof', inviteId: 'roof-bluebonnet', why: 'cant' })
    const invite = state.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'roof')?.invites.find((i) => i.id === 'roof-bluebonnet')
    expect(invite && declinedWords(invite)).toBe('cannot do it')
    expect(partnerDeclines(state, 'bluebonnet')).toEqual([])
  })

  it("an 'other' reason reads as their words", () => {
    expect(declineReasonWords({ reason: 'other', note: 'owner is a competitor of theirs', on: '2026-10-02' })).toBe('owner is a competitor of theirs')
  })
})
