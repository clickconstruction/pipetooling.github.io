import { describe, expect, it } from 'vitest'
import type { LegalEntryRow } from './legalMatters'
import { buildLegalTimeline, eventDraftProblem, eventHoldKey, eventMetaOf, eventsNarrativeMarkdown, insertEventsIntoNarrative, planDraftProblem, planHoldKey, planMetaOf, planStateWords, timelineCountsWords, timelineDayWords, timelineDocumentsFromPortal, timelineDocumentsFromRows, timelineHoldKey, timelineRelativeWords } from './legalTimeline'

const TODAY = '2026-10-23'

function entry(over: Partial<LegalEntryRow>): LegalEntryRow {
  return { id: 'e', matter_id: 'm', kind: 'note', amount: null, body: '', occurred_on: TODAY, meta: {}, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-10-23T15:00:00Z', ...over }
}
function plan(id: string, on: string, body: string, meta: Record<string, unknown> = {}, over: Partial<LegalEntryRow> = {}): LegalEntryRow {
  return entry({ id, kind: 'plan', occurred_on: on, body, meta: { notes: '', done_at: null, done_by: null, source: 'office', ...meta }, created_at: `2026-10-20T15:00:00.${id.padStart(3, '0')}Z`, ...over })
}

describe('planned steps on the line (v2.5800)', () => {
  const entries = [
    entry({ id: 'fee', kind: 'fee', amount: 450, body: 'Demand letter', occurred_on: '2026-10-01', via_portal: true, meta: { recordedBy: { id: 'r', name: 'Dana Reyes' } } }),
    plan('p1', '2026-10-27', 'Send the response letter, final invoice and settlement offer', { notes: 'Certified mail and email.' }),
    plan('p2', '2026-11-03', 'Burd’s response date'),
    plan('p3', '2026-10-20', 'Pull the Take 5 photos', { done_at: '2026-10-18', done_by: 'u1', done_note: 'In the Drive folder.' }),
    plan('p4', '2026-10-21', 'Call the GC’s AP desk'),
    plan('p5', TODAY, 'Confirm the lien affidavit day with the county'),
    plan('p6', '2026-11-13', 'Mail the materials lien notice', { source: 'mcp' }),
    plan('p7', '2026-11-20', 'Mail the retainage lien notice', { source: 'firm' }, { via_portal: true, meta: { notes: 'Firm will draft.', source: 'firm', recordedBy: { id: 'r', name: 'Dana Reyes' } } }),
    plan('p8', '2026-12-15', 'Lien affidavit if unpaid', {}, { voided_at: '2026-10-22T10:00:00Z', void_reason: 'Entered twice' }),
  ]
  const docs = timelineDocumentsFromRows([
    { id: 'd1', title: 'Final invoice 891', shows: 'The amount owed, itemized.', added_at: '2026-10-22T18:00:00Z', added_by: 'u1', held_reason: '' },
    { id: 'd2', title: 'Internal margin sheet', shows: 'Our cost.', added_at: '2026-10-22T19:00:00Z', added_by: 'u1', held_reason: 'Internal only' },
  ], (iso) => iso.slice(0, 10), (id) => (id === 'u1' ? 'Grace' : null))

  it('merges entries and documents by day, oldest first, and splits around today', () => {
    const t = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, holds: { [planHoldKey('p2')]: true, _reasons: true as unknown as boolean }, holdReasons: { [planHoldKey('p2')]: 'Not settled yet' }, userNameOf: (id) => (id === 'u1' ? 'Grace' : null), reader: 'office' })
    expect(t.past.map((i) => i.key)).toEqual(['entry:fee', 'entry:p3', 'entry:p4', 'doc:d1', 'doc:d2'])
    expect(t.today.map((i) => i.key)).toEqual(['entry:p5'])
    expect(t.upcoming.map((i) => i.key)).toEqual(['entry:p1', 'entry:p2', 'entry:p6', 'entry:p7', 'entry:p8'])
    // p1 p2 p4 p5 p6 p7 are live plans (p3 done, p8 undone); p4 is overdue, p5 due today.
    expect(t.counts).toEqual({ planned: 6, overdue: 1, dueToday: 1, done: 1, held: 2 })
    expect(timelineCountsWords(t.counts)).toBe('6 planned · 1 overdue · 1 due today · 1 done')
  })

  it('a done step sits on the day it was done and still names the day it was planned for', () => {
    const t = buildLegalTimeline({ entries, todayYmd: TODAY, reader: 'office', userNameOf: (id) => (id === 'u1' ? 'Grace' : null) })
    const done = t.past.find((i) => i.key === 'entry:p3')!
    expect(done.ymd).toBe('2026-10-18')
    expect(done.plannedYmd).toBe('2026-10-20')
    expect(done.state).toBe('done')
    expect(done.stateWords).toBe('Done Oct 18. Planned for Oct 20. In the Drive folder.')
    expect(done.isLivePlan).toBe(false)
    expect(done.byName).toBe('Grace')
  })

  it('words overdue, due today and upcoming in plain words, and an undone step as undone', () => {
    const t = buildLegalTimeline({ entries, todayYmd: TODAY, reader: 'office' })
    const by = (k: string) => [...t.past, ...t.today, ...t.upcoming].find((i) => i.key === k)!
    expect(by('entry:p4').stateWords).toBe('Overdue by 2 days. Not marked done.')
    expect(by('entry:p4').state).toBe('overdue')
    expect(by('entry:p5').stateWords).toBe('Due today.')
    expect(by('entry:p1').stateWords).toBe('Planned. In 4 days.')
    expect(by('entry:p1').notes).toBe('Certified mail and email.')
    expect(by('entry:p8').state).toBe('undone')
    expect(by('entry:p8').stateWords).toBe('Undone: Entered twice')
    expect(by('entry:p8').isLivePlan).toBe(false)
    expect(planStateWords({ plannedYmd: '2026-10-24', doneYmd: null, doneNote: '', voided: false, voidReason: '' }, TODAY).words).toBe('Planned. Tomorrow.')
    expect(planStateWords({ plannedYmd: '2026-10-22', doneYmd: null, doneNote: '', voided: false, voidReason: '' }, TODAY).words).toBe('Overdue by 1 day. Not marked done.')
  })

  it('names who planned it on each side, with the MCP marked for the office', () => {
    const office = buildLegalTimeline({ entries, todayYmd: TODAY, reader: 'office', userNameOf: (id) => (id === 'u1' ? 'Grace' : null) })
    const firm = buildLegalTimeline({ entries, todayYmd: TODAY, reader: 'firm' })
    const pick = (t: ReturnType<typeof buildLegalTimeline>, k: string) => [...t.past, ...t.today, ...t.upcoming].find((i) => i.key === k)!
    expect(pick(office, 'entry:p6').byName).toBe('Grace · dev MCP')
    expect(pick(office, 'entry:p6').source).toBe('mcp')
    expect(pick(office, 'entry:p7').byName).toBe('Dana Reyes · firm')
    expect(pick(firm, 'entry:p7').byName).toBe('Dana Reyes')
    expect(pick(firm, 'entry:p1').byName).toBe('the office')
    expect(pick(firm, 'entry:p6').byName).toBe('the office')
    expect(pick(office, 'entry:fee').kindWords).toBe('fee')
    expect(pick(firm, 'entry:fee').kindWords).toBe('Attorney fee')
    expect(pick(office, 'entry:fee').amount).toBe(450)
  })

  it('a held step reads held with its reason on the desk; a document carries what it shows and who added it', () => {
    const t = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, holds: { [planHoldKey('p2')]: true }, holdReasons: { [planHoldKey('p2')]: 'Not settled yet' }, reader: 'office' })
    const held = t.upcoming.find((i) => i.key === 'entry:p2')!
    expect(held.held).toBe(true)
    expect(held.heldReason).toBe('Not settled yet')
    const d = t.past.find((i) => i.key === 'doc:d1')!
    expect(d).toMatchObject({ kind: 'document', what: 'Final invoice 891', notes: 'The amount owed, itemized.', byName: 'Grace', stateWords: 'Added to Evidence.', documentId: 'd1' })
    expect(t.past.find((i) => i.key === 'doc:d2')!.held).toBe(true)
    expect(timelineDocumentsFromPortal([{ id: 'x', title: 'T', shows: 'S', addedOn: '2026-10-01', addedByName: 'Grace' }])[0]).toMatchObject({ addedOn: '2026-10-01', held: false, addedByName: 'Grace' })
  })

  it('reads a plan’s meta defensively and knows the hold key', () => {
    expect(planMetaOf({ notes: 'n', done_at: '2026-10-01', done_by: 'u', source: 'mcp' })).toEqual({ notes: 'n', doneAt: '2026-10-01', doneBy: 'u', doneNote: '', source: 'mcp' })
    expect(planMetaOf({ done_at: 'not a day' }, true)).toEqual({ notes: '', doneAt: null, doneBy: null, doneNote: '', source: 'firm' })
    expect(planMetaOf(null)).toMatchObject({ source: 'office' })
    expect(planHoldKey('abc')).toBe('plan:abc')
  })

  it('refuses a draft with no day or no words, and over the caps', () => {
    expect(planDraftProblem({ on: '', body: 'x', notes: '' })).toBe('Pick the day it is planned for.')
    expect(planDraftProblem({ on: '2026-02-30', body: 'x', notes: '' })).toBe('Pick the day it is planned for.')
    expect(planDraftProblem({ on: '2026-10-27', body: '  ', notes: '' })).toBe('Say what is planned.')
    expect(planDraftProblem({ on: '2026-10-27', body: 'x'.repeat(501), notes: '' })).toMatch(/under 500/)
    expect(planDraftProblem({ on: '2026-10-27', body: 'x', notes: 'n'.repeat(4001) })).toMatch(/under 4,000/)
    expect(planDraftProblem({ on: '2026-10-27', body: 'Send the letter', notes: '' })).toBeNull()
  })

  it('prints days as the line does', () => {
    expect(timelineDayWords('2026-10-27', TODAY)).toBe('Tue, Oct 27')
    expect(timelineDayWords('2025-12-15', TODAY)).toBe('Mon, Dec 15, 2025')
    expect(timelineRelativeWords('2026-10-25', TODAY)).toBe('in 2 days')
    expect(timelineRelativeWords('2026-10-22', TODAY)).toBe('yesterday')
    expect(timelineRelativeWords('2026-10-13', TODAY)).toBe('10 days ago')
  })
})

