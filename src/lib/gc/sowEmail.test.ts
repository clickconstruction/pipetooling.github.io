import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { awardedClinicBoardRows, clinicBoardRows } from './boardTestRows'
import { SOW_SIGN_SCREEN_LIVE, sowEmailRequest } from './sowEmail'

describe('the statement of work’s email (the Board’s B6-a-ii)', () => {
  it('goes to the company awarded, keyed by the statement of work, in the Portal’s words without the greeting', () => {
    const state = boardStateFromRows(awardedClinicBoardRows())
    expect(sowEmailRequest(state, 'p1', 'k1', 'w1', 'en')).toEqual({
      companyId: 'lonestar',
      kind: 'sow',
      key: 'w1:sow',
      projectId: 'p1',
      lang: 'en',
      subject: 'Your statement of work for Sitework on Hill Country Clinic',
      lines: [
        'We picked your quote for Sitework on Hill Country Clinic. Thank you.',
        'Your statement of work is ready: $66,500, based on the Bid set.',
        'We hold back 10% of each draw until the job is done.',
        'Open your portal to read it and sign it.',
      ],
    })
  })

  it('in Spanish for a company that reads Spanish', () => {
    const state = boardStateFromRows(awardedClinicBoardRows())
    const es = sowEmailRequest(state, 'p1', 'k1', 'w1', 'es')
    expect(es?.subject).toBe('Su orden de trabajo de Sitework para Hill Country Clinic')
    expect(es?.lines[0]).toBe('Elegimos su cotización de Sitework para Hill Country Clinic. Gracias.')
  })

  it('none for a trade with no statement of work, or one not on the project', () => {
    const state = boardStateFromRows(clinicBoardRows())
    expect(sowEmailRequest(state, 'p1', 'k1', 'w1', 'en')).toBeNull()
    expect(sowEmailRequest(boardStateFromRows(awardedClinicBoardRows()), 'p1', 'k2', 'w1', 'en')).toBeNull()
  })

  it('the box to email it stays hidden until the Portal’s sign screen is live (its P2c sets this)', () => {
    expect(SOW_SIGN_SCREEN_LIVE).toBe(false)
  })
})
