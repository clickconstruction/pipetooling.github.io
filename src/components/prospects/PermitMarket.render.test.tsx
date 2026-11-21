// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { answerBook, type CustomerName } from '../../lib/research/builderAnswers'
import type { NameAnswerRow } from '../../lib/research/nameAnswers'
import type { BuilderRow } from '../../lib/research/permitBuilders'
import type { CityBuilders, MarketBid, MarketPermit } from '../../lib/research/permitMarket'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'

/**
 * Permits, Market (punch list #405): the table of companies we bid beside the permits their
 * names pulled, its three chips, the door to a builder's sheet and to Tie a name, the clock, the
 * four tiles, who holds the work and how much is being built. The call list has its own test.
 * Every company, person and number here is made up.
 */
const marketIo = vi.hoisted(() => ({ loadMarketBids: vi.fn(), loadBuildersOfCities: vi.fn(), loadMarketPermits: vi.fn(), loadCallAnswers: vi.fn(), recordCallAnswer: vi.fn(), loadBuilderLookups: vi.fn(), recordLookupCheck: vi.fn() }))
const research = vi.hoisted(() => ({ loadBuilders: vi.fn(), loadPermitsOfBuilder: vi.fn(), markBuilder: vi.fn(), saveBuilder: vi.fn(), pullPermitsBack: vi.fn(), loadRecordsStart: vi.fn(), approachFromPermit: vi.fn(), recordVerdict: vi.fn() }))
const siteIo = vi.hoisted(() => ({ loadAllNameAnswers: vi.fn(), loadCustomerNames: vi.fn(), loadRecentBidsWithCustomer: vi.fn(), loadPermitsByHouseNumber: vi.fn(), recordNameAnswer: vi.fn(), loadBidsOfCustomers: vi.fn(), loadNameAnswers: vi.fn(), loadPermitsOfName: vi.fn(), loadBuilderKinds: vi.fn(), onNameAnswered: vi.fn(() => () => {}) }))
const answersIo = vi.hoisted(() => ({ loadBuilderAnswersGround: vi.fn() }))
vi.mock('../../lib/research/permitMarketIo', () => marketIo)
vi.mock('../../lib/research/permitResearchIo', () => research)
vi.mock('../../lib/research/bidSiteIo', () => siteIo)
vi.mock('../../lib/research/builderAnswersIo', () => answersIo)

import { PermitMarket } from './PermitMarket'

const TODAY = '2026-11-19'
const CUSTOMERS: CustomerName[] = [
  { id: 'c1', name: 'Harbor Fitouts' },
  { id: 'c2', name: 'Juniper Hospitality Group' },
  { id: 'c3', name: 'Aster Ridge Contracting' },
  { id: 'c4', name: 'Larkspur Commercial' },
]

