import { describe, expect, it } from 'vitest'
import {
  BACK_ON_DECK_PATCH,
  decidedCounts,
  deckRows,
  lookedButtonWords,
  markAutoNote,
  normalizePaperTitle,
  outcomeWords,
  paperAgeWords,
  pressPatch,
  shortDay,
  somedayRows,
  undecidedSummary,
  undecidedWords,
  waitingRows,
  ymdAddDays,
  WAITING_DEFAULT_DAYS,
  type InboxPaper,
} from './physicalInbox'

const TODAY = '2026-10-24'

function paper(p: Partial<InboxPaper> & { id: string; title: string; came_on: string }): InboxPaper {
  return {
    detail: null,
    created_by: 'u1',
    created_at: `${p.came_on}T15:00:00.000Z`,
    state: 'open',
    outcome: null,
    outcome_detail: null,
    follow_up_on: null,
    outcome_at: null,
    outcome_by: null,
    checklist_item_id: null,
    dispatch_request_id: null,
    estimator_request_id: null,
    ...p,
  }
}

const phones = paper({ id: 'a', title: 'Two old iPhones in a box', came_on: '2026-08-19' })
const cards = paper({ id: 'b', title: 'New insurance cards, 6 trucks', came_on: '2026-10-19' })
const mail = paper({ id: 'c', title: 'Returned certified mail', came_on: '2026-10-20' })
const letter = paper({ id: 'd', title: 'Letter from the firm', came_on: '2026-10-24' })
const sameDayLater = paper({ id: 'e', title: 'A second paper today', came_on: '2026-10-24', created_at: '2026-10-24T16:00:00.000Z' })
const waitingMarcus = paper({ id: 'w', title: 'TDLR form, needs a signature', came_on: '2026-10-15', state: 'waiting', outcome: 'waiting', outcome_detail: 'Marcus', follow_up_on: '2026-10-26', outcome_at: '2026-10-15T16:00:00.000Z' })
const waitingLate = paper({ id: 'x', title: 'The carrier', came_on: '2026-10-01', state: 'waiting', outcome: 'waiting', outcome_detail: 'the carrier', follow_up_on: '2026-10-21', outcome_at: '2026-10-01T16:00:00.000Z' })
const parked = paper({ id: 's', title: 'A catalog', came_on: '2026-09-01', state: 'someday', outcome: 'someday', outcome_at: '2026-09-02T16:00:00.000Z' })
const filedToday = paper({ id: 'f', title: 'A green card', came_on: '2026-10-23', state: 'closed', outcome: 'filed', outcome_detail: 'The Lien desk, the letter', outcome_at: '2026-10-24T14:00:00.000Z' })
const taskToday = paper({ id: 't', title: 'Renew the F-250', came_on: '2026-10-21', state: 'closed', outcome: 'task', outcome_at: '2026-10-24T14:10:00.000Z', checklist_item_id: 'ci1' })
const taskYesterday = paper({ id: 'y', title: 'An old task', came_on: '2026-10-20', state: 'closed', outcome: 'task', outcome_at: '2026-10-23T14:10:00.000Z' })

const all = [letter, cards, phones, mail, sameDayLater, waitingMarcus, waitingLate, parked, filedToday, taskToday, taskYesterday]

const dayKeyOf = (iso: string) => iso.slice(0, 10)

describe('normalizePaperTitle', () => {
  it('trims, collapses spaces and caps, and refuses an empty title', () => {
    expect(normalizePaperTitle('  toll   bill, NTTA  ')).toBe('toll bill, NTTA')
    expect(normalizePaperTitle('   ')).toBeNull()
    expect(normalizePaperTitle(null)).toBeNull()
    expect(normalizePaperTitle('x'.repeat(250))!.length).toBe(200)
  })
})

