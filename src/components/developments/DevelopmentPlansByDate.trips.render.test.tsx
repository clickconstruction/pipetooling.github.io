// @vitest-environment jsdom
/**
 * The Trips lane on the Plans look's By date view (punch list #379, PR 6): each trip a bar in its days'
 * colours, a planned one faint; a press on a bar pins the trip's card, like every other mark, and the card's
 * press opens the Trips look; a site with no trip has no lane. Every name and day here is made up.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PBD_CARD_ENTER_MS } from '../../hooks/usePlansByDateItemCard'
import { buildPlansByDate, PBD_TRIP_INK, PLANS_BY_DATE_FAINT, type PlansByDateInput, type PlansByDateTrip } from '../../lib/plans/plansByDate'
import { buildPlansByDateCards, type PbdCardAction } from '../../lib/plans/plansByDateCards'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { TRIP_KIND_COLOR } from '../trips/TripDayBits'
import { DevelopmentPlansByDate } from './DevelopmentPlansByDate'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/sent/sentCopiesIo', () => ({ printAndFile: () => true }))

beforeAll(installDomShims)
afterEach(cleanup)

const toYmd = (raw: string | null | undefined) => (raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)
const lifts: PlansByDateTrip = {
  id: 't5',
  days: [
    { ymd: '2026-10-26', kind: 'road' },
    { ymd: '2026-10-27', kind: 'site' },
    { ymd: '2026-10-28', kind: 'site' },
    { ymd: '2026-10-29', kind: 'road' },
  ],
  planned: false,
  when: 'Oct 26 to 29',
  standing: 'Back · 2 days at the site',
  who: 'Luis, Priya',
  why: 'Lift stations before the pour',
}
const trim: PlansByDateTrip = { id: 't6', days: [{ ymd: '2026-12-01', kind: 'road' }, { ymd: '2026-12-02', kind: 'site' }], planned: true, when: 'Dec 1 to 2', standing: 'Planned', who: 'Dana', why: '' }

function site(over: Partial<PlansByDateInput> = {}): PlansByDateInput {
  return {
    parts: [{ id: 'pA', name: 'ZZ Lodge', position: 1, created_at: '2026-01-01T00:00:00Z', current_set_id: 'a1' }],
    sets: [{ id: 'a1', part_id: 'pA', name: 'Permit set', kind: 'permit', source: 'gc', dated: '2026-05-08', came_at: '2026-05-12T15:00:00Z', replaces_set_id: null }],
    bids: [],
    jobs: [],
    history: [],
    clock: 'read',
    today: '2026-11-17',
    toYmd,
    ...over,
  }
}
const print = { siteName: 'ZZ Test Heron Point', customerName: null, printedBy: null, developmentId: 'dev-zz', customerId: null }
function draw(input: PlansByDateInput, phone = false) {
  const model = buildPlansByDate(input)
  const acted: PbdCardAction[] = []
  renderWithProviders(<DevelopmentPlansByDate model={model} phone={phone} print={print} cards={buildPlansByDateCards(input, model, { canWritePlans: false, canOpenJobs: true, canKeep: true, canAsk: true })} onAct={(a) => acted.push(a)} />)
  return { acted }
}

describe('DevelopmentPlansByDate: the Trips lane', () => {
  it('the paper draws a trip day in the colour the screen does', () => {
    expect(PBD_TRIP_INK).toEqual(TRIP_KIND_COLOR)
  })

  it('draws a lane under the sets with a bar a trip, coloured by its days, a planned one faint', () => {
    draw(site({ trips: [lifts, trim] }))
    const chart = screen.getByTestId('pbd-chart')
    expect(within(chart).getByText('Trips')).toBeTruthy()
    expect(within(chart).getByText('1 trip · 1 planned')).toBeTruthy()
    expect(screen.getByTestId('pbd-legend').textContent).toContain('a trip by day: ready, road, site, faint when planned')
    const bar = screen.getByTestId('pbd-mark-trip-t5')
    expect(bar.getAttribute('aria-label')).toBe('Trip Oct 26 to 29 · Back · 2 days at the site · Luis, Priya · Lift stations before the pour')
    const fills = [...bar.querySelectorAll('rect')].map((r) => r.style.fill).filter((f) => f && f !== 'transparent')
    // On the road, At the site, On the road.
    expect(fills).toEqual([TRIP_KIND_COLOR.road, TRIP_KIND_COLOR.site, TRIP_KIND_COLOR.road])
    const planned = [...screen.getByTestId('pbd-mark-trip-t6').querySelectorAll('rect')].filter((r) => r.style.opacity === String(PLANS_BY_DATE_FAINT))
    expect(planned.length).toBeGreaterThan(0)
    expect([...bar.querySelectorAll('rect')].some((r) => r.style.opacity === String(PLANS_BY_DATE_FAINT))).toBe(false)
  })

  it('has no lane on a site with no trip', () => {
    draw(site())
    expect(within(screen.getByTestId('pbd-chart')).queryByText('Trips')).toBeNull()
    expect(screen.queryByTestId('pbd-mark-trip-t5')).toBeNull()
  })

  it('a press on a bar pins its card, like every other mark, and the card’s press opens the Trips look, on a desk and on a phone', () => {
    for (const phone of [false, true]) {
      const { acted } = draw(site({ trips: [lifts] }), phone)
      fireEvent.click(screen.getByTestId('pbd-mark-trip-t5'))
      // The press itself jumps nowhere: the card is up and pinned, with the trip on it.
      expect(acted).toEqual([])
      // A desk pins the card beside the bar; a phone opens it as a sheet.
      const card = screen.getByTestId(phone ? 'pbd-sheet' : 'pbd-card')
      if (!phone) expect(card.getAttribute('data-pinned')).toBe('true')
      expect(within(card).getByTestId('pbd-card-title').textContent).toBe('Trip Oct 26 to 29')
      expect(within(card).getByTestId('pbd-card-facts').textContent).toContain('What forLift stations before the pour')
      fireEvent.click(within(card).getByRole('button', { name: 'Open the Trips look' }))
      expect(acted).toEqual([{ kind: 'open-trips', label: 'Open the Trips look' }])
      expect(screen.queryByTestId(phone ? 'pbd-sheet' : 'pbd-card')).toBeNull()
      cleanup()
    }
  })

  it('the keyboard opens the card too', () => {
    const { acted } = draw(site({ trips: [lifts] }))
    fireEvent.keyDown(screen.getByTestId('pbd-mark-trip-t5'), { key: 'Enter' })
    expect(screen.getByTestId('pbd-card').getAttribute('data-pinned')).toBe('true')
    expect(acted).toEqual([])
  })

  it('a hover shows the trip’s card, with the same press on it', () => {
    vi.useFakeTimers()
    try {
      const { acted } = draw(site({ trips: [lifts] }))
      fireEvent.mouseEnter(screen.getByTestId('pbd-mark-trip-t5'))
      act(() => void vi.advanceTimersByTime(PBD_CARD_ENTER_MS + 5))
      const card = screen.getByTestId('pbd-card')
      expect(within(card).getByTestId('pbd-card-title').textContent).toBe('Trip Oct 26 to 29')
      expect(within(card).getByTestId('pbd-card-kicker').textContent).toBe('Back · 2 days at the site')
      expect(within(card).getByTestId('pbd-card-facts').textContent).toContain('Who wentLuis, Priya')
      fireEvent.click(within(card).getByRole('button', { name: 'Open the Trips look' }))
      expect(acted).toEqual([{ kind: 'open-trips', label: 'Open the Trips look' }])
    } finally {
      vi.useRealTimers()
    }
  })

  it('names the trips in the press that adds the log to the list', () => {
    draw(site({ trips: [lifts], bids: [{ id: 'bid1', label: 'B9001', sent: '2026-02-12', plansDated: null, outcome: null, outcomeAt: null }] }))
    const more = screen.getByRole('button', { name: 'Also show the 1 trip, crew and History line' })
    expect(more.getAttribute('title')).toBe('Lists the trips, the crews’ days and the lines kept on History too')
  })

  it('leaves that press’s words as they were on a site with no trip', () => {
    draw(site({ bids: [{ id: 'bid1', label: 'B9001', sent: '2026-02-12', plansDated: null, outcome: null, outcomeAt: null }], history: [{ id: 'h1', happenedAt: '2026-07-14T16:00:00Z', source: 'email', body: 'A line kept.' }] }))
    const more = screen.getByRole('button', { name: 'Also show the 1 crew and History line' })
    expect(more.getAttribute('title')).toBe('Lists the crews’ days and the lines kept on History too')
  })
})
