import { describe, expect, it } from 'vitest'
import { DEMO_CONTACTS, DEMO_MESSAGES, DEMO_NOW } from './messagesDemo'
import { inFilter, LIST_FILTERS, listRows, listWhen, type ListFilter } from './listRows'

const ids = (filter: ListFilter, search = '') => listRows(DEMO_CONTACTS, DEMO_MESSAGES, { filter, search, nowIso: DEMO_NOW }).map((r) => r.contact.id)

describe('the Messages list (the prototype’s list)', () => {
  it('puts the newest conversation first, and nothing else moves a row', () => {
    expect(ids('all')).toEqual(['greg', 'jonah', 'elena', 'unk1', 'bill', 'tom', 'marcus', 'priya'])
  })

  it('reads a row’s three lines: who and when, the company and the move, the last line', () => {
    const [greg] = listRows(DEMO_CONTACTS, DEMO_MESSAGES, { filter: 'all', search: '', nowIso: DEMO_NOW })
    expect(greg).toMatchObject({
      when: '11:30 AM',
      sub: 'Hillside Excavation · Sitework',
      court: { side: 'ours', word: 'Our move · 15 min' },
      lastLine: { channel: 'Email', words: 'Hillside sitework, Boerne, rev 1' },
    })
    const rows = Object.fromEntries(listRows(DEMO_CONTACTS, DEMO_MESSAGES, { filter: 'all', search: '', nowIso: DEMO_NOW }).map((r) => [r.contact.id, r]))
    expect(rows.tom).toMatchObject({ when: 'Wed, Sep 30', court: { side: 'theirs' } })
    expect(rows.priya).toMatchObject({ when: 'Sat, Sep 26', lastLine: { channel: 'Note' } })
    expect(rows.elena!.lastLine).toEqual({ channel: 'Missed call', words: 'no voicemail' })
    expect(rows.unk1!.sub).toBe('who is this?')
  })

  it('filters by what they are to us: Trades holds the trade partners and the architects', () => {
    expect(LIST_FILTERS.map((f) => f.label)).toEqual(['All', 'Customers', 'Trades', 'Who is this?'])
    expect(ids('customers')).toEqual(['elena', 'marcus', 'priya'])
    expect(ids('trades')).toEqual(['greg', 'jonah', 'bill', 'tom'])
    expect(ids('unknown')).toEqual(['unk1'])
    expect(inFilter('arch', 'customers')).toBe(false)
  })

  it('searches names, companies, numbers and addresses as given or as digits, and every line’s words', () => {
    expect(ids('all', 'pond')).toEqual(['greg'])
    expect(ids('all', 'CIBOLO')).toEqual(['elena'])
    expect(ids('all', '555-0188')).toEqual(['elena'])
    expect(ids('all', '2105550113')).toEqual(['greg'])
    expect(ids('all', 'start date')).toEqual(['priya'])
    expect(ids('all', 'nothing like this')).toEqual([])
  })

  it('people with no line yet come last, by name', () => {
    const quiet = [
      { ...DEMO_CONTACTS[0]!, id: 'zed', name: 'Zed Quiet' },
      { ...DEMO_CONTACTS[0]!, id: 'amy', name: 'Amy Quiet' },
    ]
    const rows = listRows([...quiet, ...DEMO_CONTACTS], DEMO_MESSAGES, { filter: 'all', search: '', nowIso: DEMO_NOW })
    expect(rows.slice(-2).map((r) => [r.contact.id, r.when, r.lastLine])).toEqual([
      ['amy', '', null],
      ['zed', '', null],
    ])
  })

  it('reads the when as the time today and the day before', () => {
    expect(listWhen('2026-10-02T13:44:00.000Z', DEMO_NOW)).toBe('8:44 AM')
    expect(listWhen('2026-10-01T20:10:00.000Z', DEMO_NOW)).toBe('Thu, Oct 1')
  })
})