function builder(key: string, contact: string, permits: number, over: Partial<BuilderRow> = {}): BuilderRow {
  return { key, name: null, sample_contact: contact, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits, open: 1, last_permit_on: '2026-11-03', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}
let nextBid = 0
function bid(customerId: string, over: Partial<MarketBid> = {}): MarketBid {
  nextBid += 1
  return { id: `b${nextBid}`, customerId, customerName: CUSTOMERS.find((c) => c.id === customerId)?.name ?? null, gcName: null, outcome: null, bidOn: '2026-06-01', projectName: 'Mill Street Lofts', ...over }
}
const BIDS: MarketBid[] = [
  bid('c1', { outcome: 'won' }),
  bid('c1', { outcome: 'lost' }),
  bid('c2', { outcome: 'lost' }),
  bid('c2', { outcome: 'lost' }),
  bid('c2'),
  bid('c3'),
  bid('c4', { outcome: 'lost' }),
  bid('c4', { projectName: 'ZZ Shadow LARKSPUR PLAZA' }),
]
const BUILDERS: CityBuilders[] = [
  { city: 'San Antonio', rows: [builder('juniperhospitalitygroup', 'Juniper Hospitality Group, LLC', 11), builder('harborfitouts', 'Harbor Fitouts', 6), builder('asterridgecontractingoftexas', 'Aster Ridge Contracting of Texas', 3)] },
  { city: 'Austin', rows: [builder('harborfitouts', 'Harbor Fitouts', 2, { plumber: 'Copperline Mechanical', plumber_jobs: 2 })] },
  { city: 'New Braunfels', rows: [] },
]
const permit = (over: Partial<MarketPermit> = {}): MarketPermit => ({ builder_key: 'harborfitouts', stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: '2026-10-05', declared_value: null, address_key: null, ...over })
/** Five applications that waited 30, 40, 45, 50 and 80 days, and three issued permits in October. */
const PERMITS: MarketPermit[] = [
  ...['2026-07-01', '2026-07-11', '2026-07-16', '2026-07-21', '2026-08-20'].map((issued) => permit({ builder_key: 'juniperhospitalitygroup', stage: 'applied', work_type: 'Commercial project', submitted_on: '2026-06-01', issued_on: issued })),
  permit(),
  permit({ work_type: 'New commercial' }),
  permit({ work_type: 'New commercial' }),
]
/** Five Austin jobs whose plumber's permit came 1, 3, 5, 7 and 9 days after the building permit. */
const AUSTIN_ROWS = [1, 3, 5, 7, 9].map((d, i) => ({ id: `p${i}`, stage: 'issued', filed_on: '2026-09-01', plumber_permit_on: `2026-09-${String(1 + d).padStart(2, '0')}`, plumber: i < 3 ? 'Copperline Mechanical' : 'Blue Heron Plumbing', builder_key: 'harborfitouts', builder_name: null, contact: 'Harbor Fitouts' }) as unknown as ResearchPermitRow)

const tie = (over: Partial<NameAnswerRow> = {}): NameAnswerRow => ({ id: 'a1', builder_key: 'asterridgecontractingoftexas', customer_id: 'c3', answer: 'works_for', scope: 'all', permit_id: null, name: 'Aster Ridge Contracting of Texas', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z', ...over })
function ground(rows: NameAnswerRow[] = []) {
  return { book: answerBook(rows, CUSTOMERS), bids: [], me: 'u1', people: new Map([['u1', 'Eve'], ['u2', 'Sam']]) }
}

const onRetryRows = vi.fn()
function draw(over: { city?: string; isMobile?: boolean; rows?: ResearchPermitRow[]; rowsLoading?: boolean; rowsError?: string | null } = {}) {
  return renderWithProviders(<PermitMarket city={over.city ?? 'San Antonio'} authUserId="u1" todayYmd={TODAY} isMobile={over.isMobile ?? false} rows={over.rows ?? []} rowsLoading={over.rowsLoading ?? false} rowsError={over.rowsError ?? null} onRetryRows={onRetryRows} researchers={[]} onChanged={() => {}} onOpenPermit={() => {}} />)
}
const companyRows = () => [...document.querySelectorAll('[data-market-company]')].map((el) => el.getAttribute('data-market-company'))

beforeEach(() => {
  marketIo.loadMarketBids.mockReset().mockResolvedValue(BIDS)
  marketIo.loadBuildersOfCities.mockReset().mockResolvedValue(BUILDERS)
  marketIo.loadMarketPermits.mockReset().mockResolvedValue(PERMITS)
  marketIo.loadCallAnswers.mockReset().mockResolvedValue([])
  marketIo.loadBuilderLookups.mockReset().mockResolvedValue({ rows: [], checks: [] })
  marketIo.recordCallAnswer.mockReset().mockResolvedValue(undefined)
  research.loadBuilders.mockReset().mockResolvedValue([])
  research.loadPermitsOfBuilder.mockReset().mockResolvedValue([])
  research.markBuilder.mockReset().mockResolvedValue(undefined)
  research.saveBuilder.mockReset().mockResolvedValue(undefined)
  research.loadRecordsStart.mockReset().mockResolvedValue(null)
  siteIo.loadAllNameAnswers.mockReset().mockResolvedValue(null)
  siteIo.loadCustomerNames.mockReset().mockResolvedValue(CUSTOMERS)
  siteIo.loadBidsOfCustomers.mockReset().mockResolvedValue([])
  siteIo.loadNameAnswers.mockReset().mockResolvedValue({ rows: [], me: 'u1' })
  siteIo.loadPermitsByHouseNumber.mockReset().mockResolvedValue([])
  siteIo.loadPermitsOfName.mockReset().mockResolvedValue([])
  siteIo.loadBuilderKinds.mockReset().mockResolvedValue(new Map())
  siteIo.recordNameAnswer.mockReset().mockResolvedValue(undefined)
  answersIo.loadBuilderAnswersGround.mockReset().mockResolvedValue(ground())
})
afterEach(() => cleanup())

describe('Market, the companies we bid', () => {
  it('lists the companies that build here, with our bids, our wins, their permits and what that reads as', async () => {
    draw()
    expect(await screen.findByRole('button', { name: 'Builds 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Builds 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'No permit on record 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tie a name 1' })).toBeTruthy()
    // The most permits first. A practice bid is no bid.
    expect(companyRows()).toEqual(['juniperhospitalitygroup', 'harborfitouts'])
    const juniper = document.querySelector('[data-market-company="juniperhospitalitygroup"]') as HTMLElement
    expect([...juniper.querySelectorAll('td')].slice(1, 4).map((td) => td.textContent)).toEqual(['3', '0', '11'])
    expect(within(juniper).getByText('Builds, we never win')).toBeTruthy()
    const harbor = document.querySelector('[data-market-company="harborfitouts"]') as HTMLElement
    expect([...harbor.querySelectorAll('td')].slice(1, 4).map((td) => td.textContent)).toEqual(['2', '1', '8'])
    expect(within(harbor).getByText('Builds, and we win')).toBeTruthy()
    // The column says its count is every city's, and the words under a company say which.
    expect(screen.getByRole('columnheader', { name: 'Permits, all cities, 12 mo' })).toBeTruthy()
    // Where the permits are, each a press.
    expect(within(harbor).getByRole('button', { name: 'San Antonio 6' })).toBeTruthy()
    expect(within(harbor).getByRole('button', { name: 'Austin 2' })).toBeTruthy()
    // The first tile says the count, and the reads ran once each.
    expect(screen.getByText('2 of 4')).toBeTruthy()
    expect(screen.getByText('companies we bid pulled a permit in the cities we read')).toBeTruthy()
    expect(marketIo.loadMarketBids).toHaveBeenCalledTimes(1)
    expect(marketIo.loadMarketBids).toHaveBeenCalledWith('2024-11-19')
    expect(marketIo.loadBuildersOfCities).toHaveBeenCalledTimes(1)
  })

  it('filters by a chip, and offers Tie a name on a customer with no permit on record', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'No permit on record 2' }))
    expect(companyRows()).toEqual(['asterridgecontracting', 'larkspurcommercial'])
    const aster = document.querySelector('[data-market-company="asterridgecontracting"]') as HTMLElement
    expect(within(aster).getByText('Aster Ridge Contracting of Texas on the permits may be them')).toBeTruthy()
    expect(within(aster).getByRole('button', { name: 'Tie a name to Aster Ridge Contracting' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tie a name 1' }))
    expect(companyRows()).toEqual(['asterridgecontracting'])
  })

  it('opens Find their names from Tie a name, and reads the answers again when it closes', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'No permit on record 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tie a name to Larkspur Commercial' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getAllByText(/Larkspur Commercial/).length).toBeGreaterThan(0)
    expect(siteIo.loadNameAnswers).toHaveBeenCalledWith(['c4'])
    expect(answersIo.loadBuilderAnswersGround).toHaveBeenCalledTimes(1)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(answersIo.loadBuilderAnswersGround).toHaveBeenCalledTimes(2))
  })

  it('counts the permits under a name a person tied to the customer', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()]))
    draw()
    expect(await screen.findByRole('button', { name: 'Builds 3' })).toBeTruthy()
    const aster = document.querySelector('[data-market-company="asterridgecontracting"]') as HTMLElement
    expect(within(aster).getByText('Builds, one try')).toBeTruthy()
    expect(within(aster).getByRole('button', { name: 'San Antonio 3, as Aster Ridge Contracting of Texas' })).toBeTruthy()
  })

  it('opens the builder’s sheet from a name on a row', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Austin 2' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Harbor Fitouts' })).toBeTruthy()
    expect(research.loadPermitsOfBuilder).toHaveBeenCalledWith('Austin', 'harborfitouts', TODAY)
    // Austin's permits name a plumber, so the sheet says which.
    expect(within(sheet).getByText(/Plumber they use: Copperline Mechanical on 2\./)).toBeTruthy()
  })

  it('draws cards on a phone', async () => {
    draw({ isMobile: true })
    expect(await screen.findByText('3 bids, 0 won · 11 permits')).toBeTruthy()
    expect(document.querySelector('table')).toBeNull()
    expect(companyRows()).toEqual(['juniperhospitalitygroup', 'harborfitouts'])
  })

  it('says why when the read fails, and reads again on Retry', async () => {
    marketIo.loadMarketBids.mockRejectedValueOnce(new Error('Could not read our bids of the last two years: the network is down'))
    draw()
    expect(await screen.findByText(/the network is down/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: 'Builds 2' })).toBeTruthy()
  })

  it('says what fills the table when we have no bid in two years', async () => {
    marketIo.loadMarketBids.mockResolvedValue([])
    draw()
    expect(await screen.findByText('No bids in the last two years yet.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bids' }).getAttribute('href')).toBe('/bids')
  })
})

