// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuilderRow } from './permitBuilders'

/**
 * The Needs you line's count (punch list #307): every city's chip added up, and what the Dashboard
 * does not read twice. Every name and address here is made up.
 */
const siteIo = vi.hoisted(() => ({ loadAllNameAnswers: vi.fn(), loadCustomerNames: vi.fn(), loadRecentBidsWithCustomer: vi.fn(), loadPermitsByHouseNumber: vi.fn() }))
vi.mock('./bidSiteIo', () => siteIo)
const io = vi.hoisted(() => ({ loadBuilders: vi.fn() }))
vi.mock('./permitResearchIo', () => io)

import { countCityLookAlikes, loadLookAlikeNeed, loadLookAlikeShared } from './lookAlikeIo'
import { forgetLookAlikeCounts, readLookAlikeCounts, rememberLookAlikeCount } from './lookAlikeCountMemory'
import { LOOK_ALIKE_COUNT_FRESH_MS } from './lookAlikeWorklist'
import { RESEARCH_CITIES } from './permitResearch'

const builder = (key: string, contact: string): BuilderRow => ({ key, name: null, sample_contact: contact, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 2, open: 0, last_permit_on: '2026-11-01', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null })
const BY_CITY: Record<string, BuilderRow[]> = {
  'San Antonio': [builder('tallpinedevelopmentgroup', 'Tall Pine Development Group LLC'), builder('danawhitlow', 'Dana Whitlow'), builder('copperlinemechanical', 'Copperline Mechanical')],
  Austin: [builder('larkspurdentalpartners', 'Larkspur Dental Partners')],
}
const NOW = 1_800_000_000_000

beforeEach(() => {
  window.localStorage.clear()
  siteIo.loadAllNameAnswers.mockReset().mockResolvedValue({ rows: [], me: 'u1' })
  siteIo.loadCustomerNames.mockReset().mockResolvedValue([{ id: 'c7', name: 'Tall Pine Development' }, { id: 'c8', name: 'Larkspur Dental' }])
  siteIo.loadRecentBidsWithCustomer.mockReset().mockResolvedValue([{ id: 'b1', bid_number: null, project_name: 'Sample Clinic', address: '100 Sample St, San Antonio, TX 78201', outcome: null, bid_date_sent: null, customer_id: 'c7' }])
  siteIo.loadPermitsByHouseNumber.mockReset().mockImplementation(async (city: string) => (city === 'San Antonio' ? [{ id: 'p1', address: '100 SAMPLE ST', builder_key: 'danawhitlow', permit_number: 'COM-1', permit_type: 'Comm New Building Permit', stage: 'issued' }] : []))
  io.loadBuilders.mockReset().mockImplementation(async (city: string) => BY_CITY[city] ?? [])
})
afterEach(() => window.localStorage.clear())

describe('countCityLookAlikes', () => {
  it('counts a city by its Builders read and the permits on addresses bid there', async () => {
    const shared = (await loadLookAlikeShared())!
    // A name that begins the customer's, and the name on a permit at an address bid to it.
    expect(await countCityLookAlikes('San Antonio', shared)).toBe(2)
    expect(siteIo.loadPermitsByHouseNumber).toHaveBeenCalledWith('San Antonio', ['100'])
    expect(await countCityLookAlikes('Austin', shared)).toBe(1)
  })

  it('is none for a city with no builders, with no read of its permits, and has no answer before Builders is on the database', async () => {
    const shared = (await loadLookAlikeShared())!
    siteIo.loadPermitsByHouseNumber.mockClear()
    expect(await countCityLookAlikes('Seguin', shared)).toBe(0)
    expect(siteIo.loadPermitsByHouseNumber).not.toHaveBeenCalled()
    io.loadBuilders.mockResolvedValue(null)
    expect(await countCityLookAlikes('San Antonio', shared)).toBeNull()
  })

  it('leaves out a name a customer has already been answered on', async () => {
    siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [{ id: 'a1', builder_key: 'tallpinedevelopmentgroup', customer_id: 'c7', answer: 'someone_else', scope: null, permit_id: null, name: 'Tall Pine Development Group LLC', answered_by: 'u1', answered_at: '2026-11-10T15:00:00Z' }], me: 'u1' })
    expect(await countCityLookAlikes('San Antonio', (await loadLookAlikeShared())!)).toBe(1)
  })
})

