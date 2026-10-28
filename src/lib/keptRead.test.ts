import { describe, expect, it } from 'vitest'
import {
  COULD_NOT_READ_AGAIN_WORDS,
  KEPT_READ_MAX_AGE_MS,
  KEPT_READ_SCHEMA,
  READING_AGAIN_WORDS,
  buildKeptRead,
  buildKeptReadKey,
  createKeptReadOnScreenStore,
  describeKeptReadAge,
  formatKeptReadTime,
  keptReadIsUsable,
  keptReadStampWords,
  parseKeptRead,
} from './keptRead'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/**
 * The kept read's rules (#183 PR 2, v2.6031). The first describe blocks are the Pipeline's board
 * tests (v2.3610, `boardSnapshot.test.ts`) moved onto the lifted names; the rest are what the lift
 * added: the key, the schema number, the clock time, the stamp's words and the on-screen registry.
 */

const row = (id: string, status = 'working') => ({ id, status })

const kept = () => ({
  key: 'u1:pipeline:all',
  schema: KEPT_READ_SCHEMA,
  scopes: ['waiting', 'working', 'ready_to_bill', 'billed_all'],
  readAt: 1_000_000,
  rows: [row('a'), row('b')],
})

describe('buildKeptReadKey', () => {
  it('is the user, the page and the scope, with an empty scope reading all', () => {
    expect(buildKeptReadKey('u1', 'pipeline', null)).toBe('u1:pipeline:all')
    expect(buildKeptReadKey('u1', 'pipeline', '  ')).toBe('u1:pipeline:all')
    expect(buildKeptReadKey('u1', 'pipeline', 'cust-9')).toBe('u1:pipeline:cust-9')
    expect(buildKeptReadKey('u1', 'my-schedule', '2026-10-28')).toBe('u1:my-schedule:2026-10-28')
    expect(buildKeptReadKey('u2', 'pipeline', null)).not.toBe(buildKeptReadKey('u1', 'pipeline', null))
  })
})

describe('keptReadIsUsable', () => {
  it('shows a same-key read younger than the line that covers every wanted scope', () => {
    expect(KEPT_READ_MAX_AGE_MS).toBe(86_400_000)
    expect(
      keptReadIsUsable({
        kept: kept(),
        key: 'u1:pipeline:all',
        wantedScopes: ['ready_to_bill', 'working'],
        now: 1_000_000 + 6 * 3_600_000,
      }),
    ).toBe(true)
  })
  it('refuses another key, a missing scope, a read on or over the line, or one from the future', () => {
    const s = kept()
    const ok = { kept: s, key: 'u1:pipeline:all', wantedScopes: ['working'] as const, now: 1_500_000 }
    expect(keptReadIsUsable({ ...ok, key: 'u1:pipeline:cust-9' })).toBe(false)
    expect(keptReadIsUsable({ ...ok, kept: { ...s, scopes: ['working'] }, wantedScopes: ['ready_to_bill'] })).toBe(false)
    expect(keptReadIsUsable({ ...ok, now: 1_000_000 + KEPT_READ_MAX_AGE_MS })).toBe(false)
    expect(keptReadIsUsable({ ...ok, now: 1_000_000 + KEPT_READ_MAX_AGE_MS - 1 })).toBe(true)
    expect(keptReadIsUsable({ ...ok, now: 999_999 })).toBe(false)
    expect(keptReadIsUsable({ ...ok, kept: null })).toBe(false)
    expect(keptReadIsUsable({ ...ok, maxAgeMs: 1_000 })).toBe(false)
  })
  it('refuses a read kept under another schema number', () => {
    expect(keptReadIsUsable({ kept: { ...kept(), schema: KEPT_READ_SCHEMA + 1 }, key: 'u1:pipeline:all', wantedScopes: [], now: 1_500_000 })).toBe(false)
  })
  it('wants nothing when the page has no scopes', () => {
    expect(keptReadIsUsable({ kept: { ...kept(), scopes: [] }, key: 'u1:pipeline:all', wantedScopes: [], now: 1_500_000 })).toBe(true)
  })
})

describe('buildKeptRead', () => {
  it('stamps the rows with the schema of today and the time of the read, copying both arrays', () => {
    const scopes = ['working']
    const rows = [row('a')]
    const built = buildKeptRead({ key: 'u1:pipeline:all', scopes, rows, now: 42 })
    expect(built).toEqual({ key: 'u1:pipeline:all', schema: KEPT_READ_SCHEMA, scopes: ['working'], readAt: 42, rows: [row('a')] })
    expect(built.scopes).not.toBe(scopes)
    expect(built.rows).not.toBe(rows)
  })
})

