import { describe, expect, it } from 'vitest'
import {
  ADDRESS_BAD,
  ADDRESS_TAKEN,
  addressProblem,
  boxHealthWords,
  canSetEmailCount,
  cleanAddress,
  countIsOn,
  labelCountsWords,
  labelsFromText,
  labelsText,
  limitDaysFrom,
  missingLabels,
  myMailWords,
  peopleToAdd,
  splitWatch,
  type CountPerson,
  type WatchView,
} from './countCard'

// Made-up rows and people. The clock is Fri Oct 23, 2026, 9:55 AM in Chicago.
const NOW = '2026-10-23T14:55:00.000Z'
const row = (over: Partial<WatchView> & { id: string; address: string }): WatchView => ({
  user_id: null,
  labels: null,
  is_on: true,
  labels_state: null,
  last_ok_at: null,
  last_error: null,
  created_at: '2026-10-24T13:00:00Z',
  added_by: null,
  ...over,
})
const people: CountPerson[] = [
  { id: 'u-dale', name: 'Dale', email: 'dale@clickplumbing.example' },
  { id: 'u-marisol', name: 'Marisol', email: 'marisol@clickplumbing.example' },
  { id: 'u-none', name: 'No Email', email: null },
]

describe('the rules', () => {
  it('lets the owner and a dev set the list, reads the switch and the limit', () => {
    expect(canSetEmailCount('master_technician')).toBe(true)
    expect(canSetEmailCount('dev')).toBe(true)
    expect(canSetEmailCount('assistant')).toBe(false)
    expect(countIsOn('true')).toBe(true)
    expect(countIsOn('false')).toBe(false)
    expect(limitDaysFrom('5')).toBe(5)
    expect(limitDaysFrom(' 30 ')).toBe(30)
    expect(limitDaysFrom('0')).toBe(3)
    expect(limitDaysFrom('x')).toBe(3)
    expect(limitDaysFrom(null)).toBe(3)
  })

  it('cleans an address and labels typed in a box', () => {
    expect(cleanAddress(' Work@ClickPlumbing.example ')).toBe('work@clickplumbing.example')
    expect(cleanAddress('work')).toBeNull()
    expect(labelsFromText('inbox, Follow Up ,, next actions')).toEqual(['Inbox', 'Follow Up', 'next actions'])
    expect(labelsText(null)).toBe('Inbox, Follow Up, Next Actions')
  })

  it('says why an address cannot be added', () => {
    const rows = [row({ id: 'a', address: 'bids@clickconstruction.example' })]
    expect(addressProblem('bids', rows)).toBe(ADDRESS_BAD)
    expect(addressProblem('BIDS@clickconstruction.example', rows)).toBe(ADDRESS_TAKEN)
    expect(addressProblem('work@clickplumbing.example', rows)).toBeNull()
  })
})

describe('the health words', () => {
  it('reads not counted, counted, stopped, or a missing label', () => {
    expect(boxHealthWords(row({ id: 'a', address: 'a@b.example' }), NOW)).toBe('Not counted yet.')
    const ok = row({ id: 'a', address: 'a@b.example', last_ok_at: '2026-10-23T14:07:00Z' })
    expect(boxHealthWords(ok, NOW)).toBe('Last counted today at 9:07 AM. Nothing wrong.')
    expect(boxHealthWords({ ...ok, last_error: 'Google token exchange failed (401): unauthorized_client' }, NOW)).toBe(
      'Last counted today at 9:07 AM. The last count stopped: Google token exchange failed (401): unauthorized_client',
    )
    const missing = { ...ok, labels: ['Inbox', 'Follow Up', 'Next Actions'], labels_state: { Inbox: { at: NOW, total: 2 }, 'Follow Up': { at: NOW, missing: true }, 'Next Actions': { at: NOW, missing: true } } }
    expect(missingLabels(missing)).toEqual(['Follow Up', 'Next Actions'])
    expect(boxHealthWords(missing, NOW)).toBe('Last counted today at 9:07 AM. No label named Follow Up or Next Actions.')
    expect(labelCountsWords(missing)).toBe('Inbox 2 · Follow Up ? · Next Actions ?')
    expect(labelCountsWords(ok)).toBe('—')
    expect(labelCountsWords({ labels: ['Inbox'], labels_state: { Inbox: { at: NOW, error: 'Gmail 429' } } })).toBe('Inbox !')
  })
})

describe('the list', () => {
  const rows = [
    row({ id: 'p1', user_id: 'u-marisol', address: 'marisol@clickplumbing.example', created_at: '2026-10-24T14:00:00Z' }),
    row({ id: 's2', address: 'work@clickplumbing.example', created_at: '2026-10-24T13:30:00Z' }),
    row({ id: 's1', address: 'bids@clickconstruction.example', created_at: '2026-10-24T13:00:00Z' }),
    row({ id: 'p2', user_id: 'u-gone', address: 'gone@clickplumbing.example', created_at: '2026-10-24T15:00:00Z' }),
  ]

  it('splits the shared boxes from the people, in the order added, each person named', () => {
    const s = splitWatch(rows, people)
    expect(s.shared.map((r) => r.address)).toEqual(['bids@clickconstruction.example', 'work@clickplumbing.example'])
    expect(s.persons.map((r) => r.name)).toEqual(['Marisol', 'gone@clickplumbing.example'])
  })

  it('offers only the office people with an email who are not on the list', () => {
    expect(peopleToAdd(people, rows).map((p) => p.name)).toEqual(['Dale'])
    expect(peopleToAdd(people, [row({ id: 'x', address: 'DALE@clickplumbing.example' })]).map((p) => p.name)).toEqual(['Marisol'])
  })
})

describe('the person’s own words', () => {
  it('says who added them, what is counted, and who sees it', () => {
    expect(myMailWords({ addedBy: 'Robert', addedOn: '2026-10-24T14:00:00Z', limitDays: 3, leadName: 'Dale' })).toEqual({
      intro: 'Robert added you on Oct 24. Quickfill’s Email station counts these labels of yours and lists the threads that sit past 3 days:',
      sees: 'Who sees your rows: you and Dale. Nobody else on the station.',
    })
    expect(myMailWords({ addedBy: null, addedOn: '2026-10-24T14:00:00Z', limitDays: 5, leadName: null })).toEqual({
      intro: 'You were added on Oct 24. Quickfill’s Email station counts these labels of yours and lists the threads that sit past 5 days:',
      sees: 'Who sees your rows: you alone, until the owner names a lead.',
    })
  })
})
