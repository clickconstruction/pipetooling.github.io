import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  KEPT_OUT_WORDS,
  LEGAL_PROCEEDING_KINDS,
  PROCEEDINGS_EMPTY_WORDS,
  PROCEEDING_PAYLOAD_KEYS,
  emptyProceedingDraft,
  keptOutDocumentIds,
  parseLegalPortalProceedings,
  proceedingDetailWords,
  proceedingDraftOf,
  proceedingDraftProblem,
  proceedingForFirm,
  proceedingKindWords,
  proceedingStatusWords,
  proceedingsFromRows,
  type LegalMatterProceedingRow,
} from './legalProceedings'

const row = (id: string, more: Partial<LegalMatterProceedingRow> = {}): LegalMatterProceedingRow => ({
  id,
  kind: 'agency_complaint',
  title: 'Complaint to the State Plumbing Board',
  agency: 'State Plumbing Board',
  reference: 'C-2026-0431',
  person_id: 'p1',
  status: 'open',
  status_on: null,
  note: 'the inspector took the call',
  document_ids: ['d1', 'd2'],
  keep_out: true,
  added_at: '2026-10-28T15:00:00Z',
  ...more,
})

describe('proceedingsFromRows: the stored rows as the list reads them', () => {
  it('keeps the order added, reads an unknown kind as other and an unknown status as open, and a date down to its day', () => {
    const list = proceedingsFromRows([row('b', { added_at: '2026-10-29T15:00:00Z', kind: 'lawsuit', status: 'pending', status_on: '2026-11-03T00:00:00', keep_out: null, document_ids: null }), row('a')])
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
    expect(list[1]).toMatchObject({ kind: 'other', status: 'open', statusOn: '2026-11-03', keepOut: true, documentIds: [] })
    expect(list[0]).toMatchObject({ personId: 'p1', documentIds: ['d1', 'd2'], note: 'the inspector took the call' })
  })

  it('words every kind in plain words, the status with its day, and the row’s second line', () => {
    for (const k of LEGAL_PROCEEDING_KINDS) expect(plainWordsFailures(proceedingKindWords(k))).toEqual([])
    expect(proceedingStatusWords('answered', '2026-11-03')).toBe('answered 2026-11-03')
    expect(proceedingStatusWords('open', null)).toBe('open')
    const [p] = proceedingsFromRows([row('a')])
    expect(proceedingDetailWords(p!, 'R. Calloway')).toBe(`ref C-2026-0431 · contact: R. Calloway · 2 documents · ${KEPT_OUT_WORDS}`)
    expect(proceedingDetailWords({ reference: '', documentIds: ['d1'], keepOut: false }, null)).toBe('1 document')
    expect(proceedingDetailWords({ reference: '', documentIds: [], keepOut: true }, null)).toBe('')
    expect(plainWordsFailures(PROCEEDINGS_EMPTY_WORDS)).toEqual([])
  })
})

describe('proceedingDraftProblem: the RPC’s rules, client side', () => {
  it('needs a kind, a name under 160, a status, a real day and a note under 600', () => {
    expect(proceedingDraftProblem(emptyProceedingDraft())).toBe('Name the proceeding.')
    expect(proceedingDraftProblem({ ...emptyProceedingDraft(), title: 'Records request', statusOn: 'Tuesday' })).toBe('Write the day as a date.')
    expect(proceedingDraftProblem({ ...emptyProceedingDraft(), title: 'x'.repeat(161) })).toBe('Keep the name under 160 characters.')
    expect(proceedingDraftProblem({ ...emptyProceedingDraft(), title: 'Records request', note: 'n'.repeat(601) })).toBe('Keep the note under 600 characters.')
    expect(proceedingDraftProblem({ ...emptyProceedingDraft(), title: 'Records request', statusOn: '2026-11-03' })).toBeNull()
    expect(emptyProceedingDraft().keepOut).toBe(true)
    const [p] = proceedingsFromRows([row('a')])
    expect(proceedingDraftOf(p!)).toMatchObject({ kind: 'agency_complaint', personId: 'p1', statusOn: '', documentIds: ['d1', 'd2'], keepOut: true })
  })
})

describe('keptOutDocumentIds: the hold', () => {
  it('names every document of a live proceeding with keep out, and none of one without', () => {
    const list = proceedingsFromRows([row('a'), row('b', { document_ids: ['d3'], keep_out: false }), row('c', { document_ids: ['d2', 'd4'] })])
    expect([...keptOutDocumentIds(list)].sort()).toEqual(['d1', 'd2', 'd4'])
    expect(keptOutDocumentIds([]).size).toBe(0)
  })
})

describe('the firm’s read', () => {
  const people = [{ id: 'p1', name: 'R. Calloway', role: 'president', reason: 'SECRET-reason' }]
  it('cuts a proceeding to the contact’s name and role and the documents that travelled, never the note or a reason', () => {
    const [p] = proceedingsFromRows([row('a')])
    const sent = proceedingForFirm(p!, people, new Set(['d2']), '2026-10-28T15:00:00Z')
    expect(sent).toEqual({ id: 'a', kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', contact_name: 'R. Calloway', contact_role: 'president', status: 'open', status_on: null, document_ids: ['d2'], keep_out: true, added_at: '2026-10-28T15:00:00Z' })
    expect(Object.keys(sent).sort()).toEqual([...PROCEEDING_PAYLOAD_KEYS].sort())
    expect(JSON.stringify(sent)).not.toMatch(/SECRET|inspector/)
    const [q] = proceedingsFromRows([row('b', { person_id: 'gone' })])
    expect(proceedingForFirm(q!, people, null)).toMatchObject({ contact_name: '', contact_role: '', document_ids: ['d1', 'd2'] })
  })

  it('parses the payload defensively: a row without an id and a name is dropped, [] from an older function', () => {
    const [p] = proceedingsFromRows([row('a', { status: 'answered', status_on: '2026-11-03' })])
    const parsed = parseLegalPortalProceedings([proceedingForFirm(p!, people, null), { id: 'x' }, 'junk', { id: 'y', title: 'Bond claim', kind: 'bond_claim', document_ids: [1, 'd9'] }])
    expect(parsed).toEqual([
      { id: 'a', kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', contactName: 'R. Calloway', contactRole: 'president', status: 'answered', statusOn: '2026-11-03', documentIds: ['d1', 'd2'], keepOut: true },
      { id: 'y', kind: 'bond_claim', title: 'Bond claim', agency: '', reference: '', contactName: '', contactRole: '', status: 'open', statusOn: null, documentIds: ['d9'], keepOut: true },
    ])
    expect(parseLegalPortalProceedings(undefined)).toEqual([])
  })
})
