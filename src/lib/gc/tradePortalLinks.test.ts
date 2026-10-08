/** A company's portal link in its window, *Their portal* (P1b-ii-b): where it stands, from its rows and its outside visits. */
import { describe, expect, it } from 'vitest'
import { tradeLinkStatus, tradeLinkVisits, type TradeLinkRow } from './tradePortalLinks'

const row = (company_id: string, created_at: string, revoked_at: string | null, token: string | null = `tok-${created_at}`): TradeLinkRow => ({ company_id, token, created_at, revoked_at })

describe('a company’s link', () => {
  it('has none until a dev makes one', () => {
    expect(tradeLinkStatus([], 'c1', null)).toEqual({ state: 'none', word: 'no link yet', words: 'Make the link, then send it with the ask to quote.', token: null })
  })

  it('reads turned off when its last link was', () => {
    const s = tradeLinkStatus([row('c1', '2026-10-01T10:00:00Z', '2026-10-05T09:00:00Z')], 'c1', null)
    expect([s.state, s.words, s.token]).toEqual(['off', 'Its link was turned off Oct 5. Make a new link to send it one.', null])
  })

  it('waits until they open the link that is on, then says how often and when', () => {
    const rows = [row('c1', '2026-10-01T10:00:00Z', '2026-10-03T09:00:00Z'), row('c1', '2026-10-03T09:00:00Z', null), row('c2', '2026-10-02T09:00:00Z', null)]
    expect(tradeLinkStatus(rows, 'c1', null)).toEqual({ state: 'waiting', word: 'not opened yet', words: 'Made Oct 3. They have not opened it yet.', token: 'tok-2026-10-03T09:00:00Z' })
    const visits = tradeLinkVisits(
      [
        { entity_id: 'c1', occurred_at: '2026-10-02T12:00:00Z' },
        { entity_id: 'c1', occurred_at: '2026-10-04T12:00:00Z' },
        { entity_id: 'c1', occurred_at: '2026-10-06T12:00:00Z' },
        { entity_id: 'c2', occurred_at: '2026-10-05T12:00:00Z' },
        { entity_id: null, occurred_at: '2026-10-05T12:00:00Z' },
      ],
      rows,
    )
    // The visit on Oct 2 was to the link turned off since.
    expect(visits).toEqual({ c1: { opens: 2, lastAt: '2026-10-06T12:00:00Z' }, c2: { opens: 1, lastAt: '2026-10-05T12:00:00Z' } })
    expect(tradeLinkStatus(rows, 'c1', visits.c1 ?? null).words).toBe('Opened 2 times, last Oct 6.')
    expect(tradeLinkStatus(rows, 'c2', visits.c2 ?? null)).toMatchObject({ state: 'active', word: 'active', words: 'Opened once, last Oct 5.' })
  })

  it('dates a visit by the office’s day, so an evening in Central time is not the next day', () => {
    const rows = [row('c1', '2026-10-07T15:00:00Z', null)]
    const visits = tradeLinkVisits([{ entity_id: 'c1', occurred_at: '2026-10-08T03:30:00Z' }], rows)
    expect(tradeLinkStatus(rows, 'c1', visits.c1 ?? null).words).toBe('Opened once, last Oct 7.')
  })
})
