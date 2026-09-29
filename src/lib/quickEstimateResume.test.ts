import { describe, expect, it } from 'vitest'
import {
  quickEstimateResumeAge,
  quickEstimateSentTodayForJob,
  quickEstimateSentTodayNote,
  quickEstimateResumeCandidate,
  quickEstimateResumeFromDraft,
  quickEstimateSplitChangeDescription,
  type QuickEstimateDraftRow,
} from './quickEstimate'

const marker = (over: Record<string, unknown> = {}) => ({
  started_at: '2026-09-28T14:10:00Z',
  job: { id: 'job-1', hcp: '5124', name: 'Herber Custom Homes', address: '12 Oak St', customer_id: 'cust-1' },
  ...over,
})

function row(over: Partial<QuickEstimateDraftRow> = {}): QuickEstimateDraftRow {
  return {
    id: 'est-1',
    estimate_number: 310,
    doc_kind: 'change_order',
    customer_id: 'cust-1',
    change_order_fields: {
      description_of_change: 'Job: HCP 5124 — Herber Custom Homes (12 Oak St)\n\nPhone: 512 555 0101\n\nAdded a hose bib on the back wall.',
      reason_for_change: 'Customer asked',
      impact_on_schedule: '',
      response_requested_by: '2026-10-02',
    },
    line_items_snapshot: [{ line_item: 'Field ballpark: ~$1,350 — to be priced', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 }],
    field_write_up: marker(),
    updated_at: '2026-09-28T14:40:00Z',
    estimate_field_photos: [{ id: 'p1' }, { id: 'p2' }],
    ...over,
  }
}

describe('quickEstimateSplitChangeDescription', () => {
  it('drops the Job line, lifts the phone, keeps what was typed', () => {
    expect(quickEstimateSplitChangeDescription('Job: HCP 1 — X (addr)\n\nPhone: 555\n\nThe work.\n\nMore.')).toEqual({ phone: '555', description: 'The work.\n\nMore.' })
    expect(quickEstimateSplitChangeDescription('')).toEqual({ phone: '', description: '' })
  })
})

describe('quickEstimateResumeFromDraft', () => {
  it('reads a change-order draft back into the wizard fields', () => {
    const s = quickEstimateResumeFromDraft(row())!
    expect(s.branch).toBe('change_order')
    expect(s.job).toEqual({ id: 'job-1', hcp: '5124', name: 'Herber Custom Homes', address: '12 Oak St', customer_id: 'cust-1' })
    expect(s.description).toBe('Added a hose bib on the back wall.')
    expect(s.phone).toBe('512 555 0101')
    expect(s.coReason).toBe('Customer asked')
    expect(s.coResponseBy).toBe('2026-10-02')
    expect(s.ballparkText).toBe('1350')
    expect(s.photoCount).toBe(2)
    expect(s.estimateNumber).toBe(310)
    expect(s.hasContent).toBe(true)
  })

  it('reads an estimate draft: the Field write-up line is the description, the free-typed customer comes off the marker', () => {
    const s = quickEstimateResumeFromDraft(row({
      doc_kind: 'estimate',
      change_order_fields: null,
      customer_id: null,
      field_write_up: marker({ job: null, free_customer: 'Mike down the road', phone: '555' }),
      line_items_snapshot: [{ line_item: 'Field write-up', description: 'New hose bib.', quantity: 1, unit_price_cents: 0, amount_cents: 0 }],
      estimate_field_photos: [],
    }))!
    expect(s.branch).toBe('estimate')
    expect(s.description).toBe('New hose bib.')
    expect(s.freeTypedCustomer).toBe('Mike down the road')
    expect(s.phone).toBe('555')
    expect(s.job.id).toBe('')
    expect(s.ballparkText).toBe('')
    expect(s.hasContent).toBe(true)
  })

  it('is null for an office-made estimate (no marker) and for one left to the office', () => {
    expect(quickEstimateResumeFromDraft(row({ field_write_up: null }))).toBeNull()
    expect(quickEstimateResumeFromDraft(row({ field_write_up: marker({ dismissed_at: '2026-09-28T15:00:00Z' }) }))).toBeNull()
  })

  it('an empty draft (job picked, nothing typed, no photo) has no content', () => {
    const s = quickEstimateResumeFromDraft(row({
      change_order_fields: { description_of_change: 'Job: HCP 5124 — Herber Custom Homes (12 Oak St)' },
      line_items_snapshot: [],
      estimate_field_photos: [],
    }))!
    expect(s.hasContent).toBe(false)
    expect(quickEstimateResumeCandidate([row({ change_order_fields: {}, line_items_snapshot: [], estimate_field_photos: [] }), row({ id: 'est-2' })])?.id).toBe('est-2')
  })

  it('a photo alone is content', () => {
    const s = quickEstimateResumeFromDraft(row({ change_order_fields: {}, line_items_snapshot: [], estimate_field_photos: [{ id: 'p1' }] }))!
    expect(s.hasContent).toBe(true)
  })
})

