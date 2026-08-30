import { describe, expect, it } from 'vitest'
import { pruneUnchangedBidUpdateFields } from './bidUpdatePrune'
import type { BidEditFormValues } from './useBidEditForm'

function formValues(overrides: Partial<BidEditFormValues> = {}): BidEditFormValues {
  return {
    driveLink: '',
    plansLink: '',
    countToolingPlansLink: '',
    bidSubmissionLink: '',
    itbLinks: [],
    projectName: 'Kingsbury Clinic',
    projectId: '',
    bidNumber: '403',
    address: '12925 FM 20, Kingsbury, Texas 78638',
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
    agreedValue: '',
    profit: '',
    distanceFromOffice: '38.2',
    lastContact: '',
    notes: 'call GC Friday',
    gcCustomerId: 'cust-1',
    gcCustomerSearch: 'ACME GC',
    ...overrides,
  }
}

/** The full column set the Edit Bid save paths write (attestation keys ride separately). */
function fullPayload(): Record<string, unknown> {
  return {
    drive_link: null,
    plans_link: null,
    count_tooling_plans_link: null,
    bid_submission_link: null,
    itb_links: [],
    design_drawing_plan_date: null,
    customer_id: 'cust-1',
    gc_builder_id: null,
    bid_number: '403',
    project_name: 'Kingsbury Clinic',
    project_id: null,
    address: '12925 FM 20, Kingsbury, Texas 78638',
    gc_contact_name: null,
    gc_contact_phone: null,
    gc_contact_email: null,
    estimator_id: 'est-1',
    account_manager_id: 'am-1',
    bid_due_date: '2026-09-04',
    bid_due_time: '14:00',
    estimated_job_start_date: null,
    bid_date_sent: null,
    submitted_to: null,
    outcome: null,
    loss_reason: null,
    loss_category: null,
    bid_value: 50000,
    agreed_value: null,
    profit: null,
    distance_from_office: '38.2',
    notes: 'call GC Friday',
    service_type_id: 'st-plumbing',
  }
}

const sameSentDate = { current: '', initial: '' }

describe('pruneUnchangedBidUpdateFields', () => {
  it('untouched form prunes to an empty payload (nothing to write)', () => {
    const v = formValues()
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: v,
      initial: formValues(),
      bidDateSent: sameSentDate,
    })
    expect(pruned).toEqual({})
  })

  it('the b403 repro: server stamped plans_link after the board fetch — untouched Save leaves it out', () => {
    // Cached row (and thus the form) predates the drive-intake stamp: plansLink is ''.
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ plansLink: '' }),
      initial: formValues({ plansLink: '' }),
      bidDateSent: sameSentDate,
    })
    expect('plans_link' in pruned).toBe(false)
    expect('drive_link' in pruned).toBe(false)
  })

  it('an edited field keeps exactly its own column', () => {
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ plansLink: 'https://drive.google.com/x' }),
      initial: formValues(),
      bidDateSent: sameSentDate,
    })
    expect(Object.keys(pruned)).toEqual(['plans_link'])
  })

  it('derived groups travel together: outcome change carries loss_reason + loss_category', () => {
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ outcome: 'lost', lossReason: 'price' }),
      initial: formValues(),
      bidDateSent: sameSentDate,
    })
    expect(Object.keys(pruned).sort()).toEqual(['loss_category', 'loss_reason', 'outcome'])
  })

  it('due-time edit writes both due columns (time is gated on date in the payload)', () => {
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ bidDueTime: '09:30' }),
      initial: formValues(),
      bidDateSent: sameSentDate,
    })
    expect(Object.keys(pruned).sort()).toEqual(['bid_due_date', 'bid_due_time'])
  })

  it('untouched GC picker prunes customer_id AND the always-null gc_builder_id (legacy builder link survives)', () => {
    const pruned = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ gcCustomerId: '' }),
      initial: formValues({ gcCustomerId: '' }),
      bidDateSent: sameSentDate,
    })
    expect('customer_id' in pruned).toBe(false)
    expect('gc_builder_id' in pruned).toBe(false)
  })

  it('itb_links compares by content, not identity', () => {
    const unchanged = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ itbLinks: ['https://planhub.com/a'] }),
      initial: formValues({ itbLinks: ['https://planhub.com/a'] }),
      bidDateSent: sameSentDate,
    })
    expect('itb_links' in unchanged).toBe(false)
    const changed = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues({ itbLinks: ['https://planhub.com/a', 'https://planhub.com/b'] }),
      initial: formValues({ itbLinks: ['https://planhub.com/a'] }),
      bidDateSent: sameSentDate,
    })
    expect('itb_links' in changed).toBe(true)
  })

  it('bid_date_sent prunes on normalized equality and stays when hand-changed', () => {
    const same = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues(),
      initial: formValues(),
      bidDateSent: { current: '2026-08-28T00:00:00', initial: '2026-08-28' },
    })
    expect('bid_date_sent' in same).toBe(false)
    const moved = pruneUnchangedBidUpdateFields(fullPayload(), {
      current: formValues(),
      initial: formValues(),
      bidDateSent: { current: '2026-08-29', initial: '2026-08-28' },
    })
    expect(Object.keys(moved)).toEqual(['bid_date_sent'])
  })

  it('unmapped keys (attestation columns) are always kept', () => {
    const payload = { ...fullPayload(), bid_date_sent_attested_by: 'user-1' }
    const pruned = pruneUnchangedBidUpdateFields(payload, {
      current: formValues(),
      initial: formValues(),
      bidDateSent: { current: '2026-08-29', initial: '' },
    })
    expect(pruned.bid_date_sent_attested_by).toBe('user-1')
  })

  it('null initial snapshot disables pruning (full payload written)', () => {
    const payload = fullPayload()
    const pruned = pruneUnchangedBidUpdateFields(payload, {
      current: formValues(),
      initial: null,
      bidDateSent: sameSentDate,
    })
    expect(pruned).toEqual(payload)
  })

  it('never invents keys the payload did not carry (role-gated bid_number)', () => {
    const payload = fullPayload()
    delete payload.bid_number
    const pruned = pruneUnchangedBidUpdateFields(payload, {
      current: formValues({ bidNumber: '999' }),
      initial: formValues(),
      bidDateSent: sameSentDate,
    })
    expect('bid_number' in pruned).toBe(false)
  })
})