describe('loadLookAlikeNeed', () => {
  it('adds every city’s count, says where, and opens the fullest city', async () => {
    expect(await loadLookAlikeNeed(NOW)).toEqual({ count: 3, byCity: [{ city: 'San Antonio', count: 2 }, { city: 'Austin', count: 1 }], city: 'San Antonio' })
    expect(io.loadBuilders.mock.calls.map((c) => c[0])).toEqual([...RESEARCH_CITIES])
    // What every city stands on is read once, not once a city.
    expect(siteIo.loadAllNameAnswers).toHaveBeenCalledTimes(1)
    expect(siteIo.loadCustomerNames).toHaveBeenCalledTimes(1)
    expect(siteIo.loadRecentBidsWithCustomer).toHaveBeenCalledTimes(1)
  })

  it('opens the city this browser last had on screen when it has some', async () => {
    window.localStorage.setItem('permits.lastCity', 'Austin')
    expect((await loadLookAlikeNeed(NOW))?.city).toBe('Austin')
  })

  it('reads nothing the second time within half an hour, and reads again after it', async () => {
    await loadLookAlikeNeed(NOW)
    io.loadBuilders.mockClear()
    siteIo.loadAllNameAnswers.mockClear()
    siteIo.loadCustomerNames.mockClear()
    expect(await loadLookAlikeNeed(NOW + LOOK_ALIKE_COUNT_FRESH_MS - 1)).toMatchObject({ count: 3 })
    expect(io.loadBuilders).not.toHaveBeenCalled()
    expect(siteIo.loadAllNameAnswers).not.toHaveBeenCalled()
    expect(siteIo.loadCustomerNames).not.toHaveBeenCalled()
    await loadLookAlikeNeed(NOW + LOOK_ALIKE_COUNT_FRESH_MS)
    expect(io.loadBuilders).toHaveBeenCalledTimes(RESEARCH_CITIES.length)
  })

  it('reads only the cities it has no fresh count for', async () => {
    rememberLookAlikeCount('San Antonio', 7, NOW)
    expect(await loadLookAlikeNeed(NOW + 1000)).toEqual({ count: 8, byCity: [{ city: 'San Antonio', count: 7 }, { city: 'Austin', count: 1 }], city: 'San Antonio' })
    expect(io.loadBuilders).not.toHaveBeenCalledWith('San Antonio')
    expect(io.loadBuilders).toHaveBeenCalledWith('Austin')
  })

  it('counts again once an answer has forgotten the counts', async () => {
    await loadLookAlikeNeed(NOW)
    expect(Object.keys(readLookAlikeCounts()).sort()).toEqual([...RESEARCH_CITIES].sort())
    forgetLookAlikeCounts()
    io.loadBuilders.mockClear()
    siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [{ id: 'a1', builder_key: 'larkspurdentalpartners', customer_id: 'c8', answer: 'works_for', scope: 'all', permit_id: null, name: 'Larkspur Dental Partners', answered_by: 'u1', answered_at: '2026-11-10T15:00:00Z' }], me: 'u1' })
    expect(await loadLookAlikeNeed(NOW + 1000)).toEqual({ count: 2, byCity: [{ city: 'San Antonio', count: 2 }], city: 'San Antonio' })
    expect(io.loadBuilders).toHaveBeenCalledTimes(RESEARCH_CITIES.length)
  })

  it('has no line when no name waits, and none before the answers table is on the database', async () => {
    io.loadBuilders.mockResolvedValue([])
    expect(await loadLookAlikeNeed(NOW)).toBeNull()
    window.localStorage.clear()
    siteIo.loadAllNameAnswers.mockResolvedValue(null)
    expect(await loadLookAlikeNeed(NOW)).toBeNull()
    expect(readLookAlikeCounts()).toEqual({})
  })

  it('leaves out a city that cannot be read, counts the rest, and asks that city again next time', async () => {
    io.loadBuilders.mockImplementation(async (city: string) => {
      if (city === 'San Antonio') throw new Error('canceling statement due to statement timeout')
      return BY_CITY[city] ?? []
    })
    expect(await loadLookAlikeNeed(NOW)).toEqual({ count: 1, byCity: [{ city: 'Austin', count: 1 }], city: 'Austin' })
    expect(readLookAlikeCounts()['San Antonio']).toBeUndefined()
  })

  it('shares one read between two askers at once', async () => {
    const [a, b] = await Promise.all([loadLookAlikeNeed(NOW), loadLookAlikeNeed(NOW)])
    expect(a).toEqual(b)
    expect(io.loadBuilders).toHaveBeenCalledTimes(RESEARCH_CITIES.length)
  })
})