describe('quickEstimateResumeAge', () => {
  it('minutes, hours, days', () => {
    expect(quickEstimateResumeAge('2026-09-28T14:10:00Z', '2026-09-28T14:35:00Z')).toBe('started 25 min ago')
    expect(quickEstimateResumeAge('2026-09-28T12:10:00Z', '2026-09-28T14:35:00Z')).toBe('started 2 h ago')
    expect(quickEstimateResumeAge('2026-09-26T12:10:00Z', '2026-09-28T14:35:00Z')).toBe('started 2 days ago')
    expect(quickEstimateResumeAge('junk', '2026-09-28T14:35:00Z')).toBe('')
  })
})

describe('quickEstimateSentTodayForJob (v2.4092)', () => {
  const dayKeyOf = (iso: string) => iso.slice(0, 10)
  const sent = (id: string, at: string | null, jobId: string | null, n: number | null = 300) => ({
    id,
    estimate_number: n,
    sent_to_dispatch_at: at,
    field_write_up: { started_at: '2026-09-28T13:00:00Z', job: jobId ? { id: jobId, hcp: '', name: '', address: '', customer_id: null } : null },
  })

  it('finds the newest one sent today for the same job, ignoring other jobs, other days and unsent drafts', () => {
    const rows = [
      sent('a', '2026-09-28T14:10:00Z', 'job-1', 310),
      sent('b', '2026-09-28T16:40:00Z', 'job-1', 312),
      sent('c', '2026-09-28T15:00:00Z', 'job-2'),
      sent('d', '2026-09-27T15:00:00Z', 'job-1'),
      sent('e', null, 'job-1'),
      sent('f', '2026-09-28T15:30:00Z', null),
    ]
    expect(quickEstimateSentTodayForJob(rows, 'job-1', '2026-09-28', dayKeyOf)).toEqual({ id: 'b', estimateNumber: 312, sentAtIso: '2026-09-28T16:40:00Z' })
    expect(quickEstimateSentTodayForJob(rows, 'job-3', '2026-09-28', dayKeyOf)).toBeNull()
    expect(quickEstimateSentTodayForJob(rows, 'job-1', '2026-09-29', dayKeyOf)).toBeNull()
  })

  it('an office-made estimate (no marker) never counts', () => {
    expect(quickEstimateSentTodayForJob([{ id: 'x', estimate_number: 1, sent_to_dispatch_at: '2026-09-28T14:00:00Z', field_write_up: null }], 'job-1', '2026-09-28', dayKeyOf)).toBeNull()
  })

  it('the note carries the time and the number when there is one', () => {
    expect(quickEstimateSentTodayNote({ id: 'a', estimateNumber: 310, sentAtIso: '' }, '2:10 pm')).toBe('You already sent one for this job today — 2:10 pm, #310.')
    expect(quickEstimateSentTodayNote({ id: 'a', estimateNumber: null, sentAtIso: '' }, '2:10 pm')).toBe('You already sent one for this job today — 2:10 pm.')
  })
})

