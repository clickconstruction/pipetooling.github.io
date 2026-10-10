import { describe, expect, it } from 'vitest'
import { changeEmail, DRAW_PORTAL_LIVE, lessEmail, paidEmail, WAIVER_SIGN_LIVE, type DrawEmailTo } from './drawEmail'
import type { ChangeOrder, Draw } from './types'

const to: DrawEmailTo = { companyId: 'c1', projectId: 'p1', project: 'Fair Oaks Clinic', trade: 'Concrete', lang: 'en' }

const draw = (change: Partial<Draw> = {}): Draw => ({
  id: 'd2',
  number: 2,
  requestedOn: '2026-10-03',
  gross: 13200,
  retainage: 1320,
  net: 11880,
  status: 'paid',
  waiver: 'conditional',
  lines: [{ sovId: 'L1', toPct: 100 }],
  ...change,
})

describe('the Draws window’s emails to a trade', () => {
  it('says a draw is paid and what we hold, keyed once per draw, with no waiver line while the owner’s call holds it', () => {
    expect(WAIVER_SIGN_LIVE).toBe(false)
    expect(paidEmail(to, draw())).toEqual({
      companyId: 'c1',
      kind: 'paid',
      key: 'd2:paid',
      projectId: 'p1',
      lang: 'en',
      subject: 'Pay application 2 on Fair Oaks Clinic is paid',
      lines: ['We paid $11,880 for pay application 2 on Concrete for Fair Oaks Clinic.', 'We hold $1,320 of it until the job is done.'],
    })
    expect(paidEmail(to, draw({ status: 'approved' }))).toBeNull()
  })

  it('says the retainage is paid back, in Spanish too', () => {
    const release = draw({ id: 'd4', number: 4, final: true, gross: 0, retainage: -3000, net: 3000 })
    expect(paidEmail(to, release)?.subject).toBe('Your retainage on Fair Oaks Clinic is paid')
    expect(paidEmail(to, release)?.lines).toEqual(['We paid back the $3,000 we held on Concrete for Fair Oaks Clinic.'])
    expect(paidEmail({ ...to, lang: 'es' }, release)?.lines).toEqual(['Le devolvimos los $3,000 que retuvimos de Concrete en Fair Oaks Clinic.'])
  })

  it('says a draw approved for less, what they asked and why', () => {
    const less = draw({ status: 'approved', net: 5310, asked: { gross: 7100, retainage: 710, net: 6390, lines: [], note: 'Footings is at 90%.', on: '2026-10-09' } })
    expect(lessEmail(to, less)).toEqual({
      companyId: 'c1',
      kind: 'less',
      key: 'd2:less',
      projectId: 'p1',
      lang: 'en',
      subject: 'Pay application 2 on Fair Oaks Clinic: approved for less',
      lines: ['We approved $5,310 of the $6,390 you asked for on pay application 2 for Concrete on Fair Oaks Clinic.', 'Footings is at 90%.', 'The rest is still yours to ask for once the work is there.'],
    })
    expect(lessEmail(to, draw())).toBeNull()
  })

  it('sends a change to sign in the portal, keyed once per change order, and nothing before it was sent (P5c-3b)', () => {
    expect(DRAW_PORTAL_LIVE).toBe(true)
    const co: ChangeOrder = {
      id: 'co1', number: 1, description: 'Leave out the curb.', reason: 'owner', schedule: 'none', packageId: 'k', cost: -2000, price: -2200,
      status: 'signed', sentOn: '2026-10-01', answeredOn: '2026-10-03', pctDone: 0,
      tradeChange: { status: 'sent', sentOn: '2026-10-05', signedOn: null, sovLineId: '' },
    }
    expect(changeEmail(to, co)).toEqual({
      companyId: 'c1',
      kind: 'change',
      key: 'co1:change',
      projectId: 'p1',
      lang: 'en',
      subject: 'Change order 1 on Fair Oaks Clinic',
      lines: [
        'We have a change to your Concrete work on Fair Oaks Clinic: Leave out the curb.',
        'It takes off $2,000 from your statement of work.',
        'Open your portal to read it and sign it.',
      ],
    })
    expect(changeEmail(to, { ...co, tradeChange: undefined })).toBeNull()
  })
})
