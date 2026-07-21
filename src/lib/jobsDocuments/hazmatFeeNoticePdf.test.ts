import { describe, expect, it } from 'vitest'
import type { HazmatIncidentDraft } from '../hazmatFee'
import {
  buildHazmatFeeNoticePdfModel,
  formatHazmatIncidentDateTime,
  hazmatNoticePdfFilename,
} from './hazmatFeeNoticePdf'

const job = {
  jobNumber: '857',
  jobName: 'TJ Brace',
  jobAddress: '123 Main St, Austin TX',
  customerName: 'Acme GC',
}

const draft: HazmatIncidentDraft = {
  incidentAt: '2026-07-20T15:30:00.000Z',
  description: 'Waste discharged down an open pipe while a technician worked beneath it.',
  exposedPeople: 'Abraham',
  stageLabel: 'Top Out',
  photoLinks: ['https://drive.example.com/p1', 'https://drive.example.com/p2'],
  testimonials: [
    { name: 'Abraham', userId: null, statement: 'I was underneath the pipe.', givenAt: '2026-07-20T16:00:00.000Z' },
  ],
  tosClauseSnapshot: '11. Biohazard / Hazmat Exposure Fee — the customer agrees…',
  feeAmount: 500,
}

describe('buildHazmatFeeNoticePdfModel', () => {
  it('produces the notice sections in order with the same content as the HTML variant', () => {
    const blocks = buildHazmatFeeNoticePdfModel(job, draft)
    expect(blocks[0]).toEqual({ kind: 'title', text: 'Biohazard Remediation Fee Notice' })
    const headings = blocks.filter((b) => b.kind === 'heading').map((b) => b.text)
    expect(headings).toEqual(['Incident', 'Photographic evidence', 'Technician statements', 'Contractual basis'])
    expect(blocks.some((b) => b.kind === 'fee' && b.text === 'Fee: $500.00')).toBe(true)
    expect(blocks.some((b) => b.kind === 'meta' && b.text === 'Job 857 — TJ Brace')).toBe(true)
    expect(blocks.some((b) => b.kind === 'meta' && b.text.includes('Stage: Top Out'))).toBe(true)
    expect(blocks.some((b) => b.kind === 'meta' && b.text === 'Personnel exposed: Abraham')).toBe(true)
  })

  it('renders one link block per photo and one statement per testimonial', () => {
    const blocks = buildHazmatFeeNoticePdfModel(job, draft)
    const links = blocks.filter((b) => b.kind === 'link')
    expect(links).toHaveLength(2)
    expect(links[0]).toEqual({ kind: 'link', label: 'Photo 1: https://drive.example.com/p1', url: 'https://drive.example.com/p1' })
    const statements = blocks.filter((b) => b.kind === 'statement')
    expect(statements).toHaveLength(1)
    expect(statements[0]?.who).toContain('Abraham — ')
    expect(statements[0]?.body).toBe('I was underneath the pipe.')
  })

  it('carries the clause verbatim and the terms attribution footer', () => {
    const blocks = buildHazmatFeeNoticePdfModel(job, draft)
    expect(blocks.some((b) => b.kind === 'clause' && b.text === draft.tosClauseSnapshot)).toBe(true)
    const last = blocks[blocks.length - 1]
    expect(last?.kind).toBe('meta')
    expect((last as { text: string }).text).toContain('reproduced verbatim')
  })

  it('omits optional stage and exposed-people lines when blank', () => {
    const blocks = buildHazmatFeeNoticePdfModel(job, { ...draft, stageLabel: null, exposedPeople: '  ' })
    expect(blocks.some((b) => b.kind === 'meta' && b.text.includes('Stage:'))).toBe(false)
    expect(blocks.some((b) => b.kind === 'meta' && b.text.includes('Personnel exposed'))).toBe(false)
  })
})

describe('formatHazmatIncidentDateTime', () => {
  it('falls back to the raw string for unparseable dates', () => {
    expect(formatHazmatIncidentDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('hazmatNoticePdfFilename', () => {
  it('slugs the job number', () => {
    expect(hazmatNoticePdfFilename(job)).toBe('biohazard-remediation-fee-notice-857.pdf')
    expect(hazmatNoticePdfFilename({ ...job, jobNumber: '—' })).toBe('biohazard-remediation-fee-notice-job.pdf')
    expect(hazmatNoticePdfFilename({ ...job, jobNumber: 'HCP 12/3' })).toBe('biohazard-remediation-fee-notice-HCP-12-3.pdf')
  })
})
