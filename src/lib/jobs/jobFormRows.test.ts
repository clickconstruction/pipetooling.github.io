import { describe, expect, it } from 'vitest'
import {
  fixtureRowHasUserContent,
  materialRowHasUserContent,
  newEmptyPaymentRow,
  newJobFormHasBlockingContent,
  normalizeFixtureDisplayName,
  paymentRowHasUserContent,
  paymentRowsFromJob,
} from './jobFormRows'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const fixture = (o: Partial<FixtureRow> = {}): FixtureRow => ({ id: 'f', name: '', count: 1, line_unit_price: null, line_description: '', ...o })
const material = (o: Partial<MaterialRow> = {}): MaterialRow => ({ id: 'm', description: '', amount: 0, ...o })
const payment = (o: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p', amount: 0, paid_on: null, note: null, payment_type: null, reference_number: null, invoice_id: null, mercury_transaction_id: null, ...o })

describe('normalizeFixtureDisplayName', () => {
  it('collapses whitespace/newlines and trims', () => {
    expect(normalizeFixtureDisplayName('  a\n b   c ')).toBe('a b c')
  })
})

describe('*RowHasUserContent', () => {
  it('material: description or nonzero amount', () => {
    expect(materialRowHasUserContent(material())).toBe(false)
    expect(materialRowHasUserContent(material({ amount: 5 }))).toBe(true)
    expect(materialRowHasUserContent(material({ description: 'x' }))).toBe(true)
  })
  it('fixture: name/desc/price or count != 1', () => {
    expect(fixtureRowHasUserContent(fixture())).toBe(false)
    expect(fixtureRowHasUserContent(fixture({ name: 'valve' }))).toBe(true)
    expect(fixtureRowHasUserContent(fixture({ count: 2 }))).toBe(true)
    expect(fixtureRowHasUserContent(fixture({ line_unit_price: 0 }))).toBe(true) // price set (even 0)
  })
  it('payment: any populated field', () => {
    expect(paymentRowHasUserContent(payment())).toBe(false)
    expect(paymentRowHasUserContent(payment({ amount: 1 }))).toBe(true)
    expect(paymentRowHasUserContent(payment({ reference_number: 'r' }))).toBe(true)
    expect(paymentRowHasUserContent(payment({ invoice_id: 'i' }))).toBe(true)
  })
})

describe('newEmptyPaymentRow / paymentRowsFromJob', () => {
  it('empty row has a uuid, zero amount, a paid_on date', () => {
    const r = newEmptyPaymentRow()
    expect(r.amount).toBe(0)
    expect(r.id).toMatch(/[0-9a-f-]{36}/)
    expect(r.paid_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('maps job payments, slicing paid_on to YMD; falls back to one empty row', () => {
    const job = { payments: [{ id: 'x', amount: '150.5', paid_on: '2026-07-19T10:00:00Z', note: 'n', payment_type: 't', reference_number: 'r', invoice_id: 'i', mercury_transaction_id: null }] } as unknown as JobWithDetails
    const rows = paymentRowsFromJob(job)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'x', amount: 150.5, paid_on: '2026-07-19', note: 'n', invoice_id: 'i' })
    expect(paymentRowsFromJob({ payments: [] } as unknown as JobWithDetails)).toHaveLength(1)
  })
})

describe('newJobFormHasBlockingContent', () => {
  const base = {
    jobName: '', jobAddress: '', hcpNumber: '', customerName: '', customerEmail: '', customerPhone: '',
    dateMet: '', customerId: null, bidId: null, projectId: null, formServiceTypeId: 'svc', initialNewJobServiceTypeId: 'svc',
    googleDriveLink: '', jobPicturesLink: '', jobPlansLink: '', lastBillDate: '',
    fixtures: [fixture()], materials: [material()], payments: [payment()], teamMemberIds: [] as string[],
  }
  it('is false for a pristine sheet (auto-picked service type does not count)', () => {
    expect(newJobFormHasBlockingContent(base)).toBe(false)
  })
  it('is true once any field, extra row, or team member is present', () => {
    expect(newJobFormHasBlockingContent({ ...base, jobName: 'x' })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, formServiceTypeId: 'other' })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, teamMemberIds: ['u1'] })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, fixtures: [fixture({ name: 'v' })] })).toBe(true)
  })
})
