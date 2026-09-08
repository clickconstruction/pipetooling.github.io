import { describe, expect, it } from 'vitest'
import { buildBidSavePayload } from './bidFormPayload'
import type { BidEditFormValues } from './useBidEditForm'

function formValues(overrides: Partial<BidEditFormValues> = {}): BidEditFormValues {
  return {
    driveLink: ' https://drive/x ',
    plansLink: '',
    countToolingPlansLink: '',
    bidSubmissionLink: '',
    itbLinks: ['https://planhub/1', ''],
    projectName: '  Kingsbury Clinic ',
    projectId: '',
    bidNumber: ' 403 ',
    address: '12925 FM 20',
    gcContactName: '',
    gcContactPhone: '',
    gcContactEmail: '',
    projectContactExpanded: true,
    estimatorId: 'est-1',
    accountManagerId: 'am-1',
    formServiceTypeId: 'st-plumbing',
    bidDueDate: '2026-09-04',
    bidDueTime: '14:00',
    estimatedJobStartDate: '',
    designDrawingPlanDate: '',
    submittedTo: '',
    outcome: '',
    lossReason: '',
    lossCategory: null,
    bidValue: '50000',
    agreedValue: 'abc',
    profit: '',
    distanceFromOffice: ' 38.2 ',
    lastContact: '',
    notes: '',
    gcCustomerId: 'cust-1',
    gcCustomerSearch: 'ACME GC',
    ...overrides,
  }
}

describe('buildBidSavePayload', () => {
  it('trims strings, nulls blanks, parses money, and always sets gc_builder_id null beside customer_id', () => {
    const p = buildBidSavePayload({ values: formValues(), bidDateSent: '', editing: true, canEditBidNumber: true })
    expect(p.drive_link).toBe('https://drive/x')
    expect(p.plans_link).toBeNull()
    expect(p.project_name).toBe('Kingsbury Clinic')
    expect(p.customer_id).toBe('cust-1')
    expect(p.gc_builder_id).toBeNull()
    expect(p.bid_value).toBe(50000)
    expect(p.agreed_value).toBeNull()
    expect(p.profit).toBeNull()
    expect(p.distance_from_office).toBe('38.2')
    expect(p.bid_date_sent).toBeNull()
    expect(p.outcome).toBeNull()
    expect(p.account_manager_id).toBe('am-1')
    expect(p.service_type_id).toBe('st-plumbing')
  })

  it('due time only rides along with a due date', () => {
    const withDate = buildBidSavePayload({ values: formValues(), bidDateSent: '', editing: true, canEditBidNumber: true })
    expect(withDate.bid_due_time).toBe('14:00')
    const noDate = buildBidSavePayload({ values: formValues({ bidDueDate: '' }), bidDateSent: '', editing: true, canEditBidNumber: true })
    expect(noDate.bid_due_date).toBeNull()
    expect(noDate.bid_due_time).toBeNull()
  })

  it('loss reason and category are written only while the outcome is lost', () => {
    const lost = buildBidSavePayload({
      values: formValues({ outcome: 'lost', lossReason: ' too high ', lossCategory: 'price' as BidEditFormValues['lossCategory'] }),
      bidDateSent: '2026-09-01',
      editing: true,
      canEditBidNumber: true,
    })
    expect(lost.outcome).toBe('lost')
    expect(lost.loss_reason).toBe('too high')
    expect(lost.loss_category).toBe('price')
    expect(lost.bid_date_sent).toBe('2026-09-01')
    const won = buildBidSavePayload({
      values: formValues({ outcome: 'won', lossReason: 'stale note', lossCategory: 'price' as BidEditFormValues['lossCategory'] }),
      bidDateSent: '',
      editing: true,
      canEditBidNumber: true,
    })
    expect(won.outcome).toBe('won')
    expect(won.loss_reason).toBeNull()
    expect(won.loss_category).toBeNull()
  })

  it('bid_number is written only on a saved bid by a role that may edit it', () => {
    const editor = buildBidSavePayload({ values: formValues(), bidDateSent: '', editing: true, canEditBidNumber: true })
    expect(editor.bid_number).toBe('403')
    const estimator = buildBidSavePayload({ values: formValues(), bidDateSent: '', editing: true, canEditBidNumber: false })
    expect('bid_number' in estimator).toBe(false)
    const creating = buildBidSavePayload({ values: formValues(), bidDateSent: '', editing: false, canEditBidNumber: true })
    expect('bid_number' in creating).toBe(false)
  })

  it('last_contact seeds a new bid only — saved bids derive it from contact entries', () => {
    const creating = buildBidSavePayload({ values: formValues({ lastContact: '2026-09-01T10:30' }), bidDateSent: '', editing: false, canEditBidNumber: false })
    expect(typeof creating.last_contact).toBe('string')
    const editing = buildBidSavePayload({ values: formValues({ lastContact: '2026-09-01T10:30' }), bidDateSent: '', editing: true, canEditBidNumber: false })
    expect('last_contact' in editing).toBe(false)
  })
})