describe('deckRows', () => {
  it('lists only the open papers, oldest first, with an age and a colour', () => {
    const rows = deckRows(all, TODAY)
    expect(rows.map((r) => r.paper.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(rows[0]!.ageDays).toBe(66)
    expect(rows[0]!.ageState).toBe('red')
    expect(rows[0]!.ageWords).toBe('66 d · Aug 19')
    expect(rows[1]!.ageDays).toBe(5)
    expect(rows[1]!.ageState).toBe('amber')
    expect(rows[3]!.ageDays).toBe(0)
    expect(rows[3]!.ageState).toBe('fresh')
    expect(rows[3]!.ageWords).toBe('today')
  })

  it('turns amber on the second day and red on the seventh', () => {
    const one = paper({ id: '1', title: 'one', came_on: '2026-10-23' })
    const two = paper({ id: '2', title: 'two', came_on: '2026-10-22' })
    const seven = paper({ id: '7', title: 'seven', came_on: '2026-10-17' })
    expect(deckRows([one, two, seven], TODAY).map((r) => r.ageState)).toEqual(['red', 'amber', 'fresh'])
  })
})

describe('undecidedSummary and its words', () => {
  it('counts the open papers and the oldest age', () => {
    const s = undecidedSummary(all, TODAY)
    expect(s).toEqual({ count: 5, oldestDays: 66 })
    expect(undecidedWords(s)).toBe('5 undecided · oldest 66 d')
    expect(lookedButtonWords(s)).toBe('Looked · 5 undecided · next →')
  })

  it('reads clear when nothing is open, and today when the oldest came today', () => {
    const none = undecidedSummary([parked, filedToday], TODAY)
    expect(none).toEqual({ count: 0, oldestDays: null })
    expect(undecidedWords(none)).toBe('Nothing undecided')
    expect(lookedButtonWords(none)).toBe('Looked · tray clear · next →')
    expect(undecidedWords(undecidedSummary([letter], TODAY))).toBe('1 undecided · oldest today')
  })
})

describe('waitingRows', () => {
  it('names whom and when to check, soonest first, the late one on top', () => {
    const rows = waitingRows(all, TODAY)
    expect(rows.map((r) => r.paper.id)).toEqual(['x', 'w'])
    expect(rows[0]!.words).toBe('waiting for the carrier · 3 d past the check')
    expect(rows[0]!.late).toBe(true)
    expect(rows[1]!.words).toBe('waiting for Marcus · check Mon')
    expect(rows[1]!.late).toBe(false)
  })

  it('reads check today, a far day by its date, and no day when none was set', () => {
    const today = { ...waitingMarcus, id: 'w1', follow_up_on: TODAY }
    const far = { ...waitingMarcus, id: 'w2', follow_up_on: '2026-11-20' }
    const none = { ...waitingMarcus, id: 'w3', follow_up_on: null, outcome_detail: '' }
    const rows = waitingRows([far, none, today], TODAY)
    expect(rows.map((r) => r.words)).toEqual(['waiting for Marcus · check today', 'waiting for Marcus · check Nov 20', 'waiting for someone · no day to check'])
  })
})

describe('somedayRows', () => {
  it('lists the parked papers, newest park first', () => {
    const older = { ...parked, id: 's0', outcome_at: '2026-08-01T00:00:00.000Z' }
    expect(somedayRows([older, parked, letter]).map((p) => p.id)).toEqual(['s', 's0'])
  })
})

describe('decidedCounts and markAutoNote', () => {
  it('counts the presses that landed today by the app day, not yesterday', () => {
    const d = decidedCounts(all, TODAY, dayKeyOf)
    expect(d.task).toBe(1)
    expect(d.filed).toBe(1)
    expect(d.waiting).toBe(0)
    expect(d.someday).toBe(0)
  })

  it('writes the mark note with the count, the oldest age and the day', () => {
    const d = decidedCounts(all, TODAY, dayKeyOf)
    expect(markAutoNote(undecidedSummary(all, TODAY), d)).toBe('5 undecided · oldest 66 d · 1 task · 1 filed')
    expect(markAutoNote({ count: 0, oldestDays: null }, d)).toBe('0 undecided · 1 task · 1 filed')
    expect(markAutoNote({ count: 2, oldestDays: 0 }, { ...d, task: 2, routine: 1, trash: 1 })).toBe('2 undecided · oldest today · 2 tasks · 1 filed · 1 tossed · 1 routine')
  })
})

describe('pressPatch, BACK_ON_DECK_PATCH and outcomeWords', () => {
  const NOW = '2026-10-24T15:30:00.000Z'
  it('closes a paper on Done, Trash, File it, Task, Ask and Comes back', () => {
    expect(pressPatch('done', null, null, NOW, 'u1')).toEqual({ state: 'closed', outcome: 'done', outcome_detail: null, follow_up_on: null, outcome_at: NOW, outcome_by: 'u1' })
    expect(pressPatch('filed', '  The cabinet ', null, NOW, 'u1').outcome_detail).toBe('The cabinet')
    expect(pressPatch('routine', null, null, NOW, 'u1').state).toBe('closed')
  })
  it('keeps a Waiting for paper with whom and the check day, and a Someday paper parked', () => {
    expect(pressPatch('waiting', 'Marcus', '2026-10-26', NOW, 'u1')).toEqual({ state: 'waiting', outcome: 'waiting', outcome_detail: 'Marcus', follow_up_on: '2026-10-26', outcome_at: NOW, outcome_by: 'u1' })
    expect(pressPatch('someday', null, '2026-10-26', NOW, 'u1')).toEqual({ state: 'someday', outcome: 'someday', outcome_detail: null, follow_up_on: null, outcome_at: NOW, outcome_by: 'u1' })
    expect(BACK_ON_DECK_PATCH.state).toBe('open')
    expect(BACK_ON_DECK_PATCH.outcome).toBeNull()
  })
  it('words each outcome for the line it leaves behind', () => {
    expect(outcomeWords('filed', 'The Lien desk, the letter')).toBe('Filed · The Lien desk, the letter')
    expect(outcomeWords('filed', '')).toBe('Filed')
    expect(outcomeWords('request', 'dispatch')).toBe('Asked dispatch')
    expect(outcomeWords('waiting', 'Marcus')).toBe('Waiting for Marcus')
    expect(outcomeWords('trash', null)).toBe('Tossed')
    expect(outcomeWords('routine', null)).toBe('Routine made')
  })
})

describe('ymdAddDays', () => {
  it('adds whole days on the calendar and leaves a bad day alone', () => {
    expect(ymdAddDays('2026-10-24', WAITING_DEFAULT_DAYS)).toBe('2026-10-31')
    expect(ymdAddDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(ymdAddDays('nope', 3)).toBe('nope')
  })
})

describe('paperAgeWords and shortDay', () => {
  it('reads today, then days with the day it came', () => {
    expect(paperAgeWords(0, '2026-10-24')).toBe('today')
    expect(paperAgeWords(1, '2026-10-23')).toBe('1 d · Oct 23')
    expect(shortDay('2026-01-05')).toBe('Jan 5')
    expect(shortDay('not a day')).toBe('not a day')
    expect(shortDay(null)).toBe('')
  })
})
