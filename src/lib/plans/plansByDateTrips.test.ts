/**
 * The Trips lane on Plans by date (punch list #379, PR 6): a site with a trip gets one lane under its sets,
 * each trip a bar over its days coloured day by day, a planned one faint; a site with no trip is unchanged.
 * Every name, day and trip here is made up.
 */
import { describe, expect, it } from 'vitest'
import {
  buildPlansByDate,
  dayOfYmd,
  layoutPlansByDate,
  PLANS_BY_DATE_FAINT,
  PLANS_BY_DATE_PRINT_LIST_NOTE,
  PLANS_BY_DATE_PRINT_LIST_NOTE_TRIPS,
  PLANS_BY_DATE_TRIP_MIN_WIDTH,
  plansByDateGlyph,
  plansByDateListRows,
  plansByDateLogTitle,
  plansByDateLogWords,
  plansByDatePaperSvg,
  plansByDatePrintHtml,
  tripBarShape,
  tripRuns,
  type PbdPrim,
  type PbdTripKind,
  type PlansByDateInput,
  type PlansByDateTrip,
} from './plansByDate'
import { buildPlansByDateCards, PBD_PRESS } from './plansByDateCards'

const toYmd = (raw: string | null | undefined) => (raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)
const day = (ymd: string): number => {
  const d = dayOfYmd(ymd)
  if (d == null) throw new Error(`not a day: ${ymd}`)
  return d
}
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** Days from letters: g Getting ready, r On the road, s At the site, x a day nobody was on it. */
function days(first: string, letters: string): PlansByDateTrip['days'] {
  const kind: Record<string, PbdTripKind> = { g: 'ready', r: 'road', s: 'site' }
  return [...letters].map((c, i) => ({ ymd: addDays(first, i), kind: kind[c] ?? null }))
}
// Two trips with their numbers, and one made before numbers, which is told by its days alone.
const lifts: PlansByDateTrip = { id: 't5', days: days('2026-10-23', 'gxxrssssssssr'), planned: false, when: 'Oct 23 to Nov 4', title: 'Trip 5 · Oct 23 to Nov 4', number: 'Trip 5', door: 'Open Trip 5', standing: 'Back · 8 days at the site', who: 'Luis, Priya', why: 'Lift stations before the pour' }
const trim: PlansByDateTrip = { id: 't6', days: days('2026-12-01', 'rsssr'), planned: true, when: 'Dec 1 to 5', title: 'Trip 6 · Dec 1 to 5', number: 'Trip 6', door: 'Open Trip 6', standing: 'Planned', who: 'Dana, Luis', why: '' }
const meeting: PlansByDateTrip = { id: 't4', days: days('2026-06-22', 's'), planned: false, when: 'Jun 22', title: 'Trip Jun 22', number: null, door: 'Open this trip', standing: 'Back · 1 day at the site', who: 'Dana', why: 'Site meeting' }

function site(over: Partial<PlansByDateInput> = {}): PlansByDateInput {
  return {
    parts: [{ id: 'pA', name: 'ZZ Lodge', position: 1, created_at: '2026-01-01T00:00:00Z', current_set_id: 'a1' }],
    sets: [{ id: 'a1', part_id: 'pA', name: 'Permit set', kind: 'permit', source: 'gc', dated: '2026-05-08', came_at: '2026-05-12T15:00:00Z', replaces_set_id: null }],
    bids: [{ id: 'bid1', label: 'B9001', sent: '2026-02-12', plansDated: null, outcome: 'won', outcomeAt: null }],
    jobs: [{ id: 'j1', label: 'J2101', days: ['2026-10-27', '2026-10-28'], firstWorkDay: '2026-10-27', lastWorkDay: '2026-10-28' }],
    history: [{ id: 'h1', happenedAt: '2026-07-14T16:00:00Z', source: 'email', body: 'The site super asked for the lift stations first.' }],
    clock: 'read',
    today: '2026-11-17',
    toYmd,
    ...over,
  }
}
const rects = (prims: ReadonlyArray<PbdPrim>) => prims.filter((p): p is Extract<PbdPrim, { t: 'rect' }> => p.t === 'rect')

