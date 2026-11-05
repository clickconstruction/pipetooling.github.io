import { describe, expect, it } from 'vitest'
import { EMPTY_MARK_DRAFT, itemKickerWords, linesWithTheme, markCountWords, markDraftProblem, markIsProposed, markTargetOfLine, markedWords, marksByTheme, marksOnTarget, proofCountsWords, proposedCountWords, provesByWords, sortThemes, nearbyLines, themeCountsOnLines, themeDraftProblem, themeItems, themeItemsHeadWords, themeListText, tickedWords, toggleThemeId, type LegalThemeMark } from './legalThemes'

const theme = (id: string, name: string, retired_at: string | null = null) => ({ id, name, retired_at })
const mark = (over: Partial<LegalThemeMark> = {}): LegalThemeMark => ({
  id: 'm1',
  theme_id: 't1',
  target_kind: 'hr_entry',
  target_id: 'e1',
  person_id: 'p1',
  matter_id: null,
  why: '',
  proves_by: null,
  marked_by: 'u1',
  marked_at: '2026-11-05T00:00:00Z',
  author_label: null,
  proposed: false,
  kept_at: null,
  kept_by: null,
  removed_at: null,
  removed_by: null,
  removed_why: '',
  ...over,
})

describe('themes on the record (v2.6545)', () => {
  it('holds a theme to a name under the caps that no standing theme carries, whatever the case', () => {
    const standing = [theme('t1', 'Dishonesty'), theme('t2', 'Late to jobs', '2026-10-01T00:00:00Z')]
    expect(themeDraftProblem({ name: 'Disrespectful conduct', whatCounts: '', counselWords: '' }, standing)).toBeNull()
    expect(themeDraftProblem({ name: '  ', whatCounts: '', counselWords: '' }, standing)).toBe('Give the theme a name.')
    expect(themeDraftProblem({ name: 'dishonesty', whatCounts: '', counselWords: '' }, standing)).toBe('A theme named Dishonesty already stands.')
    expect(themeDraftProblem({ name: 'Dishonesty', whatCounts: '', counselWords: '' }, standing, 't1')).toBeNull()
    expect(themeDraftProblem({ name: 'Late to jobs', whatCounts: '', counselWords: '' }, standing)).toBeNull()
    expect(themeDraftProblem({ name: 'x'.repeat(81), whatCounts: '', counselWords: '' }, standing)).toBe('The name is over 80 characters.')
    expect(themeDraftProblem({ name: 'A', whatCounts: 'x'.repeat(401), counselWords: '' }, standing)).toBe('What counts is over 400 characters.')
    expect(themeDraftProblem({ name: 'A', whatCounts: '', counselWords: 'x'.repeat(201) }, standing)).toBe('Counsel’s words are over 200 characters.')
  })

  it('sorts the standing themes by name and the retired ones after', () => {
    expect(sortThemes([theme('a', 'Late to jobs', '2026-10-01T00:00:00Z'), theme('b', 'Interference with the business'), theme('c', 'Dishonesty')]).map((t) => t.name)).toEqual(['Dishonesty', 'Interference with the business', 'Late to jobs'])
  })

  it('counts live marks by theme and words the counts, the proof and the proposals', () => {
    const marks = [
      mark({ id: 'm1', proves_by: 'document' }),
      mark({ id: 'm2', proves_by: 'document', target_id: 'e2' }),
      mark({ id: 'm3', proves_by: 'firsthand', target_id: 'e3', proposed: true }),
      mark({ id: 'm4', proves_by: 'relayed', target_id: 'e4', removed_at: '2026-11-05T01:00:00Z', removed_why: 'wrong theme' }),
      mark({ id: 'm5', theme_id: 't2', proves_by: 'own_words', target_id: 'e1' }),
    ]
    const by = marksByTheme(marks)
    expect(by.get('t1')?.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(by.get('t2')?.map((m) => m.id)).toEqual(['m5'])
    expect(markCountWords(0)).toBe('no marks yet')
    expect(markCountWords(1)).toBe('1 mark')
    expect(markCountWords(17)).toBe('17 marks')
    expect(proofCountsWords(by.get('t1') ?? [])).toBe('2 by a document · 0 by their own words · 1 firsthand · 0 relayed')
    expect(proposedCountWords(marks)).toBe('1 proposed by the agent, not yet kept')
    expect(proposedCountWords([mark({ proposed: true, kept_at: '2026-11-05T02:00:00Z' })])).toBe('')
    expect(markIsProposed(marks[2]!)).toBe(true)
    expect(markIsProposed(mark({ proposed: true, kept_at: '2026-11-05T02:00:00Z' }))).toBe(false)
    expect(provesByWords('own_words')).toBe('their own words')
    expect(provesByWords(null)).toBe('')
  })
})

describe('marks on the record (v2.6546)', () => {
  const line = (table: string, id: string) => ({ ref: { table, id } })
  it('finds the thing a line can carry a mark on', () => {
    expect(markTargetOfLine(line('person_file_entries', 'e1'))).toEqual({ kind: 'hr_entry', id: 'e1' })
    expect(markTargetOfLine(line('person_file_evidence', 'v1'))).toEqual({ kind: 'hr_evidence', id: 'v1' })
    expect(markTargetOfLine(line('legal_matter_documents', 'd1'))).toEqual({ kind: 'matter_document', id: 'd1' })
    expect(markTargetOfLine(line('person_licenses', 'l1'))).toBeNull()
  })

  it('counts the lines a theme is on and filters to them, live marks only', () => {
    const lines = [line('person_file_entries', 'e1'), line('person_file_entries', 'e2'), line('person_file_evidence', 'v1'), line('person_licenses', 'l1')]
    const marks = [
      mark({ id: 'm1', theme_id: 't1', target_kind: 'hr_entry', target_id: 'e1' }),
      mark({ id: 'm2', theme_id: 't1', target_kind: 'hr_evidence', target_id: 'v1' }),
      mark({ id: 'm3', theme_id: 't2', target_kind: 'hr_entry', target_id: 'e2' }),
      mark({ id: 'm4', theme_id: 't1', target_kind: 'hr_entry', target_id: 'e2', removed_at: '2026-11-05T01:00:00Z' }),
    ]
    const counts = themeCountsOnLines(lines, marks)
    expect(counts.get('t1')).toBe(2)
    expect(counts.get('t2')).toBe(1)
    expect(linesWithTheme(lines, marks, 't1').map((l) => l.ref.id)).toEqual(['e1', 'v1'])
    expect(marksOnTarget(marks, { kind: 'hr_entry', id: 'e2' }).map((m) => m.id)).toEqual(['m3'])
  })

  it('holds a draft to the why cap, toggles a theme, and words the ticks and the outcome', () => {
    expect(markDraftProblem(EMPTY_MARK_DRAFT)).toBeNull()
    expect(markDraftProblem({ ...EMPTY_MARK_DRAFT, why: 'x'.repeat(201) })).toBe('Why it fits is over 200 characters.')
    const once = toggleThemeId(EMPTY_MARK_DRAFT, 't1')
    expect(once.themeIds).toEqual(['t1'])
    expect(toggleThemeId(once, 't1').themeIds).toEqual([])
    expect(tickedWords(1)).toBe('1 line ticked')
    expect(tickedWords(3)).toBe('3 lines ticked')
    expect(markedWords(['Dishonesty'], 3, 0)).toBe('Dishonesty marked on 3 lines.')
    expect(markedWords(['Dishonesty', 'Interference with the business'], 1, 0)).toBe('Dishonesty and Interference with the business marked on 1 line.')
    expect(markedWords(['A', 'B', 'C'], 2, 1)).toBe('A, B and C marked on 2 lines. 1 was marked already.')
    expect(markedWords(['Dishonesty'], 0, 1)).toBe('Dishonesty already on that line.')
    expect(markedWords(['Dishonesty'], 1, 0, ['record', 'records'])).toBe('Dishonesty marked on 1 record.')
  })
})

describe('By theme (v2.6547)', () => {
  const tl = (key: string, ymd: string, table: string, id: string, what: string, files: string[] = []) => ({ key, ymd, loggedAt: null, kindWords: 'conversation', what, notes: '', byName: 'Dana', ref: { table, id }, attachmentIds: files })
  const lines = [
    tl('entry:e1', '2026-07-22', 'person_file_entries', 'e1', 'Card charges on a day with no job.', ['f1']),
    tl('entry:e2', '2026-05-30', 'person_file_entries', 'e2', 'First instruction to cancel, by phone.'),
    tl('evidence:v1', '2026-06-26', 'person_file_evidence', 'v1', 'Text: cancel the service, third time.', ['f2']),
    tl('license:l1', '2026-01-01', 'person_licenses', 'l1', 'A license'),
    tl('entry:e3', '2026-08-05', 'person_file_entries', 'e3', 'A charge the day after leaving.'),
  ]
  const marks = [
    mark({ id: 'm1', target_id: 'e1', proves_by: 'document', why: 'charges ran' }),
    mark({ id: 'm2', target_id: 'e2', proves_by: 'firsthand' }),
    mark({ id: 'm3', target_kind: 'hr_evidence', target_id: 'v1', proves_by: 'document' }),
    mark({ id: 'm4', target_id: 'e3', proves_by: null, proposed: true }),
    mark({ id: 'm5', theme_id: 't2', target_id: 'e1', proves_by: 'own_words' }),
    mark({ id: 'm6', target_id: 'e2', theme_id: 't1', removed_at: '2026-11-05T01:00:00Z' }),
  ]
  const day = (ymd: string) => ymd

  it('lists the theme’s items oldest first or strongest first, and narrows by file, grade or proposal', () => {
    expect(themeItems(lines, marks, 't1').map((i) => i.line.key)).toEqual(['entry:e2', 'evidence:v1', 'entry:e1', 'entry:e3'])
    expect(themeItems(lines, marks, 't1', { order: 'strongest' }).map((i) => i.line.key)).toEqual(['evidence:v1', 'entry:e1', 'entry:e2', 'entry:e3'])
    expect(themeItems(lines, marks, 't1', { show: 'with_file' }).map((i) => i.line.key)).toEqual(['evidence:v1', 'entry:e1'])
    expect(themeItems(lines, marks, 't1', { show: 'firsthand' }).map((i) => i.line.key)).toEqual(['entry:e2'])
    expect(themeItems(lines, marks, 't1', { show: 'proposed' }).map((i) => i.line.key)).toEqual(['entry:e3'])
    expect(themeItems(lines, marks, 't2').map((i) => i.marks.length)).toEqual([2])
  })

  it('words the head, the kicker, the nearby lines and the list for counsel', () => {
    const items = themeItems(lines, marks, 't1')
    expect(themeItemsHeadWords(items, day)).toBe('4 items · first 2026-05-30 · last 2026-08-05 · 2 with a file')
    expect(themeItemsHeadWords(items.slice(0, 1), day)).toBe('1 item · 2026-05-30')
    expect(themeItemsHeadWords([], day)).toBe('no items yet')
    expect(itemKickerWords('Dishonesty', 2, 14)).toBe('Dishonesty · item 3 of 14')
    const near = nearbyLines(lines, 'evidence:v1', 1)
    expect(near.before.map((l) => l.key)).toEqual(['entry:e2'])
    expect(near.after.map((l) => l.key)).toEqual(['license:l1'])
    const text = themeListText({ name: 'Dishonesty', what_counts: 'A false statement.', counsel_words: 'fraud' }, 'Jordan Vale', items.slice(0, 2), day, (id) => (id === 'u1' ? 'Dana O.' : 'the agent'))
    expect(text).toBe(['Dishonesty — Jordan Vale', 'What counts: A false statement.', 'Counsel’s words: fraud', '2 items · first 2026-05-30 · last 2026-06-26 · 1 with a file · 1 by a document · 0 by their own words · 1 firsthand · 0 relayed', '', '1. 2026-05-30 · conversation · First instruction to cancel, by phone.', '   proves it by a firsthand account · marked by Dana O.', '2. 2026-06-26 · conversation · Text: cancel the service, third time.', '   proves it by a document · marked by Dana O.', '   1 file'].join('\n'))
  })
})