describe('Market, the clock', () => {
  it('draws application to permit for a city whose applications carry both days', async () => {
    draw()
    expect(await screen.findByText('San Antonio · application to permit')).toBeTruthy()
    const clock = document.querySelector('[data-market-clock="application"]') as HTMLElement
    expect(within(clock).getByText('45 days')).toBeTruthy()
    // A middle well along the bar is said under its mark, apart from the bar's first word.
    expect((clock.querySelector('[data-clock-start]') as HTMLElement).textContent).toBe('applied')
    expect(within(clock).getByText(/Half of the applications wait 45 days or more for the permit\./)).toBeTruthy()
    expect(marketIo.loadMarketPermits).toHaveBeenCalledWith('San Antonio', '2025-11-19')
    // San Antonio's permits name no plumber: nothing is drawn about plumbers.
    expect(document.querySelector('[data-market-clock="plumber"]')).toBeNull()
    expect(screen.getByText('~6 weeks')).toBeTruthy()
  })

  it('draws building permit to the plumber’s permit where the city names plumbers', async () => {
    marketIo.loadMarketPermits.mockResolvedValue([])
    draw({ city: 'Austin', rows: AUSTIN_ROWS })
    expect(await screen.findByText('Austin · building permit to the plumber’s permit')).toBeTruthy()
    const plumber = document.querySelector('[data-market-clock="plumber"]') as HTMLElement
    expect(within(plumber).getByText(/Read Austin for who builds\./)).toBeTruthy()
    // The middle is days from the start, where the word issued is: the days are drawn beside the word, once, and not on top of it.
    const start = plumber.querySelector('[data-clock-start]') as HTMLElement
    expect(start.textContent).toMatch(/^issued(\d+ days?|the same day)$/)
    expect(plumber.querySelectorAll('strong')).toHaveLength(1)
    expect(screen.getByText('from a building permit to the plumber’s permit')).toBeTruthy()
    expect(document.querySelector('[data-market-clock="application"]')).toBeNull()
  })

  it('says so when a city’s permits carry too few dates', async () => {
    marketIo.loadMarketPermits.mockResolvedValue([])
    draw({ city: 'New Braunfels' })
    expect(await screen.findByText('New Braunfels’s permits carry too few pairs of dates to draw a clock yet.')).toBeTruthy()
  })

  it('reads only the city’s year of permits again when the city changes', async () => {
    const view = draw()
    await screen.findByText('San Antonio · application to permit')
    marketIo.loadMarketPermits.mockResolvedValue([])
    view.rerender(<PermitMarket city="Austin" authUserId="u1" todayYmd={TODAY} isMobile={false} rows={AUSTIN_ROWS} rowsLoading={false} rowsError={null} onRetryRows={() => {}} researchers={[]} onChanged={() => {}} onOpenPermit={() => {}} />)
    expect(await screen.findByText('Austin · building permit to the plumber’s permit')).toBeTruthy()
    expect(marketIo.loadMarketPermits).toHaveBeenCalledTimes(2)
    expect(marketIo.loadMarketBids).toHaveBeenCalledTimes(1)
    expect(marketIo.loadBuildersOfCities).toHaveBeenCalledTimes(1)
    expect(marketIo.loadCallAnswers).toHaveBeenCalledTimes(1)
  })
})

