import { describe, expect, it } from 'vitest'
import {
  LIEN_WAIVER_FORMS,
  LIEN_WAIVER_SETTLE_DAYS,
  LIEN_WAIVER_STANDARD_EXTENT,
  guessLienWaiver,
  isLienWaiverDocumentName,
  lienWaiverForm,
  lienWaiverKindFor,
  lienWaiverMoney,
  lienWaiverSeedValues,
} from './lienWaiverPick'

const TODAY = '2026-09-07'
const pay = (amount: number, day: string) => ({ amount, payment_date: day, created_at: `${day}T15:00:00Z` })

describe('lienWaiverKindFor', () => {
  it('maps the two facts onto the four statutory forms', () => {
    expect(lienWaiverKindFor(false, false)).toBe('conditional_progress')
    expect(lienWaiverKindFor(true, false)).toBe('unconditional_progress')
    expect(lienWaiverKindFor(false, true)).toBe('conditional_final')
    expect(lienWaiverKindFor(true, true)).toBe('unconditional_final')
  })

  it('every form carries its statute section and the Book document name', () => {
    expect(LIEN_WAIVER_FORMS).toHaveLength(4)
    for (const f of LIEN_WAIVER_FORMS) {
      expect(f.cite).toMatch(/§ 53\.284\([b-e]\)/)
      expect(isLienWaiverDocumentName(f.documentName)).toBe(true)
      expect(lienWaiverForm(f.kind)).toBe(f)
    }
    expect(isLienWaiverDocumentName('W-9')).toBe(false)
  })
})

describe('guessLienWaiver', () => {
  it('nothing paid yet → conditional progress, with the first-check reason', () => {
    const g = guessLienWaiver({ payments: [], balance: 4200, todayYmd: TODAY })
    expect(g).toMatchObject({ payment: null, settled: false, final: false, kind: 'conditional_progress' })
    expect(g.reasons[0]).toMatch(/first check/)
  })

  it('a payment recorded today is not settled → conditional', () => {
    const g = guessLienWaiver({ payments: [pay(17752.65, TODAY)], balance: 22247.35, todayYmd: TODAY })
    expect(g.kind).toBe('conditional_progress')
    expect(g.settled).toBe(false)
    expect(g.reasons[0]).toMatch(/recorded today/)
  })

  it(`a payment ${LIEN_WAIVER_SETTLE_DAYS}+ days old is presumed settled → unconditional`, () => {
    const g = guessLienWaiver({ payments: [pay(17752.65, '2026-09-01')], balance: 22247.35, todayYmd: TODAY })
    expect(g.kind).toBe('unconditional_progress')
    expect(g.reasons[0]).toMatch(/6 days ago/)
  })

  it('a zero balance after a payment → final; the newest positive payment is the subject', () => {
    const g = guessLienWaiver({ payments: [pay(10000, '2026-08-01'), pay(-500, '2026-08-10'), pay(4500, TODAY)], balance: 0, todayYmd: TODAY })
    expect(g.kind).toBe('conditional_final')
    expect(g.payment?.amount).toBe(4500)
    expect(g.reasons[1]).toMatch(/final one/)
  })

  it('settled and final → unconditional final', () => {
    expect(guessLienWaiver({ payments: [pay(4500, '2026-08-20')], balance: 0, todayYmd: TODAY }).kind).toBe('unconditional_final')
  })

  it('a zero balance with nothing paid is not "final" (an unpriced sheet)', () => {
    expect(guessLienWaiver({ payments: [], balance: 0, todayYmd: TODAY }).final).toBe(false)
  })
})

describe('lienWaiverSeedValues', () => {
  const base = { project: ' Mission Pet Health ', jobNo: 'J1042', amount: 17752.65, owner: 'Mission Pet Health', location: '415 Springtown Way, San Marcos, TX 78666' }

  it('seeds only boxes the form has, trimmed, with the standard extent sentence', () => {
    const v = lienWaiverSeedValues({ kind: 'conditional_progress', ...base, boxKeys: ['project', 'job_no', 'amount', 'owner', 'location', 'job_description', 'payee'] })
    expect(v).toEqual({ project: 'Mission Pet Health', job_no: 'J1042', amount: '17752.65', owner: 'Mission Pet Health', location: '415 Springtown Way, San Marcos, TX 78666', job_description: LIEN_WAIVER_STANDARD_EXTENT })
  })

  it('the unconditional-final form has no amount box, so no amount is seeded', () => {
    const v = lienWaiverSeedValues({ kind: 'unconditional_final', ...base, boxKeys: ['project', 'job_no', 'owner', 'location', 'job_description'] })
    expect(v.amount).toBeUndefined()
    expect(v.project).toBe('Mission Pet Health')
  })

  it('blank inputs seed nothing for that box', () => {
    const v = lienWaiverSeedValues({ kind: 'conditional_progress', project: null, jobNo: '', amount: 0, owner: null, location: null, boxKeys: ['project', 'job_no', 'amount', 'owner', 'location', 'job_description'] })
    expect(v).toEqual({ job_description: LIEN_WAIVER_STANDARD_EXTENT })
  })
})

describe('lienWaiverMoney', () => {
  it('writes money like a check', () => {
    expect(lienWaiverMoney(17752.65)).toBe('$17,752.65')
    expect(lienWaiverMoney(4200)).toBe('$4,200.00')
  })
})
