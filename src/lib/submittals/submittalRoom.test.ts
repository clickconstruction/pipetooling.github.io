import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

import { anonymousOpens, describeHow, describeRoomLine, describeTrail, newRoomToken, parseSubmittalRoomPayload, personTrail, roomLink } from './submittalRoom'

const TZ = APP_CALENDAR_TZ

describe('the room link', () => {
  it('mints 48 hex characters and builds the page address', () => {
    const t = newRoomToken()
    expect(t).toMatch(/^[0-9a-f]{48}$/)
    expect(newRoomToken()).not.toBe(t)
    expect(roomLink('https://clicktooling.com/', 'abc')).toBe('https://clicktooling.com/submittal?t=abc')
  })
})

describe('the trail', () => {
  const events = [
    { person_id: 'p1', event_type: 'view', occurred_at: '2026-09-16T15:00:00Z', metadata: {} },
    { person_id: 'p1', event_type: 'view', occurred_at: '2026-09-17T15:00:00Z', metadata: {} },
    { person_id: 'p1', event_type: 'reply', occurred_at: '2026-09-17T16:00:00Z', metadata: {} },
    { person_id: null, event_type: 'view', occurred_at: '2026-09-17T17:00:00Z', metadata: {} },
    { person_id: 'p2', event_type: 'view', occurred_at: '2026-09-17T18:00:00Z', metadata: {} },
  ]
  it('counts one person\'s opens, decisions and questions and words them', () => {
    const t = personTrail('p1', events, 22)
    expect(t).toEqual({ opened: 2, lastOpenedAt: '2026-09-17T15:00:00Z', decided: 22, asked: 1 })
    expect(describeTrail(t, TZ)).toBe('opened Sep 17 · 2× · decided 22 · asked 1')
    expect(describeTrail(personTrail('p9', events, 0), TZ)).toBe('not opened yet')
    expect(anonymousOpens(events)).toBe(1)
  })
  it('words how someone arrived and the room line', () => {
    expect(describeHow('named')).toBe('named by you')
    expect(describeHow('identified')).toBe('identified via the room link')
    expect(describeRoomLine({ status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null }, 9, TZ)).toBe('Room link · shared Sep 16 · opened 9×')
    expect(describeRoomLine({ status: 'open', shared_at: null, closed_at: null }, 0, TZ)).toBe('Room link · not opened yet')
    expect(describeRoomLine({ status: 'closed', shared_at: '2026-09-16T15:00:00Z', closed_at: '2026-09-19T15:00:00Z' }, 9, TZ)).toBe('Room closed · Sep 19')
  })
})

describe('parseSubmittalRoomPayload', () => {
  it('accepts the function\'s shape and refuses junk', () => {
    expect(parseSubmittalRoomPayload(null)).toBeNull()
    expect(parseSubmittalRoomPayload({ bid: {} })).toBeNull()
    const p = parseSubmittalRoomPayload({ status: 'open', closedAt: null, bid: { label: 'BP398 ZZ Test', projectName: 'ZZ Test', address: null }, company: { name: 'Click', tagline: '', phone: '' }, person: { id: 'p1', name: 'Dana', role: 'architect', mayDecide: true }, revisions: [{ id: 'r', rev: 2, sharedAt: null, current: true, hasPackage: true, rows: [], counts: { total: 0, matches: 0, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 } }, 'junk'] })
    expect(p?.person).toEqual({ id: 'p1', name: 'Dana', role: 'architect', mayDecide: true })
    expect(p?.revisions).toHaveLength(1)
    expect(p?.revisions[0]?.hasPackage).toBe(true)
  })
})