describe('a trip’s days as runs', () => {
  it('joins days of one kind, keeps a day off in the middle, and reads them in date order', () => {
    expect(tripRuns(days('2026-10-23', 'gxxrssr'))).toEqual([
      { from: day('2026-10-23'), to: day('2026-10-23'), kind: 'ready' },
      { from: day('2026-10-24'), to: day('2026-10-25'), kind: 'off' },
      { from: day('2026-10-26'), to: day('2026-10-26'), kind: 'road' },
      { from: day('2026-10-27'), to: day('2026-10-28'), kind: 'site' },
      { from: day('2026-10-29'), to: day('2026-10-29'), kind: 'road' },
    ])
    expect(tripRuns([...days('2026-10-23', 'rss')].reverse())).toEqual(tripRuns(days('2026-10-23', 'rss')))
  })

  it('begins and ends on a day somebody was on it, and drops what is not a day', () => {
    expect(tripRuns(days('2026-10-23', 'xsx'))).toEqual([{ from: day('2026-10-24'), to: day('2026-10-24'), kind: 'site' }])
    expect(tripRuns([{ ymd: 'soon', kind: 'site' }])).toEqual([])
    expect(tripRuns(days('2026-10-23', 'xx'))).toEqual([])
  })

  it('runs across a month end', () => {
    expect(tripRuns(days('2026-10-30', 'ssss'))).toEqual([{ from: day('2026-10-30'), to: day('2026-11-02'), kind: 'site' }])
  })
})

describe('the Trips lane', () => {
  it('is not on a site with no trip, so every other chart is unchanged', () => {
    const without = buildPlansByDate(site())
    expect(without.lanes.some((l) => l.kind === 'trips')).toBe(false)
    expect(without.legend.some((l) => l.glyph === 'trip')).toBe(false)
    expect(buildPlansByDate(site({ trips: [] }))).toEqual(without)
    // A trip with no day yet has nowhere to stand.
    expect(buildPlansByDate(site({ trips: [{ ...lifts, days: [] }] })).lanes.some((l) => l.kind === 'trips')).toBe(false)
    expect(plansByDateLogWords(without)).toBe('crew and History')
    expect(plansByDateLogTitle(without)).toBe('Lists the crews’ days and the lines kept on History too')
  })

  it('sits under the sets and over the crews, with a bar a trip in the order they went out', () => {
    const model = buildPlansByDate(site({ trips: [trim, lifts, meeting] }))
    expect(model.lanes.map((l) => l.kind)).toEqual(['bids', 'part', 'trips', 'crew', 'history'])
    const lane = model.lanes.find((l) => l.kind === 'trips')
    expect(lane).toMatchObject({ key: 'trips', label: 'Trips', sub: '2 trips · 1 planned' })
    expect(lane?.spans.map((s) => s.key)).toEqual(['trip-t4', 'trip-t5', 'trip-t6'])
    expect(lane?.spans[1]).toMatchObject({ glyph: 'trip', from: day('2026-10-23'), to: day('2026-11-04'), faint: false, tip: 'Trip 5 · Oct 23 to Nov 4 · Back · 8 days at the site · Luis, Priya · Lift stations before the pour' })
    expect(lane?.spans[2]).toMatchObject({ faint: true, tip: 'Trip 6 · Dec 1 to 5 · Planned · Dana, Luis' })
    expect(plansByDateLogWords(model)).toBe('trip, crew and History')
    expect(plansByDateLogTitle(model)).toBe('Lists the trips, the crews’ days and the lines kept on History too')
  })

  it('says only what it has: a site whose one trip is planned', () => {
    expect(buildPlansByDate(site({ trips: [trim] })).lanes.find((l) => l.kind === 'trips')?.sub).toBe('1 planned')
  })

  it('stands on the view’s own time axis, which grows to hold a planned trip', () => {
    const without = buildPlansByDate(site())
    const model = buildPlansByDate(site({ trips: [trim] }))
    expect(model.start).toBe(without.start)
    expect(model.end).toBeGreaterThan(day('2026-12-05'))
    expect(model.end).toBeGreaterThan(without.end)
  })

  it('lists each trip as a dated line, kept with the log and out of the drawings and the bids', () => {
    const model = buildPlansByDate(site({ trips: [lifts, trim, meeting] }))
    const line = (key: string) => model.rows.find((r) => r.key === key)
    expect(line('trip-t5')).toMatchObject({ ymd: '2026-10-23', lane: 'Trips', glyph: 'trip', text: 'Trip 5 until Nov 4', soft: 'Luis, Priya · Lift stations before the pour' })
    expect(line('trip-t6')).toMatchObject({ text: 'Planned Trip 6 until Dec 5', soft: 'Dana, Luis' })
    expect(line('trip-t4')).toMatchObject({ text: 'Trip for the day' })
    expect(plansByDateListRows(model.rows, false).rows.some((r) => r.glyph === 'trip')).toBe(false)
    expect(plansByDateListRows(model.rows, true).rows.filter((r) => r.glyph === 'trip')).toHaveLength(3)
  })

  it('has its mark in the key', () => {
    const model = buildPlansByDate(site({ trips: [lifts] }))
    expect(model.legend.find((l) => l.glyph === 'trip')?.words).toBe('a trip by day: ready, road, site, faint when planned')
    expect(plansByDateGlyph('trip').prims.map((p) => p.cls)).toEqual(['tripReady', 'tripRoad', 'tripSite'])
  })
})

