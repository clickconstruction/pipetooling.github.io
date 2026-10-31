import { describe, expect, it } from 'vitest'
import { domainOf, leftOutSenders, NOTICE_LINES, type LeftOutSenderRow } from './leftOutSenders'

// Made-up rows: nothing here is a real sender.
const ROWS: LeftOutSenderRow[] = [
  { value: 'news@alamosurety.example', kind: 'address', mailbox: null },
  { value: 'hillcountrysupply.example', kind: 'domain', mailbox: null },
  { value: 'Deals@BuildLink.example', kind: 'address', mailbox: 'team' },
]

describe('leftOutSenders: the senders the office marked a notice (punch list #223 PR 1)', () => {
  const bids = leftOutSenders(ROWS, 'bids')
  const team = leftOutSenders(ROWS, 'team')

  it('matches an address in any case, and nobody else at its company', () => {
    expect(bids('News@AlamoSurety.example')).toEqual({ value: 'news@alamosurety.example', kind: 'address' })
    expect(bids('rosa@alamosurety.example')).toBeNull()
  })

  it('matches a marked domain, an address under it, and nothing beside it', () => {
    expect(bids('specials@hillcountrysupply.example')).toEqual({ value: 'hillcountrysupply.example', kind: 'domain' })
    expect(bids('specials@mail.hillcountrysupply.example')).toEqual({ value: 'hillcountrysupply.example', kind: 'domain' })
    expect(bids('specials@hillcountrysupply.example.evil.example')).toBeNull()
    expect(bids('specials@nothillcountrysupply.example')).toBeNull()
  })

  it('holds a row for one box to that box, and a row for both to both', () => {
    expect(team('deals@buildlink.example')).toEqual({ value: 'Deals@BuildLink.example', kind: 'address' })
    expect(bids('deals@buildlink.example')).toBeNull()
    expect(team('news@alamosurety.example')).not.toBeNull()
  })

  it('answers null for nothing, and with no rows', () => {
    expect(bids('')).toBeNull()
    expect(leftOutSenders([], 'bids')('news@alamosurety.example')).toBeNull()
  })

  it('reads a domain from an address', () => {
    expect(domainOf('News@Mail.Example.com')).toBe('mail.example.com')
    expect(domainOf('no address')).toBe('')
  })

  it('writes the event lines the thread shows', () => {
    expect(NOTICE_LINES.marked('news@alamosurety.example', 'address')).toBe('Marked a notice: news@alamosurety.example.')
    expect(NOTICE_LINES.marked('alamosurety.example', 'domain')).toBe('Marked a notice: everything from alamosurety.example.')
    expect(NOTICE_LINES.unmarked).toBe('Not a notice after all.')
  })
})
