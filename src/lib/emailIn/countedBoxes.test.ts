import { describe, expect, it } from 'vitest'
import { cleanLabels, countedBoxes, DEFAULT_LABELS, findLabel, type WatchRow } from './countedBoxes'

// Made-up rows: what `email_box_watch` would hold.
const row = (over: Partial<WatchRow> & { id: string; address: string }): WatchRow => ({ user_id: null, labels: null, is_on: true, ...over })

describe('cleanLabels: the labels a row counts', () => {
  it('fills the default three for an empty or missing list', () => {
    expect(cleanLabels(null)).toEqual([...DEFAULT_LABELS])
    expect(cleanLabels([])).toEqual([...DEFAULT_LABELS])
    expect(cleanLabels(['', '  '])).toEqual([...DEFAULT_LABELS])
  })

  it('trims, keeps each label once case-blind with the first spelling, and spells the Inbox one way', () => {
    expect(cleanLabels([' Follow Up ', 'follow up', 'INBOX', 'Next Actions', 'inbox'])).toEqual(['Follow Up', 'Inbox', 'Next Actions'])
  })
})

describe('countedBoxes: the boxes the sweep counts', () => {
  it('lists the shared boxes first, then the people, each with its words and clean labels', () => {
    const rows: WatchRow[] = [
      row({ id: 'p1', user_id: 'u-marisol', address: 'marisol@clickplumbing.example', labels: ['Inbox', 'Follow Up'] }),
      row({ id: 's1', address: 'bids@clickconstruction.example' }),
      row({ id: 's2', address: 'Work@ClickPlumbing.example ', labels: ['Inbox', 'next actions', 'Next Actions'] }),
    ]
    expect(countedBoxes(rows)).toEqual([
      { watchId: 's1', kind: 'shared', userId: null, address: 'bids@clickconstruction.example', words: 'bids@', labels: [...DEFAULT_LABELS] },
      { watchId: 's2', kind: 'shared', userId: null, address: 'work@clickplumbing.example', words: 'work@', labels: ['Inbox', 'next actions'] },
      { watchId: 'p1', kind: 'person', userId: 'u-marisol', address: 'marisol@clickplumbing.example', words: 'marisol@', labels: ['Inbox', 'Follow Up'] },
    ])
  })

  it('leaves out a row that is off, one with no address, and a second row on the same address', () => {
    const rows: WatchRow[] = [
      row({ id: 'off', address: 'bids@clickconstruction.example', is_on: false }),
      row({ id: 'bad', address: 'bids' }),
      row({ id: 'a', address: 'work@clickplumbing.example' }),
      row({ id: 'b', user_id: 'u-dale', address: 'WORK@clickplumbing.example' }),
    ]
    expect(countedBoxes(rows).map((b) => b.watchId)).toEqual(['a'])
    expect(countedBoxes([])).toEqual([])
  })
})

describe('findLabel: a named label in Gmail', () => {
  const labels = [
    { id: 'INBOX', name: 'INBOX' },
    { id: 'Label_7', name: 'Follow Up' },
    { id: 'Label_9', name: 'follow up' },
    { id: 'Label_3', name: 'next actions' },
  ]

  it('finds the Inbox by its system id whatever the spelling, even when the list leaves it out', () => {
    expect(findLabel('inbox', labels)).toEqual({ id: 'INBOX', name: 'INBOX' })
    expect(findLabel('Inbox', [])).toEqual({ id: 'INBOX', name: 'Inbox' })
  })

  it('takes the exact name first, then a case-blind match, and null when the box has none', () => {
    expect(findLabel('Follow Up', labels)?.id).toBe('Label_7')
    expect(findLabel('Next Actions', labels)?.id).toBe('Label_3')
    expect(findLabel('Waiting', labels)).toBeNull()
  })
})