describe('a trip’s bar', () => {
  const span = (t: PlansByDateTrip) => {
    const s = buildPlansByDate(site({ trips: [t] })).lanes.find((l) => l.kind === 'trips')?.spans[0]
    if (!s) throw new Error('no span')
    return s
  }

  it('is coloured day by day: a rectangle a run, a day wide a day', () => {
    // Ten pixels a day, so the days can be read off the shapes.
    const shape = tripBarShape(span(lifts), (d) => (d - day('2026-10-23')) * 10, 50)
    expect(rects(shape.prims).map((p) => [p.cls, p.x, p.w])).toEqual([
      ['tripReady', 0, 10],
      ['tripOff', 10, 20],
      ['tripRoad', 30, 10],
      ['tripSite', 40, 80],
      ['tripRoad', 120, 10],
    ])
    expect(rects(shape.prims).every((p) => p.y === 44 && p.h === 12 && !p.faint)).toBe(true)
    expect(shape).toMatchObject({ key: 'trip-t5', cx: 65, hit: { t: 'rect', cls: 'hit', x: -2, w: 134 } })
  })

  it('draws a planned trip faint, inside a dashed edge', () => {
    const shape = tripBarShape(span(trim), (d) => (d - day('2026-12-01')) * 10, 50)
    const all = rects(shape.prims)
    expect(all.filter((p) => p.cls !== 'tripPlanned').every((p) => p.faint === true)).toBe(true)
    expect(all[all.length - 1]).toMatchObject({ cls: 'tripPlanned', x: -1, w: 52, y: 43, h: 14 })
  })

  it('is one mark in the kind that leads the trip when it is too narrow to split', () => {
    const narrow = tripBarShape(span(lifts), (d) => (d - day('2026-10-23')) * 0.2, 50)
    expect(rects(narrow.prims)).toEqual([{ t: 'rect', cls: 'tripSite', x: 0, y: 44, w: PLANS_BY_DATE_TRIP_MIN_WIDTH, h: 12, rx: 2, faint: false }])
    const oneDay = tripBarShape(span(meeting), (d) => (d - day('2026-06-22')) * 1.5, 50)
    expect(rects(oneDay.prims).map((p) => [p.cls, p.w])).toEqual([['tripSite', PLANS_BY_DATE_TRIP_MIN_WIDTH]])
  })

  it('is on the chart at every width, and on the paper in paper’s colours', () => {
    const model = buildPlansByDate(site({ trips: [lifts, trim] }))
    for (const variant of ['desktop', 'phone', 'paper'] as const) {
      const layout = layoutPlansByDate(model, variant)
      expect(layout.marks.filter((m) => m.key.startsWith('trip-')).map((m) => m.key)).toEqual(['trip-t5', 'trip-t6'])
      expect(layout.nameHits.some((h) => h.key === 'lane-trips' && h.label === 'Trips')).toBe(true)
    }
    const svg = plansByDatePaperSvg(layoutPlansByDate(model, 'paper'))
    expect(svg).toContain('fill="#16a34a"')
    expect(svg).toContain('fill="#2563eb"')
    expect(svg).toContain(`opacity="${PLANS_BY_DATE_FAINT}"`)
    expect(svg).not.toContain('var(--')
  })
})

