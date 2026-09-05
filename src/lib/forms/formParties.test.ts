import { describe, expect, it } from 'vitest'
import type { FormSchema } from './formSchema'
import { officeQueue, officeSectionPending, partyRegions, twoPartyTemplateIdSet } from './formParties'

const schema: FormSchema = {
  version: 1,
  pages: [
    { width: 612, height: 792 },
    { width: 612, height: 792 },
  ],
  boxes: [
    { key: 'a', type: 'text', page: 1, rect: { x: 40, y: 600, w: 100, h: 14 }, order: 10, label: 'A' },
    { key: 'b', type: 'text', page: 1, rect: { x: 300, y: 500, w: 200, h: 14 }, order: 20, label: 'B' },
    { key: 'o1', type: 'text', page: 1, rect: { x: 40, y: 100, w: 100, h: 14 }, order: 30, label: 'O1', party: 'office' },
    { key: 'o2', type: 'signature', page: 1, rect: { x: 300, y: 60, w: 200, h: 20 }, order: 40, label: 'O2', party: 'office' },
    { key: 'o3', type: 'text', page: 2, rect: { x: 10, y: 10, w: 50, h: 10 }, order: 50, label: 'O3', party: 'office' },
  ],
  groups: [],
  oneOfs: [],
}

describe('partyRegions', () => {
  it('unions a party’s boxes per page with padding, clamped to the page', () => {
    expect(partyRegions(schema, 'signer')).toEqual([{ page: 1, rect: { x: 36, y: 496, w: 468, h: 122 } }])
    expect(partyRegions(schema, 'office')).toEqual([
      { page: 1, rect: { x: 36, y: 56, w: 468, h: 62 } },
      { page: 2, rect: { x: 6, y: 6, w: 58, h: 18 } },
    ])
    expect(partyRegions({ ...schema, boxes: schema.boxes.filter((b) => !b.party) }, 'office')).toEqual([])
  })
})

describe('office queue', () => {
  const two = twoPartyTemplateIdSet([
    { id: 't-i9', schema },
    { id: 't-w9', schema: { ...schema, boxes: schema.boxes.filter((b) => !b.party) } },
    { id: 't-null', schema: null },
  ])
  const rows = [
    { id: '1', person_name: 'Zed', document_name: 'Form I-9', status: 'signed', signed_at: '2026-09-05', form_template_id: 't-i9', office_completed_at: null },
    { id: '2', person_name: 'Amy', document_name: 'Form I-9', status: 'signed', signed_at: '2026-09-03', form_template_id: 't-i9', office_completed_at: null },
    { id: '3', person_name: 'Bo', document_name: 'Form I-9', status: 'signed', signed_at: '2026-09-01', form_template_id: 't-i9', office_completed_at: '2026-09-02T00:00:00Z' },
    { id: '4', person_name: 'Cy', document_name: 'W-9', status: 'signed', signed_at: '2026-09-04', form_template_id: 't-w9', office_completed_at: null },
    { id: '5', person_name: 'Di', document_name: 'Form I-9', status: 'sent', signed_at: null, form_template_id: 't-i9', office_completed_at: null },
  ]
  it('knows which templates are two-party and which rows still wait on the office, oldest first', () => {
    expect([...two]).toEqual(['t-i9'])
    expect(rows.map((r) => officeSectionPending(r, two))).toEqual([true, true, false, false, false])
    expect(officeQueue(rows, two).map((q) => `${q.personName} ${q.signedAt}`)).toEqual(['Amy 2026-09-03', 'Zed 2026-09-05'])
  })
})
