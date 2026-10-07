import { describe, expect, it } from 'vitest'
import { legalFilingAlreadyThere, legalFilingFileProblem, legalFilingNarrativeProblem, parseLegalFilingManifest } from './legalFilingManifest'

const M = 'a1b2c3d4-0000-4000-8000-000000000085'

describe('legalFilingManifest (v2.4814)', () => {
  it('reads a manifest: the matter, each document with its two lines, an optional narrative file', () => {
    const r = parseLegalFilingManifest({ matter_id: M, documents: [{ file: 'documents/report.pdf', title: 'Billing report', shows: 'The itemization.' }, { file: 'internal/aging.pdf', title: 'Aging report', shows: 'Internal.', hold: 'internal, not an exhibit' }], narrative_file: '01 Narrative.md' })
    expect(r).toEqual({ ok: true, manifest: { matterId: M, documents: [{ file: 'documents/report.pdf', title: 'Billing report', shows: 'The itemization.', hold: '' }, { file: 'internal/aging.pdf', title: 'Aging report', shows: 'Internal.', hold: 'internal, not an exhibit' }], narrativeFile: '01 Narrative.md' } })
  })

  it('names every problem at once', () => {
    const r = parseLegalFilingManifest({ matter_id: 'x', documents: [{ file: 'a.mp4', title: '', shows: '' }] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.problems).toEqual([
      'matter_id is missing or is not a legal_matters.id.',
      'documents[0] (a.mp4): Give the document a title.',
      'documents[0]: a.mp4 is not a kind the portal takes (PDF, an image, .eml or .txt).',
    ])
    expect(parseLegalFilingManifest({ matter_id: M })).toEqual({ ok: false, problems: ['Nothing to file: no documents and no narrative_file.'] })
    expect(parseLegalFilingManifest([])).toEqual({ ok: false, problems: ['The manifest is not a JSON object.'] })
  })

  it('checks a file once read, skips one already on the matter, and checks the narrative', () => {
    const doc = { file: 'report.pdf', title: 'Billing report', shows: 'x', hold: '' }
    expect(legalFilingFileProblem(doc, 11 * 1024 * 1024)).toContain('over 10 MB')
    expect(legalFilingFileProblem(doc, 1000)).toBeNull()
    expect(legalFilingAlreadyThere([{ title: 'Billing report', original_name: 'report.pdf', size_bytes: 1000 }], doc, 1000, 'report.pdf')).toBe(true)
    expect(legalFilingAlreadyThere([{ title: 'Billing report', original_name: 'report.pdf', size_bytes: 999 }], doc, 1000, 'report.pdf')).toBe(false)
    expect(legalFilingNarrativeProblem('  ')).toBe('The narrative file is empty.')
    expect(legalFilingNarrativeProblem('## The parties')).toBeNull()
  })
})
