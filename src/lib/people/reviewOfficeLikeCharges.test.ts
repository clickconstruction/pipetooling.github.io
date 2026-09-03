import { describe, expect, it } from 'vitest'
import { OFFICE_LIKE_MERCURY_CATEGORIES, mercuryCategoryString, summarizeOfficeLikeCharges } from './reviewOfficeLikeCharges'

describe('mercuryCategoryString', () => {
  it('reads the jsonb category as a string and tolerates null / objects', () => {
    expect(mercuryCategoryString('Software')).toBe('Software')
    expect(mercuryCategoryString(' Utilities ')).toBe('Utilities')
    expect(mercuryCategoryString({ name: 'Medical' })).toBe('Medical')
    expect(mercuryCategoryString(null)).toBeNull()
    expect(mercuryCategoryString(42)).toBeNull()
  })
})

describe('summarizeOfficeLikeCharges', () => {
  const office = 'office-job'
  const rows = [
    { jobId: 'j1', amount: -1700, category: 'Software', counterparty: 'Auto Group' },
    { jobId: 'j1', amount: -364, category: 'Utilities', counterparty: 'City Of Kyle' },
    { jobId: 'j2', amount: -150, category: 'Medical', counterparty: 'Vital Psych MD' },
    { jobId: 'j2', amount: 40, category: 'Medical', counterparty: 'CVS' }, // refund still a charge by abs — flagged for sorting
    { jobId: 'j3', amount: -500, category: 'FuelAndGas', counterparty: 'Shell' }, // not office-like
    { jobId: office, amount: -900, category: 'Software', counterparty: 'Adobe' }, // office job — fine
    { jobId: 'j4', amount: -20, category: null, counterparty: 'Unknown Co' },
  ]

  it('sums only office-type categories on non-office jobs and ranks the lines', () => {
    const s = summarizeOfficeLikeCharges(rows, office)
    expect(s.usd).toBe(1700 + 364 + 150 + 40)
    expect(s.charges).toBe(4)
    expect(s.jobs).toBe(2)
    expect(s.top.map((t) => `${t.category} · ${t.counterparty} $${t.usd}`)).toEqual([
      'Software · Auto Group $1700',
      'Utilities · City Of Kyle $364',
      'Medical · Vital Psych MD $150',
      'Medical · CVS $40',
    ])
  })

  it('returns an empty summary when nothing qualifies, and honours a custom category list', () => {
    expect(summarizeOfficeLikeCharges([], null)).toEqual({ usd: 0, charges: 0, jobs: 0, top: [] })
    const fuelOnly = summarizeOfficeLikeCharges(rows, office, ['FuelAndGas'])
    expect(fuelOnly.usd).toBe(500)
    expect(fuelOnly.jobs).toBe(1)
  })

  it('keeps fuel, retail and professional services out of the default list', () => {
    for (const c of ['FuelAndGas', 'Retail', 'ProfessionalServices', 'VehicleExpenses', 'Fees', 'GovernmentServices']) {
      expect(OFFICE_LIKE_MERCURY_CATEGORIES).not.toContain(c)
    }
  })
})
