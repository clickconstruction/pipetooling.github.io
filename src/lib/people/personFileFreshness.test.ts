import { describe, expect, it } from 'vitest'
import { derivePersonFileFreshness } from './personFileFreshness'

const NOW = '2026-08-23T12:00:00.000Z'

describe('derivePersonFileFreshness', () => {
  it('no summary and no entries → empty', () => {
    expect(
      derivePersonFileFreshness({ summaryUpdatedAt: null, entryCreatedAts: [], nowIso: NOW }),
    ).toEqual({ state: 'empty', staleDays: 0, entryCount: 0, coveredCount: 0 })
  })

  it('summary newer than every entry → current, all covered', () => {
    const r = derivePersonFileFreshness({
      summaryUpdatedAt: '2026-08-19T00:00:00.000Z',
      entryCreatedAts: ['2026-08-01T00:00:00.000Z', '2026-08-18T23:59:00.000Z'],
      nowIso: NOW,
    })
    expect(r).toEqual({ state: 'current', staleDays: 0, entryCount: 2, coveredCount: 2 })
  })

  it('summary with zero entries → current (nothing to fold in)', () => {
    const r = derivePersonFileFreshness({
      summaryUpdatedAt: '2026-08-19T00:00:00.000Z',
      entryCreatedAts: [],
      nowIso: NOW,
    })
    expect(r).toEqual({ state: 'current', staleDays: 0, entryCount: 0, coveredCount: 0 })
  })

  it('entries newer than the summary → stale, aged from the OLDEST uncovered entry', () => {
    const r = derivePersonFileFreshness({
      summaryUpdatedAt: '2026-07-01T00:00:00.000Z',
      entryCreatedAts: [
        '2026-06-20T00:00:00.000Z', // covered
        '2026-07-12T12:00:00.000Z', // uncovered, 42 days before NOW
        '2026-08-20T00:00:00.000Z', // uncovered, newer — must not shrink staleDays
      ],
      nowIso: NOW,
    })
    expect(r.state).toBe('stale')
    expect(r.staleDays).toBe(42)
    expect(r.entryCount).toBe(3)
    expect(r.coveredCount).toBe(1)
  })

  it('entries but no summary yet → stale with zero covered', () => {
    const r = derivePersonFileFreshness({
      summaryUpdatedAt: null,
      entryCreatedAts: ['2026-08-13T12:00:00.000Z'],
      nowIso: NOW,
    })
    expect(r).toEqual({ state: 'stale', staleDays: 10, entryCount: 1, coveredCount: 0 })
  })

  it('an entry stamped exactly at the summary rewrite counts as covered', () => {
    const t = '2026-08-19T00:00:00.000Z'
    const r = derivePersonFileFreshness({ summaryUpdatedAt: t, entryCreatedAts: [t], nowIso: NOW })
    expect(r).toEqual({ state: 'current', staleDays: 0, entryCount: 1, coveredCount: 1 })
  })

  it('unparseable entry timestamps are ignored rather than poisoning the result', () => {
    const r = derivePersonFileFreshness({
      summaryUpdatedAt: '2026-08-19T00:00:00.000Z',
      entryCreatedAts: ['not-a-date'],
      nowIso: NOW,
    })
    expect(r).toEqual({ state: 'current', staleDays: 0, entryCount: 0, coveredCount: 0 })
  })
})
