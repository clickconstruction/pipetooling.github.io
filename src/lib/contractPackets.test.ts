import { describe, expect, it } from 'vitest'
import {
  assignPacketsConsequence,
  packetSaveConsequence,
  packetStats,
  personContractDocumentHasStaffData,
} from './contractPackets'

describe('personContractDocumentHasStaffData', () => {
  const empty = { url: null, signed_at: null, note: null, signing_body_html: null, canonical_document_url: null }
  it('empty placeholder has no staff data; any filled field counts', () => {
    expect(personContractDocumentHasStaffData(empty)).toBe(false)
    expect(personContractDocumentHasStaffData(null)).toBe(false)
    expect(personContractDocumentHasStaffData({ ...empty, url: 'https://x' })).toBe(true)
    expect(personContractDocumentHasStaffData({ ...empty, signed_at: '2026-01-01' })).toBe(true)
    expect(personContractDocumentHasStaffData({ ...empty, note: 'n' })).toBe(true)
    expect(personContractDocumentHasStaffData({ ...empty, signing_body_html: '<p>x</p>' })).toBe(true)
    expect(personContractDocumentHasStaffData({ ...empty, canonical_document_url: 'https://y' })).toBe(true)
    expect(personContractDocumentHasStaffData({ ...empty, signing_body_html: '   ' })).toBe(false)
  })
})

describe('packetStats', () => {
  it('counts documents and distinct assignees', () => {
    const stats = packetStats({
      templateId: 't1',
      templateDocuments: [
        { template_id: 't1', document_name: 'A' },
        { template_id: 't1', document_name: 'B' },
        { template_id: 't2', document_name: 'C' },
      ],
      assignments: [
        { template_id: 't1', person_name: 'Darren' },
        { template_id: 't1', person_name: 'Isiah' },
        { template_id: 't2', person_name: 'Grace' },
      ],
    })
    expect(stats).toEqual({ docCount: 2, peopleCount: 2 })
  })
})

describe('packetSaveConsequence', () => {
  const assignments = [
    { template_id: 't1', person_name: 'Darren' },
    { template_id: 't1', person_name: 'Isiah' },
  ]
  it('newly checked docs count assignees without a copy; unchecked docs are removals', () => {
    const c = packetSaveConsequence({
      templateId: 't1',
      checkedDocNames: ['A', 'Handbook'],
      currentDocNames: ['A', 'B'],
      assignments,
      personDocuments: [
        { person_name: 'Darren', document_name: 'Handbook' },
        { person_name: 'Grace', document_name: 'Handbook' },
      ],
    })
    expect(c.addedDocs).toEqual([{ documentName: 'Handbook', peopleNeedingCopy: 1 }])
    expect(c.removedDocs).toEqual(['B'])
    expect(c.assigneeCount).toBe(2)
  })
  it('a new packet (no id) has zero assignees', () => {
    const c = packetSaveConsequence({
      templateId: null,
      checkedDocNames: ['A'],
      currentDocNames: [],
      assignments,
      personDocuments: [],
    })
    expect(c.addedDocs).toEqual([{ documentName: 'A', peopleNeedingCopy: 0 }])
    expect(c.assigneeCount).toBe(0)
  })
})

describe('assignPacketsConsequence', () => {
  it('dedupes documents across packets and skips ones the person already has', () => {
    const c = assignPacketsConsequence({
      personName: 'Darren',
      selectedTemplateIds: ['t1', 't2'],
      templateDocuments: [
        { template_id: 't1', document_name: 'A' },
        { template_id: 't2', document_name: 'A' },
        { template_id: 't2', document_name: 'B' },
        { template_id: 't3', document_name: 'C' },
      ],
      personDocuments: [
        { person_name: 'Darren', document_name: 'B' },
        { person_name: 'Grace', document_name: 'A' },
      ],
    })
    expect(c.newDocNames).toEqual(['A'])
  })
  it('empty selection yields nothing', () => {
    expect(
      assignPacketsConsequence({ personName: 'Darren', selectedTemplateIds: [], templateDocuments: [], personDocuments: [] })
        .newDocNames,
    ).toEqual([])
  })
})
