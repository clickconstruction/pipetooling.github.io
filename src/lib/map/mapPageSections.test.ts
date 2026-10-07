import { describe, expect, it } from 'vitest'
import {
  MAP_PAGE_DEFAULT_JOB_SECTIONS,
  mapPageBidDueTone,
  mapPageJobSection,
  mapPageLegendCounts,
  readMapPageClustered,
  writeMapPageClustered,
} from './mapPageSections'

describe('mapPageJobSection', () => {
  it('maps the ledger status to the Pipeline section and nothing else', () => {
    expect(mapPageJobSection('waiting')).toBe('waiting')
    expect(mapPageJobSection('Ready_To_Bill ')).toBe('readyToBill')
    expect(mapPageJobSection('paid')).toBe('paid')
    expect(mapPageJobSection('archived')).toBeNull()
    expect(mapPageJobSection(null)).toBeNull()
  })
})

describe('mapPageBidDueTone', () => {
  const today = new Date('2026-10-07T12:00:00')
  it('rings an unsent bid that is overdue or due soon, never a sent or decided one', () => {
    expect(mapPageBidDueTone('2026-10-01', null, null, today)).toBe('overdue')
    expect(mapPageBidDueTone('2026-10-09', null, null, today)).toBe('soon')
    expect(mapPageBidDueTone('2026-11-20', null, null, today)).toBeNull()
    expect(mapPageBidDueTone('2026-10-01', null, '2026-09-30', today)).toBeNull()
    expect(mapPageBidDueTone('2026-10-01', 'won', null, today)).toBeNull()
    expect(mapPageBidDueTone(null, null, null, today)).toBeNull()
  })
})

describe('mapPageLegendCounts', () => {
  it('counts by section, Collections beside Billed, and skips what has no section', () => {
    const c = mapPageLegendCounts([
      { kind: 'job', jobSection: 'working' },
      { kind: 'job', jobSection: 'billed', inCollections: true },
      { kind: 'job', jobSection: 'billed' },
      { kind: 'job', jobSection: null },
      { kind: 'bid', bidSection: 'won' },
      { kind: 'bid' },
      { kind: 'estimate' },
      { kind: 'estimate' },
    ])
    expect(c.jobs).toEqual({ waiting: 0, working: 1, readyToBill: 0, billed: 2, paid: 0 })
    expect(c.collections).toBe(1)
    expect(c.bids.won).toBe(1)
    expect(c.estimates).toBe(2)
  })

  it('starts with Paid off', () => {
    expect(MAP_PAGE_DEFAULT_JOB_SECTIONS.paid).toBe(false)
    expect(MAP_PAGE_DEFAULT_JOB_SECTIONS.working).toBe(true)
  })
})

describe('the Cluster preference', () => {
  it('reads what was written and survives a broken storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
    expect(readMapPageClustered(storage)).toBe(false)
    writeMapPageClustered(true, storage)
    expect(readMapPageClustered(storage)).toBe(true)
    writeMapPageClustered(false, storage)
    expect(readMapPageClustered(storage)).toBe(false)
    expect(readMapPageClustered({ getItem: () => { throw new Error('no') } })).toBe(false)
  })
})
