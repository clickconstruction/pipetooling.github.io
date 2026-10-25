import { describe, expect, it } from 'vitest'
import { buildLienSupplierJobs } from '../jobs/lienJobSuppliers'
import { LEGAL_SUPPLIERS_EMPTY_WORDS, legalSupplierJobs, legalSuppliersOwed, legalSuppliersOwedWords, legalSuppliersSummaryWords } from './legalSuppliers'

// Two jobs on one account: 891 bought from two houses (one paid, one owed), 892 from one house, paid; 893 bought nothing.
const byJob = buildLienSupplierJobs({
  invoices: [
    { id: 'i1', supply_house_id: 'h-reece', amount: 8_950, is_paid: false, invoice_date: '2026-07-14', paidYmd: null, on_job_account: true },
    { id: 'i2', supply_house_id: 'h-ferg', amount: 1_200, is_paid: true, invoice_date: '2026-07-20', paidYmd: '2026-08-02', on_job_account: false },
    { id: 'i3', supply_house_id: 'h-ferg', amount: 640, is_paid: true, invoice_date: '2026-08-04', paidYmd: '2026-09-01', on_job_account: false },
  ],
  allocations: [
    { invoice_id: 'i1', job_id: 'j-891', pct: 100 },
    { invoice_id: 'i2', job_id: 'j-891', pct: 100 },
    { invoice_id: 'i3', job_id: 'j-892', pct: 100 },
  ],
  houses: [{ id: 'h-reece', name: 'Reece' }, { id: 'h-ferg', name: 'Ferguson' }],
})
const jobs = [
  { jobId: 'j-891', jobLabel: '891', openBalance: 12_000, propertyKind: 'non_residential' },
  { jobId: 'j-892', jobLabel: '892', openBalance: 500, propertyKind: 'non_residential' },
  { jobId: 'j-893', jobLabel: '893', openBalance: 300, propertyKind: '' },
]

describe('legalSupplierJobs', () => {
  it('keeps the jobs that bought something, in the account\'s order, carrying each job\'s read', () => {
    const lines = legalSupplierJobs(jobs, byJob)
    expect(lines.map((l) => l.jobLabel)).toEqual(['891', '892'])
    expect(lines[0]!.suppliers.houses.map((h) => [h.name, h.owed, h.paid])).toEqual([['Reece', 8_950, 0], ['Ferguson', 0, 1_200]])
    expect(lines[1]!.openBalance).toBe(500)
  })
  it('answers nothing when no job bought anything', () => {
    expect(legalSupplierJobs(jobs, new Map())).toEqual([])
    expect(legalSuppliersSummaryWords([])).toBe('')
    expect(LEGAL_SUPPLIERS_EMPTY_WORDS).toMatch(/No supply house/)
  })
})

describe('the words over the section', () => {
  const lines = legalSupplierJobs(jobs, byJob)
  it('says each job\'s owed houses, or all paid, without the job-account tag', () => {
    expect(legalSuppliersSummaryWords(lines)).toBe('1 house owed $8,950 on 891 · 1 house, all paid on 892')
  })
  it('sums what the houses are owed across the account and words it; silent when paid up', () => {
    expect(legalSuppliersOwed(lines)).toBe(8_950)
    expect(legalSuppliersOwedWords(8_950)).toBe('Supply houses are still owed $8,950 on these jobs.')
    expect(legalSuppliersOwedWords(0)).toBe('')
  })
})
