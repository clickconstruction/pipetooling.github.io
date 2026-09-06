import { describe, expect, it } from 'vitest'

import { newJobDraftIsDirty, type NewJobDraftSnapshot } from './newJobDraftDirty'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

const blankFixture = (id: string): FixtureRow => ({ id, name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null })
const blankMaterial = (id: string): MaterialRow => ({ id, description: '', amount: 0 })
const blankPayment = (id: string): PaymentRow => ({
  id,
  amount: 0,
  paid_on: '2026-09-05',
  sent_on: null,
  note: null,
  payment_type: null,
  reference_number: null,
  invoice_id: null,
  mercury_transaction_id: null,
})

function snap(over: Partial<NewJobDraftSnapshot> = {}): NewJobDraftSnapshot {
  return {
    jobName: '',
    jobAddress: '',
    hcpNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    dateMet: '',
    customerId: null,
    bidId: null,
    projectId: null,
    formServiceTypeId: 'st-plumbing',
    googleDriveLink: '',
    jobPicturesLink: '',
    jobPlansLink: '',
    fixtures: [blankFixture('f1')],
    materials: [blankMaterial('m1')],
    payments: [blankPayment('p1')],
    teamMemberIds: [],
    ...over,
  }
}

describe('newJobDraftIsDirty', () => {
  it('an untouched form is clean — Escape closes without asking', () => {
    const initial = snap()
    expect(newJobDraftIsDirty(snap(), initial)).toBe(false)
  })

  it('a half-typed phone-call job is dirty (J1-F2)', () => {
    const initial = snap()
    expect(newJobDraftIsDirty(snap({ jobName: 'Water heater — Mrs. Ortiz' }), initial)).toBe(true)
    expect(newJobDraftIsDirty(snap({ customerPhone: '512 555 0101' }), initial)).toBe(true)
  })

  it('whitespace-only typing is not dirt', () => {
    const initial = snap()
    expect(newJobDraftIsDirty(snap({ jobName: '   ', customerName: ' ' }), initial)).toBe(false)
  })

  it('row ids do not matter, row content does', () => {
    const initial = snap()
    expect(newJobDraftIsDirty(snap({ fixtures: [blankFixture('other-id')] }), initial)).toBe(false)
    expect(newJobDraftIsDirty(snap({ fixtures: [{ ...blankFixture('f1'), name: 'WC' }] }), initial)).toBe(true)
    expect(newJobDraftIsDirty(snap({ materials: [{ ...blankMaterial('m1'), amount: 40 }] }), initial)).toBe(true)
    expect(newJobDraftIsDirty(snap({ payments: [{ ...blankPayment('p1'), amount: 100 }] }), initial)).toBe(true)
  })

  it('a bid or project prefill captured in the snapshot is not dirt; changing it afterwards is', () => {
    const prefilled = snap({
      bidId: 'bid-1',
      customerId: 'cust-1',
      customerName: 'Acme Builders',
      fixtures: [{ ...blankFixture('f1'), name: 'WC', count: 4 }],
    })
    expect(newJobDraftIsDirty({ ...prefilled, fixtures: [{ ...prefilled.fixtures[0]!, id: 'renamed' }] }, prefilled)).toBe(false)
    expect(newJobDraftIsDirty({ ...prefilled, fixtures: [{ ...prefilled.fixtures[0]!, count: 5 }] }, prefilled)).toBe(true)
  })

  it('team picks count, in any order', () => {
    const initial = snap({ teamMemberIds: ['u1', 'u2'] })
    expect(newJobDraftIsDirty(snap({ teamMemberIds: ['u2', 'u1'] }), initial)).toBe(false)
    expect(newJobDraftIsDirty(snap({ teamMemberIds: ['u1'] }), initial)).toBe(true)
  })

  it('changing the trade away from the snapshot counts', () => {
    const initial = snap({ formServiceTypeId: 'st-plumbing' })
    expect(newJobDraftIsDirty(snap({ formServiceTypeId: 'st-gas' }), initial)).toBe(true)
  })

  it('with no snapshot yet, any content counts but the auto-picked trade does not', () => {
    expect(newJobDraftIsDirty(snap(), null)).toBe(false)
    expect(newJobDraftIsDirty(snap({ jobAddress: '12 Elm' }), null)).toBe(true)
  })
})
