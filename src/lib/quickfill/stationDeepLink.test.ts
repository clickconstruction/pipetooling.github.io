import { describe, expect, it } from 'vitest'
import {
  parseQuickfillStationRequest,
  quickfillStationHref,
  quickfillStationTelemetryTarget,
  resolveQuickfillStation,
} from './stationDeepLink'

const STATIONS = [
  { id: 'quickfill-warnings', sectionId: 'warnings' },
  { id: 'quickfill-dispatch-inbox', sectionId: 'dispatch-inbox' },
  { id: 'quickfill-banking-sorting', sectionId: 'banking-sorting' },
  { id: 'quickfill-prospects', sectionId: 'prospects' },
] as const

const allOnPage = () => true
const hiddenBanking = (id: string) => id !== 'banking-sorting'

describe('parseQuickfillStationRequest', () => {
  it('reads the hash first, with or without the DOM prefix', () => {
    expect(parseQuickfillStationRequest('#dispatch-inbox', '')).toBe('dispatch-inbox')
    expect(parseQuickfillStationRequest('#quickfill-dispatch-inbox', '')).toBe('dispatch-inbox')
    expect(parseQuickfillStationRequest('dispatch-inbox', '')).toBe('dispatch-inbox')
  })

  it('falls back to ?station= when the hash is empty', () => {
    expect(parseQuickfillStationRequest('', '?station=prospects')).toBe('prospects')
    expect(parseQuickfillStationRequest('', 'station=quickfill-prospects&x=1')).toBe('prospects')
  })

  it('hash wins over ?station=', () => {
    expect(parseQuickfillStationRequest('#warnings', '?station=prospects')).toBe('warnings')
  })

  it('normalizes case, whitespace, and percent-encoding; empty when nothing is asked', () => {
    expect(parseQuickfillStationRequest('#%20Dispatch-Inbox%20', '')).toBe('dispatch-inbox')
    expect(parseQuickfillStationRequest('', '')).toBe('')
    expect(parseQuickfillStationRequest('#', '?')).toBe('')
  })
})

describe('resolveQuickfillStation', () => {
  it('finds a station that renders for this user and names its DOM id', () => {
    expect(resolveQuickfillStation({ hash: '#dispatch-inbox', search: '' }, STATIONS, allOnPage)).toEqual({
      raw: 'dispatch-inbox',
      sectionId: 'dispatch-inbox',
      domId: 'quickfill-dispatch-inbox',
      found: true,
      hidden: false,
    })
  })

  it('fails soft on a real station the org hid or the role cannot see (hidden, not found)', () => {
    const r = resolveQuickfillStation({ hash: '#banking-sorting', search: '' }, STATIONS, hiddenBanking)
    expect(r.found).toBe(false)
    expect(r.hidden).toBe(true)
    expect(r.sectionId).toBe('banking-sorting')
    expect(r.domId).toBeNull()
  })

  it('an unknown id is neither found nor hidden', () => {
    const r = resolveQuickfillStation({ hash: '#not-a-station', search: '' }, STATIONS, allOnPage)
    expect(r).toEqual({ raw: 'not-a-station', sectionId: null, domId: null, found: false, hidden: false })
  })

  it('no request → nothing to do', () => {
    const r = resolveQuickfillStation({ hash: '', search: '?tab=x' }, STATIONS, allOnPage)
    expect(r).toEqual({ raw: '', sectionId: null, domId: null, found: false, hidden: false })
  })

  it('accepts ?station= as the same address', () => {
    const r = resolveQuickfillStation({ hash: '', search: '?station=warnings' }, STATIONS, allOnPage)
    expect(r.found).toBe(true)
    expect(r.domId).toBe('quickfill-warnings')
  })
})

describe('quickfillStationHref / telemetry target', () => {
  it('builds the one address form', () => {
    expect(quickfillStationHref('dispatch-inbox')).toBe('/quickfill#dispatch-inbox')
  })

  it('round-trips through the resolver', () => {
    const href = quickfillStationHref('prospects')
    const hash = href.slice(href.indexOf('#'))
    expect(resolveQuickfillStation({ hash, search: '' }, STATIONS, allOnPage).found).toBe(true)
  })

  it('names the station and the outcome', () => {
    expect(quickfillStationTelemetryTarget(resolveQuickfillStation({ hash: '#warnings', search: '' }, STATIONS, allOnPage))).toBe(
      '#warnings found',
    )
    expect(
      quickfillStationTelemetryTarget(resolveQuickfillStation({ hash: '#banking-sorting', search: '' }, STATIONS, hiddenBanking)),
    ).toBe('#banking-sorting hidden')
    expect(quickfillStationTelemetryTarget(resolveQuickfillStation({ hash: '#zzz', search: '' }, STATIONS, allOnPage))).toBe(
      '#zzz unknown',
    )
  })
})
