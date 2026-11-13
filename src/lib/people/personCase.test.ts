import { describe, expect, it } from 'vitest'
import {
  caseAddChange,
  caseCloseProblem,
  caseItemCounts,
  caseItemDraftProblem,
  caseItemLabel,
  caseItemNote,
  caseLogNewestFirst,
  caseStandingWords,
  caseWritePayload,
  exhibitBackfillWords,
  exhibitBesideTitle,
  exhibitLabel,
  exhibitNoFromTitle,
  exhibitTitleHasLetter,
  sortCaseItems,
  type ExhibitBackfillReport,
  type PersonCaseItem,
} from './personCase'

/** Made-up rows. */
function item(over: Partial<PersonCaseItem> & Pick<PersonCaseItem, 'item_no'>): PersonCaseItem {
  return { id: `i${over.item_no}`, title: `Item ${over.item_no}`, detail: '', owner_label: '', state: 'open', opened_at: '2026-03-02T15:00:00+00:00', closed_at: null, closed_why: null, author_label: 'Robert', session_label: null, ...over }
}

describe('exhibit numbers (punch list #315)', () => {
  it('labels a record the way the files already do', () => {
    expect(exhibitLabel(41)).toBe('Ev #41')
  })

  it('reads the number a title opens with, in the one form, and never guesses', () => {
    const titles = ['Ev #41 Gate log', 'Ev 41', 'ev. #41: text thread', ' EV#41-photo', 'Ev #41a part two', 'Ev #4100000 x', 'See Ev #41', 'Exhibit 41', '41. Gate log', '']
    expect(titles.map((t) => exhibitNoFromTitle(t))).toEqual([41, 41, 41, 41, null, null, null, null, null, null])
    expect(exhibitNoFromTitle(null)).toBeNull()
    expect(exhibitNoFromTitle(undefined)).toBeNull()
  })

  it('knows a number with a letter, which nobody numbers by rule', () => {
    expect(exhibitTitleHasLetter('Ev #41a part two')).toBe(true)
    expect(exhibitTitleHasLetter('Ev #41 a second part')).toBe(false)
    expect(exhibitTitleHasLetter('Receipt')).toBe(false)
  })

  it('draws the label beside a title that does not already wear the number', () => {
    expect(exhibitBesideTitle({ exhibit_no: 81, title: 'Voicemail from Friday' })).toBe('Ev #81')
    expect(exhibitBesideTitle({ exhibit_no: 41, title: 'Ev #41 Gate log' })).toBeNull()
    expect(exhibitBesideTitle({ exhibit_no: 42, title: 'Ev #41 Gate log' })).toBe('Ev #42')
    expect(exhibitBesideTitle({ exhibit_no: null, title: 'Ev #41 Gate log' })).toBeNull()
  })

  const report = (over: Partial<ExhibitBackfillReport>): ExhibitBackfillReport => ({ dry_run: true, numbered: 0, clashes: [], lettered: [], no_number: [], no_number_numbered: 0, highest: 0, next: 1, still_unnumbered: 0, ...over })
  const rec = { id: 'r1', day: '2026-03-02', title: 'x' }

  it('says the backfill report in sentences, a fact each', () => {
    expect(
      exhibitBackfillWords(report({ numbered: 76, clashes: [{ number: 12, records: [{ ...rec, holds_it: false }, { ...rec, id: 'r2', holds_it: false }] }, { number: 30, records: [] }], lettered: [rec], no_number: [rec, rec, rec], highest: 80, next: 81 })),
    ).toEqual([
      '76 records would take the number the title already wears.',
      '2 numbers are worn by more than one record. Those records are left alone.',
      '1 title wears a number with a letter. It is left alone.',
      '3 titles have no number. They are left alone unless you ask.',
      'The next new record takes Ev #81.',
    ])
  })

  it('speaks in the past once it ran, and counts the ones numbered on request', () => {
    expect(exhibitBackfillWords(report({ dry_run: false, numbered: 1, no_number_numbered: 2, highest: 9, next: 10 }))).toEqual([
      '1 record took the number the title already wears.',
      '2 records with no number in the title took the next numbers.',
      'The next new record takes Ev #10.',
    ])
  })

  it('says nothing when every record has its number', () => {
    expect(exhibitBackfillWords(report({ highest: 12, next: 13 }))).toEqual([])
  })
})

