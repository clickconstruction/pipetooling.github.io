import { describe, expect, it } from 'vitest'
import { holdUnfinishedBidDates, pruneUnchangedBidUpdateFields } from './bidUpdatePrune'
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
    acceptedAlternateTags: [],
    declinedAlternateTags: [],
    profit: '',
    distanceFromOffice: '38.2',
    robotOptOut: false,
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

  it('v2.4211: accepted_alternate_tags rides with the outcome — pruned untouched, kept when the ticks or the outcome change', () => {
    const initial = formValues()
    const withTags = () => ({ ...fullPayload(), accepted_alternate_tags: [] as string[], declined_alternate_tags: [] as string[] })
    expect(pruneUnchangedBidUpdateFields(withTags(), { current: formValues(), initial, bidDateSent: sameSentDate })).toEqual({})
    const ticked = pruneUnchangedBidUpdateFields(withTags(), { current: formValues({ acceptedAlternateTags: ['Break room'] }), initial, bidDateSent: sameSentDate })
    expect(Object.keys(ticked).sort()).toEqual(['accepted_alternate_tags', 'declined_alternate_tags', 'loss_category', 'loss_reason', 'outcome'])
    const declined = pruneUnchangedBidUpdateFields(withTags(), { current: formValues({ declinedAlternateTags: ['Break room'] }), initial, bidDateSent: sameSentDate })
    expect(Object.keys(declined)).toContain('declined_alternate_tags')
    const won = pruneUnchangedBidUpdateFields(withTags(), { current: formValues({ outcome: 'won' }), initial, bidDateSent: sameSentDate })
    expect(Object.keys(won)).toContain('accepted_alternate_tags')
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

describe('holdUnfinishedBidDates', () => {
  const initial = formValues()

  it('passes a finished date, a cleared date and every other field through as they are', () => {
    const written = formValues({ bidDueDate: '2026-10-01', estimatedJobStartDate: '', notes: 'changed' })
    const payload = { bid_due_date: '2026-10-01', bid_due_time: '14:00', estimated_job_start_date: null, notes: 'changed' }
    const out = holdUnfinishedBidDates(payload, written, initial)
    expect(out.payload).toEqual(payload)
    expect(out.saved).toEqual(written)
    expect(out.held).toEqual([])
  })

  it('a due date caught mid-year leaves the update with its time — left out, never null — and the other fields still save', () => {
    const written = formValues({ bidDueDate: '0002-09-04', bidDueTime: '09:30', notes: 'changed' })
    const out = holdUnfinishedBidDates({ bid_due_date: '0002-09-04', bid_due_time: '09:30', notes: 'changed' }, written, initial)
    expect(out.payload).toEqual({ notes: 'changed' })
    expect('bid_due_date' in out.payload).toBe(false)
    expect('bid_due_time' in out.payload).toBe(false)
    expect(out.held).toEqual(['bid_due_date'])
  })

  it('records the held box at its last saved value, so the next prune still writes it once the year is finished', () => {
    const half = formValues({ bidDueDate: '0202-09-04', bidDueTime: '09:30', notes: 'changed' })
    const { saved } = holdUnfinishedBidDates({ bid_due_date: '0202-09-04', bid_due_time: '09:30', notes: 'changed' }, half, initial)
    expect(saved.bidDueDate).toBe('2026-09-04')
    expect(saved.bidDueTime).toBe('14:00')
    expect(saved.notes).toBe('changed')
    // The year is finished: the date and the time are dirty against what was recorded, the notes are not.
    const finished = { ...half, bidDueDate: '2027-09-04' }
    const next = pruneUnchangedBidUpdateFields({ bid_due_date: '2027-09-04', bid_due_time: '09:30', notes: 'changed' }, { current: finished, initial: saved, bidDateSent: { current: '', initial: '' } })
    expect(next).toEqual({ bid_due_date: '2027-09-04', bid_due_time: '09:30' })
    // Typed back to the saved date instead: only the time is left to write, and it rides with the date.
    const back = { ...half, bidDueDate: '2026-09-04' }
    expect(pruneUnchangedBidUpdateFields({ bid_due_date: '2026-09-04', bid_due_time: '09:30', notes: 'changed' }, { current: back, initial: saved, bidDateSent: { current: '', initial: '' } })).toEqual({
      bid_due_date: '2026-09-04',
      bid_due_time: '09:30',
    })
  })

  it('holds the estimated start and the plan date each on its own', () => {
    const written = formValues({ estimatedJobStartDate: '0020-11-01', designDrawingPlanDate: '0026-08-15', bidDueDate: '2026-10-01' })
    const out = holdUnfinishedBidDates({ estimated_job_start_date: '0020-11-01', design_drawing_plan_date: '0026-08-15', bid_due_date: '2026-10-01', bid_due_time: '14:00' }, written, initial)
    expect(out.payload).toEqual({ bid_due_date: '2026-10-01', bid_due_time: '14:00' })
    expect(out.held).toEqual(['estimated_job_start_date', 'design_drawing_plan_date'])
    expect(out.saved.estimatedJobStartDate).toBe('')
    expect(out.saved.designDrawingPlanDate).toBe('')
    expect(out.saved.bidDueDate).toBe('2026-10-01')
  })

  it('a date the prune already dropped is not in the update and is not held', () => {
    const written = formValues({ bidDueDate: '0002-09-04' })
    const out = holdUnfinishedBidDates({ notes: 'changed' }, written, initial)
    expect(out.held).toEqual([])
    expect(out.saved).toEqual(written)
  })

  it('with no baseline to go back to, the values written stand as saved', () => {
    const written = formValues({ bidDueDate: '0002-09-04' })
    const out = holdUnfinishedBidDates({ bid_due_date: '0002-09-04', bid_due_time: '14:00' }, written, null)
    expect(out.payload).toEqual({})
    expect(out.saved).toEqual(written)
  })

  it('does not change the update it was handed', () => {
    const payload = { bid_due_date: '0002-09-04', bid_due_time: '14:00' }
    holdUnfinishedBidDates(payload, formValues({ bidDueDate: '0002-09-04' }), initial)
    expect(payload).toEqual({ bid_due_date: '0002-09-04', bid_due_time: '14:00' })
  })
})