describe('events: what happened, recorded by the office (punch list #167, v2.5836)', () => {
  const TODAY = '2026-10-24'
  const row = (over: Partial<LegalEntryRow>): LegalEntryRow => ({ id: 'e', matter_id: 'm', kind: 'event', amount: null, body: '', occurred_on: TODAY, meta: {}, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-10-24T15:00:00Z', ...over })
  const docs = timelineDocumentsFromRows(
    [{ id: 'd-receipt', title: 'Supplier receipt, paid in full', shows: 'The job account at $0.', added_at: '2026-10-24T18:00:00Z', added_by: 'u1', held_reason: '' }, { id: 'd-memo', title: 'Internal memo', shows: '', added_at: '2026-10-24T18:00:00Z', added_by: 'u1', held_reason: 'internal' }],
    (iso) => iso.slice(0, 10), () => 'Grace',
  )
  const entries = [
    row({ id: 'ev-notice', occurred_on: '2026-10-22', body: 'The GC’s notice of termination arrived', meta: { notes: 'By email, 4:12 pm.', document_ids: [], source: 'office' } }),
    row({ id: 'ev-paid', occurred_on: '2026-10-22', body: 'The supplier’s job account was paid in full', meta: { notes: '', document_ids: ['d-receipt', 'd-memo', 'd-gone'], source: 'mcp' }, created_at: '2026-10-24T16:00:00Z' }),
    row({ id: 'ev-undone', occurred_on: '2026-10-23', body: 'Entered twice', meta: { notes: '', document_ids: [], source: 'office' }, voided_at: '2026-10-24T17:00:00Z', void_reason: 'a duplicate' }),
    row({ id: 'pl', kind: 'plan', occurred_on: '2026-10-27', body: 'Mail the letters', meta: { notes: '', source: 'office' } }),
  ]
  const office = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, holds: { [eventHoldKey('ev-notice')]: true }, holdReasons: { [eventHoldKey('ev-notice')]: 'counsel first' }, userNameOf: () => 'Grace', reader: 'office' })

  it('sits on the day it happened, in creation order within the day, as a happened item with its notes', () => {
    expect(office.past.map((i) => [i.key, i.kind, i.ymd, i.state])).toEqual([
      ['entry:ev-notice', 'event', '2026-10-22', 'happened'],
      ['entry:ev-paid', 'event', '2026-10-22', 'happened'],
      ['entry:ev-undone', 'event', '2026-10-23', 'undone'],
    ])
    expect(office.past[0]).toEqual(expect.objectContaining({ what: 'The GC’s notice of termination arrived', notes: 'By email, 4:12 pm.', kindWords: 'happened', byName: 'Grace', isLivePlan: false, plannedYmd: null }))
    expect(office.past[2]!.stateWords).toBe('Undone: a duplicate')
    // A planned step still counts; an event never counts as planned or done. Held: the event and the held document.
    expect(office.counts).toEqual({ planned: 1, overdue: 0, dueToday: 0, done: 0, held: 2 })
  })
  it('is held under event:<id> with its reason on the desk, and marks the dev MCP as the source', () => {
    expect(office.past[0]).toEqual(expect.objectContaining({ held: true, heldReason: 'counsel first' }))
    expect(office.past[1]!.byName).toBe('Grace · dev MCP')
    expect(timelineHoldKey(office.past[0]!)).toBe('event:ev-notice')
    expect(timelineHoldKey(office.upcoming[0]!)).toBe('plan:pl')
    expect(timelineHoldKey({ kind: 'document', entryId: null })).toBe('')
  })
  it('names its documents by title, says which the office holds, and stands in for one no longer on Evidence', () => {
    expect(office.past[1]!.documents).toEqual([
      { id: 'd-receipt', title: 'Supplier receipt, paid in full', held: false },
      { id: 'd-memo', title: 'Internal memo', held: true },
      { id: 'd-gone', title: 'a document no longer on Evidence', held: false },
    ])
    expect(office.past[0]!.documents).toEqual([])
  })
  it('reads for the firm in the firm’s words, every event included (the function drops held ones before they travel)', () => {
    const firm = buildLegalTimeline({ entries, documents: docs, todayYmd: TODAY, reader: 'firm' })
    expect(firm.past[0]!.kindWords).toBe('what happened · recorded by the office')
    expect(firm.past[0]!.held).toBe(false)
  })
  it('reads an event’s meta defensively and refuses a draft dated ahead, with no day or no words', () => {
    expect(eventMetaOf(null)).toEqual({ notes: '', documentIds: [], source: 'office' })
    expect(eventMetaOf({ notes: 'n', document_ids: ['a', 3, ''], source: 'mcp' })).toEqual({ notes: 'n', documentIds: ['a'], source: 'mcp' })
    const ok = { on: '2026-10-22', body: 'Paid', notes: '', documentIds: [] }
    expect(eventDraftProblem(ok, TODAY)).toBeNull()
    expect(eventDraftProblem({ ...ok, on: '2026-10-25' }, TODAY)).toMatch(/ahead of today/)
    expect(eventDraftProblem({ ...ok, on: '' }, TODAY)).toBe('Pick the day it happened.')
    expect(eventDraftProblem({ ...ok, body: ' ' }, TODAY)).toBe('Say what happened.')
    expect(eventDraftProblem({ ...ok, body: 'x'.repeat(501) }, TODAY)).toMatch(/under 500/)
  })
  it('lists the live events for the narrative, oldest first, and pastes them under What happened once', () => {
    const md = eventsNarrativeMarkdown(office, TODAY)
    expect(md).toBe('- **Oct 22** — The GC’s notice of termination arrived By email, 4:12 pm.\n- **Oct 22** — The supplier’s job account was paid in full (Supplier receipt, paid in full, Internal memo, a document no longer on Evidence)')
    expect(eventsNarrativeMarkdown(buildLegalTimeline({ entries: [entries[3]!], todayYmd: TODAY, reader: 'office' }), TODAY)).toBe('')
    const outline = '## The parties\n\nClick and Burd.\n\n## What happened\n\nThe job ran May to October.\n\n## Still missing\n'
    const once = insertEventsIntoNarrative(outline, md)
    expect(once).toBe('## The parties\n\nClick and Burd.\n\n## What happened\n\nThe job ran May to October.\n\n' + md + '\n\n## Still missing\n')
    expect(insertEventsIntoNarrative(once, md)).toBe(once)
    expect(insertEventsIntoNarrative('', md)).toBe('## What happened\n\n' + md + '\n')
    expect(insertEventsIntoNarrative('Just prose.', md)).toBe('Just prose.\n\n## What happened\n\n' + md + '\n')
    expect(insertEventsIntoNarrative(outline, '')).toBe(outline)
  })
})