describe('the print', () => {
  it('carries the lane, and its note names the trips when the list leaves the log out', () => {
    const model = buildPlansByDate(site({ trips: [lifts] }))
    const html = plansByDatePrintHtml({ siteName: 'ZZ Test Heron Point', customerName: null, model, notes: [], printedAt: 'now', printedBy: null })
    expect(html).toContain('>Trips</text>')
    expect(html).toContain('a trip by day: ready, road, site, faint when planned')
    expect(html).toContain(PLANS_BY_DATE_PRINT_LIST_NOTE_TRIPS)
    expect(html).not.toContain(PLANS_BY_DATE_PRINT_LIST_NOTE)
    const all = plansByDatePrintHtml({ siteName: 'ZZ Test Heron Point', customerName: null, model, notes: [], printedAt: 'now', printedBy: null, withLog: true })
    expect(all).toContain('Trips: Trip 5 until Nov 4')
  })
})

describe('a trip’s card', () => {
  const input = site({ trips: [lifts, trim] })
  const model = buildPlansByDate(input)
  const cards = buildPlansByDateCards(input, model, { canWritePlans: false, canOpenJobs: true, canKeep: true, canAsk: true })

  it('says the trip by its number, and its one press opens that trip', () => {
    const card = cards.get('trip-t5')
    expect(card).toMatchObject({ glyph: 'trip', title: 'Trip 5 · Oct 23 to Nov 4', kicker: 'Back · 8 days at the site', facts: [{ label: 'Who went', value: 'Luis, Priya' }, { label: 'What for', value: 'Lift stations before the pour' }] })
    expect(card?.actions).toEqual([{ kind: 'open-trip', label: 'Open Trip 5', tripId: 't5' }])
    expect(PBD_PRESS.openTrips).toBe('Open the Trips look')
    expect(cards.get('trip-t6')?.facts).toEqual([{ label: 'Who went', value: 'Dana, Luis' }])
    expect(cards.get('trip-t6')?.actions).toEqual([{ kind: 'open-trip', label: 'Open Trip 6', tripId: 't6' }])
  })

  it('says a trip made before numbers by its days, and its press still opens that trip', () => {
    const old = site({ trips: [meeting] })
    const oldCards = buildPlansByDateCards(old, buildPlansByDate(old), { canWritePlans: false, canOpenJobs: true, canKeep: true, canAsk: true })
    expect(oldCards.get('trip-t4')).toMatchObject({ title: 'Trip Jun 22', actions: [{ kind: 'open-trip', label: 'Open this trip', tripId: 't4' }] })
  })

  it('names the lane with its trips, newest first', () => {
    const lane = cards.get('lane-trips')
    expect(lane).toMatchObject({ title: 'Trips', kicker: '1 trip · 1 planned', rowsTitle: 'Newest first' })
    expect(lane?.rows.map((r) => [r.key, r.text, r.to])).toEqual([
      ['trip-t6', 'Planned Trip 6 until Dec 5', 'trip-t6'],
      ['trip-t5', 'Trip 5 until Nov 4', 'trip-t5'],
    ])
    expect(lane?.actions).toEqual([{ kind: 'open-trips', label: 'Open the Trips look' }])
  })

  it('makes no trip card on a site with no trip', () => {
    const plain = site()
    const none = buildPlansByDateCards(plain, buildPlansByDate(plain), { canWritePlans: false, canOpenJobs: true, canKeep: true, canAsk: true })
    expect([...none.keys()].some((k) => k.startsWith('trip-') || k === 'lane-trips')).toBe(false)
  })
})