describe('parseKeptRead', () => {
  it('accepts the stored shape and rejects anything off', () => {
    expect(parseKeptRead(kept())).toEqual(kept())
    expect(parseKeptRead(null)).toBeNull()
    expect(parseKeptRead('rows')).toBeNull()
    expect(parseKeptRead({ ...kept(), key: '' })).toBeNull()
    expect(parseKeptRead({ ...kept(), schema: undefined })).toBeNull()
    expect(parseKeptRead({ ...kept(), schema: KEPT_READ_SCHEMA + 1 })).toBeNull()
    expect(parseKeptRead({ ...kept(), readAt: 'yesterday' })).toBeNull()
    expect(parseKeptRead({ ...kept(), scopes: [3] })).toBeNull()
    expect(parseKeptRead({ ...kept(), rows: 'rows' })).toBeNull()
    expect(parseKeptRead({ ...kept(), rows: [null] })).toBeNull()
  })
  it('holds each row to the page’s own check', () => {
    const hasId = (r: unknown) => typeof (r as { id?: unknown })?.id === 'string'
    expect(parseKeptRead(kept(), hasId)).toEqual(kept())
    expect(parseKeptRead({ ...kept(), rows: [{ noId: true }] }, hasId)).toBeNull()
  })
})

describe('describeKeptReadAge', () => {
  it('rounds to the unit a person would say', () => {
    expect(describeKeptReadAge(1_000, 1_000 + 20_000)).toBe('just now')
    expect(describeKeptReadAge(1_000, 1_000 + 4 * 60_000)).toBe('4 min ago')
    expect(describeKeptReadAge(1_000, 1_000 + 6 * 3_600_000)).toBe('6 h ago')
    expect(describeKeptReadAge(1_000, 1_000 + 23.4 * 3_600_000)).toBe('23 h ago')
    expect(describeKeptReadAge(1_000, 1_000 + 23.6 * 3_600_000)).toBe('yesterday')
    expect(describeKeptReadAge(5_000, 1_000)).toBe('just now')
  })
})

describe('formatKeptReadTime', () => {
  it('is the clock time a person says, in the zone asked for', () => {
    // 2026-10-28T12:52:00Z is 7:52 AM in Chicago that week.
    const t = Date.UTC(2026, 9, 28, 12, 52)
    expect(formatKeptReadTime(t, { timeZone: APP_CALENDAR_TZ })).toBe('7:52 AM')
    expect(formatKeptReadTime(t, { timeZone: 'UTC' })).toBe('12:52 PM')
    expect(formatKeptReadTime(Date.UTC(2026, 9, 28, 0, 5), { timeZone: 'UTC' })).toBe('12:05 AM')
  })
})

describe('keptReadStampWords', () => {
  const t = Date.UTC(2026, 9, 28, 12, 52)
  const format = { timeZone: APP_CALENDAR_TZ }
  it('reads the lead, the time and reading again while the live read runs', () => {
    expect(keptReadStampWords({ readAt: t, failed: false, format })).toEqual({
      stamp: 'Read at 7:52 AM',
      state: READING_AGAIN_WORDS,
      retry: false,
      text: 'Read at 7:52 AM · reading again…',
    })
  })
  it('reads could not read again with Retry once the live read failed', () => {
    expect(keptReadStampWords({ readAt: t, failed: true, format })).toEqual({
      stamp: 'Read at 7:52 AM',
      state: COULD_NOT_READ_AGAIN_WORDS,
      retry: true,
      text: 'Read at 7:52 AM · could not read again · Retry',
    })
  })
  it('takes the page’s own lead', () => {
    expect(keptReadStampWords({ readAt: t, lead: 'Counts from', failed: false, format }).text).toBe('Counts from 7:52 AM · counting again…'.replace('counting again…', READING_AGAIN_WORDS))
    expect(keptReadStampWords({ readAt: t, lead: 'Your day as read at', failed: false, format }).stamp).toBe('Your day as read at 7:52 AM')
  })
})

describe('the on-screen registry', () => {
  it('reads the earliest stamp on screen, tells its listeners on every change, and goes quiet when the page is live', () => {
    const store = createKeptReadOnScreenStore()
    let told = 0
    const off = store.subscribe(() => {
      told += 1
    })
    expect(store.read()).toBeNull()
    store.show('board', 1_000)
    expect(store.read()).toBe(1_000)
    store.show('card', 500)
    expect(store.read()).toBe(500)
    store.show('card', 500)
    expect(told).toBe(2)
    store.hide('card')
    expect(store.read()).toBe(1_000)
    store.hide('card')
    expect(told).toBe(3)
    store.hide('board')
    expect(store.read()).toBeNull()
    off()
    store.show('board', 2_000)
    expect(told).toBe(4)
  })
})
