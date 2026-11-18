import { describe, expect, it } from 'vitest'
import { BILL_CUSTOMER_NO_CUSTOMER_EMAIL, billCustomerMissingEmailLead } from './billCustomerMissingEmail'

describe('billCustomerMissingEmailLead', () => {
  it('the job’s own customer, or a typed bill-to: the customer line, whatever name is handed', () => {
    expect(billCustomerMissingEmailLead('customer', null)).toBe('No customer email on this job — Stripe and emailed invoices need one.')
    expect(billCustomerMissingEmailLead('other', 'Hollis Builders')).toBe(BILL_CUSTOMER_NO_CUSTOMER_EMAIL)
  })

  it('a GC payer is named', () => {
    expect(billCustomerMissingEmailLead('gc', 'Hollis Builders')).toBe('Hollis Builders pays this job and has no billing email yet — Stripe and emailed invoices need one.')
  })

  it('a GC payer whose row did not load, or with an empty name, reads The GC', () => {
    expect(billCustomerMissingEmailLead('gc', null)).toBe('The GC pays this job and has no billing email yet — Stripe and emailed invoices need one.')
    expect(billCustomerMissingEmailLead('gc', '')).toBe('The GC pays this job and has no billing email yet — Stripe and emailed invoices need one.')
    expect(billCustomerMissingEmailLead('gc', undefined)).toBe('The GC pays this job and has no billing email yet — Stripe and emailed invoices need one.')
  })
})
