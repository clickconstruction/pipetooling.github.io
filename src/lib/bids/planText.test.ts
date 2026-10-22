import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { answerWords, flagWords, searchPlanPages, searchRead, searchTerms, setWords, sheetLabel, substrateNotes, substrateSchedules, type PlanPageRow, type PlanSubstrate } from './planText'

const pages: PlanPageRow[] = [
  { page: 1, sheet_no: 'P-001', title: 'Plumbing notes', text: 'GENERAL NOTES 14. KITCHEN EQUIPMENT AND ITS CONNECTIONS BY OTHERS. 22. VERIFY INVERT ELEVATIONS.', has_text: true, source: 'round' },
  { page: 2, sheet_no: 'P-201', title: 'First floor plumbing', text: 'FD-1 TYP. SEE DETAIL 4/P-501. FD-1 AT MOP SINK. CO WC-1 LAV-1', has_text: true, source: 'round' },
  { page: 3, sheet_no: 'P-601', title: 'Plumbing schedules', text: 'FD-1 FLOOR DRAIN ZURN Z415 3 IN OUTLET NICKEL BRONZE STRAINER', has_text: true, source: 'round' },
  { page: 4, sheet_no: null, title: null, text: '', has_text: false, source: 'round' },
]
const sub: PlanSubstrate = {
  sheets: [
    { page: 1, sheet_no: { value: 'P-001' }, notes: [{ category: 'general', text: { value: 'Kitchen equipment and its connections by others.' }, flags: ['exclusion_candidate'] }] },
    { page: 3, sheet_no: { value: 'P-601' }, schedules: [{ schedule_type: 'plumbing_fixture', rows: [{ tag: 'FD-1', description: 'Floor drain, Zurn Z415', connections: '3 in. W' }, { tag: 'WC-1', description: 'Wall-hung water closet' }] }] },
  ],
}

describe('searchTerms and the hits', () => {
  it('drops the question words and keeps sheet numbers whole', () => {
    expect(searchTerms('Is there a grease interceptor on this job?')).toEqual(['grease', 'interceptor'])
    expect(searchTerms('P-401')).toEqual(['p-401'])
    expect(searchTerms('how many floor drains')).toEqual(['floor', 'drains'])
  })
  it('hits by sheet, most hits first, with a snippet', () => {
    const hits = searchPlanPages(pages, 'FD-1')
    expect(hits.map((h) => h.sheet)).toEqual(['P-201', 'P-601'])
    expect(hits[0]!.count).toBe(2)
    expect(hits[0]!.snippet).toContain('FD-1 TYP.')
    expect(searchPlanPages(pages, 'grease interceptor')).toEqual([])
    expect(sheetLabel(pages[3]!)).toBe('page 4')
  })
})

describe('the robot\'s read', () => {
  it('notes with flag words and schedules as tables', () => {
    expect(substrateNotes(sub)).toEqual([{ sheet: 'P-001', text: 'Kitchen equipment and its connections by others.', flags: ['exclusion'] }])
    const t = substrateSchedules(sub)[0]!
    expect(t.type).toBe('plumbing fixture')
    expect(t.columns).toEqual(['tag', 'description', 'connections'])
    expect(t.rows[1]).toEqual(['WC-1', 'Wall-hung water closet', ''])
    expect(flagWords('rfi_candidate')).toBe('RFI')
  })
  it('searchRead finds the note and the schedule row', () => {
    const r = searchRead(sub, 'kitchen')
    expect(r.notes.length).toBe(1)
    expect(searchRead(sub, 'zurn').scheduleRows[0]!.words).toBe('FD-1, Floor drain, Zurn Z415, 3 in. W')
  })
})

describe('the answer card', () => {
  it('names the sheets, quotes the schedule row and the note; never a count', () => {
    const a = answerWords('FD-1', searchPlanPages(pages, 'FD-1'), searchRead(sub, 'FD-1'), true)
    expect(a).toBe('Fd-1 is on 2 sheets, first P-201, P-601. The plumbing fixture on P-601 lists FD-1, Floor drain, Zurn Z415, 3 in. W.')
    const none = answerWords('grease interceptor', [], searchRead(sub, 'grease interceptor'), true)
    expect(none).toBe('No sheet mentions grease interceptor.')
    const kitchen = answerWords('kitchen', searchPlanPages(pages, 'kitchen'), searchRead(sub, 'kitchen'), true)
    expect(kitchen).toBe('Kitchen is on P-001. A note on P-001 says Kitchen equipment and its connections by others.')
    expect(answerWords('anything', [], searchRead(null, 'anything'), false)).toBe('This set has no text to search.')
    for (const s of [a, none, kitchen]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('the set line', () => {
    expect(setWords(pages, 9, '2:06 PM', 'round')).toBe('4 sheets, 9 plumbing. Text from the round 2:06 PM. Type a word or a question.')
    expect(setWords(pages.map((p) => ({ ...p, has_text: false })), null, null, 'round')).toBe('4 sheets. No text to search. The robot read these sheets by eye.')
    expect(setWords([], null, null, null)).toBe('No page text yet.')
    expect(plainWordsFailures(setWords(pages, 9, '2:06 PM', 'browser'))).toEqual([])
  })
})
