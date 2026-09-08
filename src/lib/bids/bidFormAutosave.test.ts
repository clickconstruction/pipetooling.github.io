import { describe, expect, it } from 'vitest'
import { bidAutosaveSliceJson, bidAutosaveStatusLine, bidFormFooterLabels } from './bidFormAutosave'
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
    address: '',
    gcContactName: '',
    gcContactPhone: '',
    gcContactEmail: '',
    projectContactExpanded: true,
    estimatorId: '',
    accountManagerId: '',
    formServiceTypeId: 'st-1',
    bidDueDate: '',
    bidDueTime: '',
    estimatedJobStartDate: '',
    designDrawingPlanDate: '',
    submittedTo: '',
    outcome: '',
    lossReason: '',
    lossCategory: null,
    bidValue: '',
    agreedValue: '',
    profit: '',
    distanceFromOffice: '',
    robotOptOut: false,
    lastContact: '',
    notes: '',
    gcCustomerId: '',
    gcCustomerSearch: '',
    ...overrides,
  }
}

const extras = { bidDateSent: '', attestedAt: null, followupNote: null }

describe('bidAutosaveSliceJson', () => {
  it('ignores UI-only state (GC search text, contact toggle) but sees every persisted field', () => {
    const base = bidAutosaveSliceJson(formValues(), extras)
    expect(bidAutosaveSliceJson(formValues({ gcCustomerSearch: 'typing…', projectContactExpanded: false }), extras)).toBe(base)
    expect(bidAutosaveSliceJson(formValues({ notes: 'call Friday' }), extras)).not.toBe(base)
    expect(bidAutosaveSliceJson(formValues({ outcome: 'won' }), extras)).not.toBe(base)
  })
  it('re-dirties when the sent date, its attestation, or the follow-up note changes', () => {
    const base = bidAutosaveSliceJson(formValues(), extras)
    expect(bidAutosaveSliceJson(formValues(), { ...extras, bidDateSent: '2026-09-01' })).not.toBe(base)
    expect(bidAutosaveSliceJson(formValues(), { ...extras, attestedAt: '2026-09-01T10:00:00Z' })).not.toBe(base)
    expect(bidAutosaveSliceJson(formValues(), { ...extras, followupNote: 'left a voicemail' })).not.toBe(base)
  })
})

describe('bidAutosaveStatusLine', () => {
  it('missing required fields win over everything else', () => {
    const line = bidAutosaveStatusLine({ status: 'error', dirty: true, missingFields: ['Project Name'] })
    expect(line.tone).toBe('warn')
    expect(line.text).toContain('Project Name')
  })
  it('walks error → saving → dirty → saved → idle', () => {
    expect(bidAutosaveStatusLine({ status: 'error', dirty: true, missingFields: [] })).toEqual({ text: 'Couldn’t save your latest change', tone: 'error' })
    expect(bidAutosaveStatusLine({ status: 'saving', dirty: true, missingFields: [] })).toEqual({ text: 'Saving…', tone: 'muted' })
    expect(bidAutosaveStatusLine({ status: 'saved', dirty: true, missingFields: [] })).toEqual({ text: 'Unsaved change…', tone: 'muted' })
    expect(bidAutosaveStatusLine({ status: 'saved', dirty: false, missingFields: [] })).toEqual({ text: 'Saved', tone: 'muted' })
    expect(bidAutosaveStatusLine({ status: 'idle', dirty: false, missingFields: [] })).toEqual({ text: 'Changes save as you make them', tone: 'muted' })
  })
})

describe('bidFormFooterLabels', () => {
  it('New Bid keeps a dedicated Create bid button; Edit has none', () => {
    expect(bidFormFooterLabels(false)).toEqual({ primary: 'Create bid', openCounts: 'Create and open counts' })
    expect(bidFormFooterLabels(true)).toEqual({ primary: null, openCounts: 'Open Counts' })
  })
})