describe('Market, the tiles and the two boxes under the clock', () => {
  it('fills four tiles: the week’s builders, their open jobs, the companies that build, and the clock', async () => {
    draw()
    await screen.findByText('San Antonio · application to permit')
    const tiles = [...document.querySelectorAll('[data-market-tiles] > div')].map((t) => t.textContent)
    // Juniper has five permits in the year and Harbor three, so two builders are to call. No job of theirs is on the tab's rows.
    expect(tiles).toEqual(['2builders to call this week', '0of their jobs are applied for, with no plumber yet', '2 of 4companies we bid pulled a permit in the cities we read', '~6 weeksfrom an application to its permit'])
  })

  it('draws who holds the work only where the city names plumbers', async () => {
    draw()
    await screen.findByText('San Antonio · application to permit')
    expect(document.querySelector('[data-market-holds]')).toBeNull()
    cleanup()
    marketIo.loadMarketPermits.mockResolvedValue([])
    draw({ city: 'Austin', rows: AUSTIN_ROWS })
    await screen.findByText('Austin · building permit to the plumber’s permit')
    const holds = document.querySelector('[data-market-holds]') as HTMLElement
    expect(within(holds).getByText('Copperline Mechanical')).toBeTruthy()
    expect(within(holds).getByText('Blue Heron Plumbing')).toBeTruthy()
    // One builder with five named jobs: three of them with one plumber is a lean.
    expect(within(holds).getByText('Of 1 builder with 3 or more named jobs: 0 use one plumber nearly every time, 1 leans to one and 0 shop around.')).toBeTruthy()
  })

  it('draws how much is being built: the months, the kinds and the size', async () => {
    research.loadRecordsStart.mockResolvedValue('2026-08-27')
    draw()
    await screen.findByText('San Antonio · application to permit')
    const months = document.querySelector('[data-market-months] [role="img"]') as HTMLElement
    await waitFor(() => expect(months.getAttribute('aria-label')).toBe('Commercial permits a month in San Antonio: Sep 0, Oct 3'))
    const kinds = document.querySelector('[data-market-kinds]') as HTMLElement
    expect(within(kinds).getByText('Applications')).toBeTruthy()
    expect(within(kinds).getByText('New commercial')).toBeTruthy()
    expect(within(kinds).getByText('San Antonio’s permits carry no declared value, so no size is drawn.')).toBeTruthy()
  })

  it('draws the table and the clock even when the answers on the call list cannot be read', async () => {
    marketIo.loadCallAnswers.mockRejectedValue(new Error('Could not read the answers on the call list: the network is down'))
    draw()
    expect(await screen.findByRole('button', { name: 'Builds 2' })).toBeTruthy()
    expect(await screen.findByText(/the network is down/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'This week 2' })).toBeTruthy()
    // The list says what the failed read costs, and Retry asks for the answers again.
    expect(screen.getByText('A name already answered may be on this list until the answers load.')).toBeTruthy()
    marketIo.loadCallAnswers.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText(/the network is down/)).toBeNull())
    expect(marketIo.loadCallAnswers).toHaveBeenCalledTimes(2)
  })

  it('reads what was looked up again after a press, and shows no earlier fact when that read fails', async () => {
    const fact = { id: 'f1', builder_key: 'harborfitouts', fact: 'phone', value: '(210) 555-0142', detail: '', source_url: 'https://harborfitouts.example/contact', looked_up_on: '2026-11-18', looked_up_by: 'u2', looked_up_how: 'agent', city: 'San Antonio', created_at: '2026-11-18T18:00:00Z' }
    marketIo.loadBuilderLookups.mockResolvedValue({ rows: [fact], checks: [] })
    marketIo.recordLookupCheck.mockReset().mockResolvedValue(undefined)
    draw()
    const checked = await screen.findByRole('button', { name: 'Checked: the office phone of Harbor Fitouts' })
    marketIo.loadBuilderLookups.mockRejectedValue(new Error('Could not read what was looked up about the builders: the network is down'))
    fireEvent.click(checked)
    await waitFor(() => expect(marketIo.recordLookupCheck).toHaveBeenCalledWith({ lookupId: 'f1', verdict: 'checked' }))
    expect(await screen.findByText('Could not read what was looked up about the builders: the network is down')).toBeTruthy()
    // The red line says no name shows who to ask for, so the earlier read's phone is gone with it.
    expect(screen.queryByText('(210) 555-0142')).toBeNull()
    expect(screen.getAllByText('What was looked up could not be read.').length).toBeGreaterThan(0)
    marketIo.loadBuilderLookups.mockResolvedValue({ rows: [fact], checks: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('(210) 555-0142')).toBeTruthy()
    expect(marketIo.loadBuilderLookups).toHaveBeenCalledTimes(3)
  })

  it('holds the call list when the year of permits cannot be read: no zero tile, no "all answered", no word on what the city shows', async () => {
    marketIo.loadMarketPermits.mockRejectedValue(new Error('Couldn’t load the year of permits: the network is down'))
    draw()
    expect(await screen.findByRole('button', { name: 'Builds 2' })).toBeTruthy()
    expect(await screen.findByText(/the network is down/)).toBeTruthy()
    expect(screen.getByText('The list needs this read, so it shows no name until the read comes back.')).toBeTruthy()
    expect(screen.queryByText(/is answered/)).toBeNull()
    expect(screen.queryByText(/shows only issued permits/)).toBeNull()
    expect(screen.queryByText(/builders? to call this week/)).toBeNull()
    expect(screen.queryByText(/too few pairs of dates/)).toBeNull()
    expect(screen.getByText('The permits did not load, so no clock is drawn.')).toBeTruthy()
    // Retry reads the year again, and the list draws.
    marketIo.loadMarketPermits.mockResolvedValue(PERMITS)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: 'This week 2' })).toBeTruthy()
    expect(screen.queryByText(/the network is down/)).toBeNull()
  })

  it('holds the call list when the tab’s own rows cannot be read, since the open jobs come off them', async () => {
    draw({ rowsError: 'Could not read the permits: the network is down' })
    expect(await screen.findByRole('button', { name: 'Builds 2' })).toBeTruthy()
    expect(await screen.findByText(/the network is down/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
    expect(screen.queryByText(/of their jobs/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetryRows).toHaveBeenCalledTimes(1)
  })
})
