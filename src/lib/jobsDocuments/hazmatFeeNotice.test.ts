import { describe, expect, it } from 'vitest'
import { buildHazmatFeeNoticeHtml } from './hazmatFeeNotice'
import type { HazmatIncidentDraft } from '../hazmatFee'

const draft: HazmatIncidentDraft = {
  incidentAt: '2026-07-20T15:30:00.000Z',
  description: 'Waste discharged down an open pipe struck a technician <in the face>.',
  exposedPeople: 'Abraham',
  stageLabel: 'Top Out',
  photoLinks: ['https://drive.example.com/photo1', 'https://drive.example.com/photo2'],
  testimonials: [
    { name: 'Abraham', userId: 'u1', statement: 'I was struck by waste material.', givenAt: '2026-07-20T16:00:00.000Z' },
  ],
  tosClauseSnapshot: '11. Biohazard / Hazmat Exposure Fee\n\nCustomer shall pay $500.',
  feeAmount: 500,
}

describe('buildHazmatFeeNoticeHtml', () => {
  it('includes fee, incident, photos, statements, and the clause verbatim', () => {
    const html = buildHazmatFeeNoticeHtml(
      { jobNumber: '834', jobName: 'Larry Morrison', jobAddress: '20027 Park Bluff St', customerName: 'Larry Morrison' },
      draft,
    )
    expect(html).toContain('$500.00')
    expect(html).toContain('Photo 2')
    expect(html).toContain('Abraham')
    expect(html).toContain('11. Biohazard / Hazmat Exposure Fee')
    expect(html).toContain('data-theme="light"')
  })

  it('escapes HTML in user-entered content', () => {
    const html = buildHazmatFeeNoticeHtml(
      { jobNumber: '834', jobName: '<b>x</b>', jobAddress: 'a', customerName: 'c' },
      draft,
    )
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('&lt;in the face&gt;')
  })
})
