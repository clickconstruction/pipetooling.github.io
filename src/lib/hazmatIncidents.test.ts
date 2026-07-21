import { describe, expect, it } from 'vitest'
import { hazmatIncidentRowToDraft, hazmatNoticeJobInfoFromJob, type JobHazmatIncidentRow } from './hazmatIncidents'

function baseRow(overrides: Partial<JobHazmatIncidentRow> = {}): JobHazmatIncidentRow {
  return {
    id: 'inc-1',
    job_id: 'job-1',
    created_by: 'user-1',
    incident_at: '2026-07-20T15:30:00.000Z',
    description: 'Waste discharged down an open pipe.',
    exposed_people: 'Abraham',
    stage_label: 'Top Out',
    photo_links: ['https://drive.example.com/p1', 'https://drive.example.com/p2'],
    testimonials: [
      { name: 'Abraham', user_id: null, statement: 'I was underneath the pipe.', given_at: '2026-07-20T16:00:00.000Z' },
    ],
    tos_clause_snapshot: '11. Biohazard / Hazmat Exposure Fee — the customer agrees…',
    fee_amount: 500,
    invoice_id: 'inv-1',
    created_at: '2026-07-20T16:05:00.000Z',
    ...overrides,
  }
}

describe('hazmatIncidentRowToDraft', () => {
  it('maps a well-formed row to the draft shape', () => {
    const draft = hazmatIncidentRowToDraft(baseRow())
    expect(draft.incidentAt).toBe('2026-07-20T15:30:00.000Z')
    expect(draft.description).toBe('Waste discharged down an open pipe.')
    expect(draft.exposedPeople).toBe('Abraham')
    expect(draft.stageLabel).toBe('Top Out')
    expect(draft.photoLinks).toEqual(['https://drive.example.com/p1', 'https://drive.example.com/p2'])
    expect(draft.testimonials).toEqual([
      { name: 'Abraham', userId: null, statement: 'I was underneath the pipe.', givenAt: '2026-07-20T16:00:00.000Z' },
    ])
    expect(draft.tosClauseSnapshot).toContain('11. Biohazard')
    expect(draft.feeAmount).toBe(500)
  })

  it('coerces a stringy numeric fee (supabase numeric can arrive as string)', () => {
    const draft = hazmatIncidentRowToDraft(baseRow({ fee_amount: '750.50' as unknown as number }))
    expect(draft.feeAmount).toBe(750.5)
  })

  it('drops malformed photo links and testimonials instead of throwing', () => {
    const draft = hazmatIncidentRowToDraft(
      baseRow({
        photo_links: ['https://ok.example', 42, null, '  '] as unknown as JobHazmatIncidentRow['photo_links'],
        testimonials: [
          { name: 'Valid', statement: 'ok', given_at: 'x' },
          { name: '', statement: 'no name' },
          'garbage',
          null,
          { name: 'No statement', statement: '   ' },
        ] as unknown as JobHazmatIncidentRow['testimonials'],
      }),
    )
    expect(draft.photoLinks).toEqual(['https://ok.example'])
    expect(draft.testimonials).toEqual([{ name: 'Valid', userId: null, statement: 'ok', givenAt: 'x' }])
  })

  it('handles non-array jsonb payloads', () => {
    const draft = hazmatIncidentRowToDraft(
      baseRow({
        photo_links: { not: 'an array' } as unknown as JobHazmatIncidentRow['photo_links'],
        testimonials: 'nope' as unknown as JobHazmatIncidentRow['testimonials'],
      }),
    )
    expect(draft.photoLinks).toEqual([])
    expect(draft.testimonials).toEqual([])
  })
})

describe('hazmatNoticeJobInfoFromJob', () => {
  it('prefers HCP, falls back to click number, then a dash', () => {
    expect(hazmatNoticeJobInfoFromJob({ hcp_number: ' 123 ', click_number: '9', job_name: 'X', job_address: 'A', customer_name: 'C' }).jobNumber).toBe('123')
    expect(hazmatNoticeJobInfoFromJob({ hcp_number: '  ', click_number: '9' }).jobNumber).toBe('9')
    expect(hazmatNoticeJobInfoFromJob({}).jobNumber).toBe('—')
  })

  it('applies the same fallbacks as the Stages button mapping', () => {
    const info = hazmatNoticeJobInfoFromJob({ job_name: null, job_address: '', customer_name: undefined })
    expect(info.jobName).toBe('Job')
    expect(info.jobAddress).toBe('—')
    expect(info.customerName).toBe('—')
  })
})