describe("a case's open items and log (punch list #315)", () => {
  const items = [
    item({ item_no: 3 }),
    item({ item_no: 1, state: 'done', closed_at: '2026-03-10T15:00:00+00:00', closed_why: 'The logs are on the file.' }),
    item({ item_no: 22, owner_label: 'a second session' }),
    item({ item_no: 2, state: 'dropped', closed_at: '2026-03-12T15:00:00+00:00', closed_why: 'Not needed.' }),
  ]

  it('reads the open items by number, then the closed, the latest closed first', () => {
    const { open, closed } = sortCaseItems(items)
    expect(open.map((i) => i.item_no)).toEqual([3, 22])
    expect(closed.map((i) => i.item_no)).toEqual([2, 1])
  })

  it('counts them and says the standing', () => {
    expect(caseItemCounts(items)).toEqual({ open: 2, done: 1, dropped: 1 })
    expect(caseStandingWords({ open: 2, done: 1, dropped: 1 })).toBe('2 open, 1 done, 1 dropped')
    expect(caseStandingWords({ open: 0, done: 4, dropped: 0 })).toBe('4 done')
    expect(caseStandingWords({ open: 0, done: 0, dropped: 0 })).toBe('No items yet')
  })

  it('treats a state it does not know as open, so nothing falls off the list', () => {
    expect(caseItemCounts([item({ item_no: 5, state: 'parked' })])).toEqual({ open: 1, done: 0, dropped: 0 })
  })

  it('names an item and says who has it or how it ended', () => {
    expect(caseItemLabel(22)).toBe('Item 22')
    expect(caseItemNote(items[2]!)).toBe('with a second session')
    expect(caseItemNote(items[0]!)).toBe('nobody has it yet')
    expect(caseItemNote(items[1]!)).toBe('done: The logs are on the file.')
    expect(caseItemNote(items[3]!)).toBe('dropped: Not needed.')
  })

  it('reads the log newest first, and keeps the order of lines written at one instant', () => {
    const lines = [
      { id: 'a', logged_at: '2026-03-02T15:00:00+00:00' },
      { id: 'b', logged_at: '2026-03-05T15:00:00+00:00' },
      { id: 'c', logged_at: '2026-03-05T15:00:00+00:00' },
      { id: 'd', logged_at: '2026-03-01T15:00:00+00:00' },
    ]
    expect(caseLogNewestFirst(lines).map((l) => l.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('refuses a new item with no words, too many, or a number that is not one', () => {
    expect(caseItemDraftProblem({ title: 'Pull the gate logs' })).toBeNull()
    expect(caseItemDraftProblem({ title: 'Pull the gate logs', itemNo: '22' })).toBeNull()
    expect(caseItemDraftProblem({ title: '   ' })).toBe('Say what the item is.')
    expect(caseItemDraftProblem({ title: 'x'.repeat(201) })).toBe('Keep the item to 200 characters. The detail takes the rest.')
    expect(caseItemDraftProblem({ title: 'x', itemNo: '0' })).toBe('The number is a whole number from 1. Leave it empty and the file gives the next one.')
    expect(caseItemDraftProblem({ title: 'x', itemNo: '2a' })).toBe('The number is a whole number from 1. Leave it empty and the file gives the next one.')
  })

  it('refuses a close with no reason', () => {
    expect(caseCloseProblem('The logs are on the file.')).toBeNull()
    expect(caseCloseProblem('  ')).toBe('Say why it closes.')
    expect(caseCloseProblem('x'.repeat(501))).toBe('Keep the reason to 500 characters.')
  })

  it("builds the door's payload, and leaves out what was not given", () => {
    expect(caseWritePayload({ personId: 'p1' })).toEqual({ person_id: 'p1' })
    expect(caseWritePayload({ personId: 'p1', session: '  bed session ', items: [caseAddChange({ title: ' Pull the gate logs ', owner: 'me', itemNo: '22' })], log: ['Read the file.'] })).toEqual({
      person_id: 'p1',
      session: 'bed session',
      items: [{ add: { title: 'Pull the gate logs', owner: 'me', item_no: 22 } }],
      log: ['Read the file.'],
    })
    expect(caseAddChange({ title: 'x', detail: ' ', owner: '', itemNo: '' })).toEqual({ add: { title: 'x' } })
  })
})
