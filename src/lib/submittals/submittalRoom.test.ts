import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

import { anonymousOpens, describeHow, describeRoomLine, describeTrail, newRoomToken, parseSubmittalRoomPayload, personTrail, roomLink, describeThreadEntry, parseRoomMessage, summarizeThread, threadOrder } from './submittalRoom'

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
    // 2026-10-03 · a room made by typing an answer in: no link went out, so nothing is "not opened yet".
    expect(describeRoomLine({ status: 'open', shared_at: null, closed_at: null }, 0, TZ)).toBe('Not shared from the app')
    expect(describeRoomLine({ status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null }, 0, TZ)).toBe('Room link · shared Sep 16 · not opened yet')
    // The link copied by hand and opened, with no Share pressed.
    expect(describeRoomLine({ status: 'open', shared_at: null, closed_at: null }, 2, TZ)).toBe('Room link · opened 2×')
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

describe('stage 5a — the thread', () => {
  const tz = APP_CALENDAR_TZ
  const ask = { id: 'm2', at: '2026-09-16T20:10:00Z', authorKind: 'reviewer', authorName: 'Dana Whitfield', body: 'Is the 50 gal ok?', kind: 'message', revNumber: 2, tags: ['DWH-1'] }
  const sys = { id: 'm1', at: '2026-09-16T19:00:00Z', authorKind: 'system', authorName: 'Dana Whitfield', body: 'Dana Whitfield decided 3 rows · 2 revise · 1 reject', kind: 'decision', revNumber: 2, tags: [] }
  const reply = { id: 'm3', at: '2026-09-17T14:00:00Z', authorKind: 'office', authorName: 'Click Plumbing', body: 'Yes — same footprint.', kind: 'reply', revNumber: 2, tags: ['DWH-1'] }

  it('parses an entry defensively and orders the thread oldest first', () => {
    expect(parseRoomMessage(ask)).toEqual(ask)
    expect(parseRoomMessage({ id: 'x', body: '' })).toBeNull()
    expect(parseRoomMessage({ id: 'x', body: 'hi', authorKind: 'alien', kind: 'weird' })).toMatchObject({ authorKind: 'system', kind: 'message', tags: [] })
    expect(threadOrder([reply, ask, sys].map((m) => parseRoomMessage(m)!)).map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('the payload carries the thread and the person\'s hourly count', () => {
    const p = parseSubmittalRoomPayload({ status: 'open', bid: { label: 'B398' }, company: { name: 'Click' }, person: { id: 'p', name: 'Dana', role: 'architect', mayDecide: true, messagesThisHour: 2 }, revisions: [], messages: [reply, ask] })
    expect(p?.messages?.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(p?.person?.messagesThisHour).toBe(2)
    expect(parseSubmittalRoomPayload({ status: 'open', bid: {}, company: {}, revisions: [] })?.messages).toEqual([])
  })

  it('words the name line and the office tab\'s summary', () => {
    expect(describeThreadEntry(parseRoomMessage(ask)!, tz)).toEqual({ who: 'Dana Whitfield', when: 'Sep 16', quiet: false })
    expect(describeThreadEntry(parseRoomMessage(sys)!, tz)).toEqual({ who: null, when: 'Sep 16', quiet: true })
    expect(summarizeThread([], tz)).toBe('No conversation yet')
    expect(summarizeThread([sys, ask].map((m) => parseRoomMessage(m)!), tz)).toBe('2 entries · last: Dana Whitfield asked Sep 16')
    expect(summarizeThread([ask, reply].map((m) => parseRoomMessage(m)!), tz)).toBe('2 entries · last: you answered Sep 17')
    // 2026-10-03 · an answer the office typed in, or the robot read, is not the room deciding.
    const line = (body: string) => ({ id: 'x', at: '2026-10-02T20:00:00Z', authorKind: 'system' as const, authorName: null, body, kind: 'decision' as const, revNumber: 1, tags: [] })
    expect(summarizeThread([line("from structura's file, entered by the office · 1 row · 1 reject")], tz)).toBe('1 entry · last: the office entered their answers Oct 2')
    expect(summarizeThread([line("from Dana Whitfield's file, read by the robot, confirmed by the office · 2 rows · 2 approve")], tz)).toBe('1 entry · last: the robot read their answers Oct 2')
    expect(summarizeThread([line('Dana Whitfield decided 3 rows')], tz)).toBe('1 entry · last: the room decided Oct 2')
  })
})
