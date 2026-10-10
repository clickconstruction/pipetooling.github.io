import { describe, expect, it } from 'vitest'
import { customerInvoicesWithoutZz, customerPageDataWithoutZz, customerPageZzJobs } from './customerPageZzTestJobs'
import type { CustomerInvoicesData } from './fetchCustomerInvoices'

// Punch list #61 (v2.5122): a customer's page without its ZZ test jobs. Made-up jobs and amounts.
const page = (customer: string) => ({
  customer: { name: customer },
  jobs: [
    { id: 'A', job_name: '101 Hill Street' },
    { id: 'Z', job_name: 'ZZ TEST billed' },
  ],
})
const invoices = (): CustomerInvoicesData =>
  ({
    invoices: [
      { id: 'iA', job_id: 'A' },
      { id: 'iZ', job_id: 'Z' },
    ],
    payments: [
      { invoice_id: 'iA', amount: 100, paid_on: null },
      { invoice_id: 'iZ', amount: 50, paid_on: null },
      { invoice_id: null, amount: 25, paid_on: null, job_id: 'Z' },
    ],
    jobs: [
      { id: 'A', label: 'J101' },
      { id: 'Z', label: 'J999' },
    ],
  }) as unknown as CustomerInvoicesData

describe('customer page ZZ test jobs', () => {
  it('a real customer: drops the ZZ job, its bill and both its payments, keeps the rest', () => {
    const zz = customerPageZzJobs(page('Ann Lee'))
    expect(zz).toEqual(new Set(['Z']))
    expect(customerPageDataWithoutZz(page('Ann Lee'), zz)!.jobs.map((j) => j.id)).toEqual(['A'])
    const inv = customerInvoicesWithoutZz(invoices(), zz)!
    expect(inv.invoices.map((i) => i.id)).toEqual(['iA'])
    expect(inv.payments.map((p) => p.amount)).toEqual([100])
    expect(inv.jobs.map((j) => j.id)).toEqual(['A'])
  })

  it('a ZZ customer: every job on the page is a test job', () => {
    const zz = customerPageZzJobs(page('  zz Test Customer'))
    expect(zz).toBe('all')
    expect(customerPageDataWithoutZz(page('ZZ Test Customer'), zz)!.jobs).toEqual([])
    const inv = customerInvoicesWithoutZz(invoices(), zz)!
    expect(inv.invoices).toEqual([])
    expect(inv.payments).toEqual([])
  })

  it('hands everything back as it was when nothing is a test job, or the page has not loaded', () => {
    const plain = { customer: { name: 'Ann Lee' }, jobs: [{ id: 'A', job_name: '101 Hill Street' }] }
    expect(customerPageZzJobs(plain)).toBeNull()
    expect(customerPageDataWithoutZz(plain, null)).toBe(plain)
    expect(customerPageZzJobs(null)).toBeNull()
  })
})
