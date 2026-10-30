import { describe, expect, it } from 'vitest'
import { EVIDENCE_LANDING_GONE_WORDS, EVIDENCE_LANDING_LIT_MS, evidenceLanding, evidenceLandingFilterWords, evidenceRowSelector } from './evidenceLanding'
import { plainWordsFailures } from '../plainWords'
import { LEGAL_DOCUMENT_FILTERS } from './legalMatterDocuments'

const rows = [
  { id: 'd-sent', state: 'sent', held: false, addedOn: '2026-10-20' },
  { id: 'd-draft', state: 'draft', held: true, addedOn: '2026-10-28' },
  { id: 'd-final', state: 'final', held: false, addedOn: '2026-10-01' },
]
const WEEK = '2026-10-25'

describe('evidenceLanding (v2.6166): what Show on Evidence finds', () => {
  it('a row on the tab as drawn is shown', () => {
    expect(evidenceLanding('d-sent', rows, 'all', WEEK)).toEqual({ kind: 'shown', id: 'd-sent', note: '' })
    expect(evidenceLanding('d-sent', rows, 'sent', WEEK)).toEqual({ kind: 'shown', id: 'd-sent', note: '' })
    expect(evidenceLanding('d-draft', rows, 'week', WEEK)).toEqual({ kind: 'shown', id: 'd-draft', note: '' })
  })

  it('a row the open filter hides says which filter, so the panel clears it and says so in one line', () => {
    expect(evidenceLanding('d-final', rows, 'sent', WEEK)).toEqual({ kind: 'behind_filter', id: 'd-final', filter: 'sent', note: 'The Sent filter hid this paper, so every paper shows now.' })
    expect(evidenceLanding('d-final', rows, 'week', WEEK)).toEqual({ kind: 'behind_filter', id: 'd-final', filter: 'week', note: 'The Added this week filter hid this paper, so every paper shows now.' })
    expect(evidenceLanding('d-sent', rows, 'held', WEEK).kind).toBe('behind_filter')
  })

  it('an id no live row carries is gone, whatever the filter', () => {
    expect(evidenceLanding('d-removed', rows, 'all', WEEK)).toEqual({ kind: 'gone', id: 'd-removed', note: EVIDENCE_LANDING_GONE_WORDS })
    expect(evidenceLanding('d-removed', [], 'sent', WEEK).kind).toBe('gone')
  })

  it('every line a first-timer reads passes the plain-words rules', () => {
    expect(plainWordsFailures(EVIDENCE_LANDING_GONE_WORDS)).toEqual([])
    for (const f of LEGAL_DOCUMENT_FILTERS) expect(plainWordsFailures(evidenceLandingFilterWords(f))).toEqual([])
  })

  it('the lit time is a few seconds, and the row selector is the panel’s own attribute', () => {
    expect(EVIDENCE_LANDING_LIT_MS).toBeGreaterThanOrEqual(2000)
    expect(EVIDENCE_LANDING_LIT_MS).toBeLessThanOrEqual(6000)
    expect(evidenceRowSelector('4f1a-9')).toBe('[data-legal-document="4f1a-9"]')
    expect(evidenceRowSelector('a"b')).toBe('[data-legal-document="a\\"b"]')
  })
})
