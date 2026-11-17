import { describe, expect, it } from 'vitest'
import {
  buildPlansByDate,
  crewRuns,
  dayOfYmd,
  dayWords,
  layoutPlansByDate,
  placePlansByDateLabels,
  plansByDateCrewNote,
  plansByDateGlyph,
  plansByDatePrintHtml,
  plansByDateTicks,
  plansByDateUnsentWords,
  ymdOfDay,
  type PlansByDateInput,
} from './plansByDate'

/** The item at an index, or a failure that names it: the tests read lanes and marks by place. */
function at<T>(list: ReadonlyArray<T>, i: number): T {
  const v = list[i]
  if (v === undefined) throw new Error(`nothing at ${i}`)
  return v
}

const toYmd = (raw: string | null | undefined) => (raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)

const part = (id: string, name: string, position: number, current: string | null) => ({ id, name, position, created_at: `2025-05-0${position}T00:00:00Z`, current_set_id: current })
const set = (id: string, partId: string, name: string, kind: string, dated: string | null, came: string, more: { source?: string; replaces?: string } = {}) => ({
  id,
  part_id: partId,
  name,
  kind,
  source: more.source ?? 'gc',
  dated,
  came_at: `${came}T15:00:00Z`,
  replaces_set_id: more.replaces ?? null,
})

/** A made-up site: two buildings that began as one design, a clubhouse, a part with no set. */
function site(over: Partial<PlansByDateInput> = {}): PlansByDateInput {
  return {
    parts: [part('pB', 'ZZ Building B', 2, 'b2'), part('pA', 'ZZ Building A', 1, 'a3'), part('pC', 'ZZ Clubhouse', 3, null)],
    sets: [
      set('a1', 'pA', 'Issued set', 'issued', '2025-05-20', '2025-05-22'),
      set('a2', 'pA', 'Addendum 1', 'addendum', '2025-06-30', '2025-07-01', { source: 'architect' }),
      set('a3', 'pA', 'Permit set', 'permit', '2026-05-08', '2026-05-12'),
      set('a4', 'pA', 'As-built', 'as_built', '2026-09-22', '2026-09-22', { source: 'ours' }),
      set('b1', 'pB', 'Revised set', 'revised', '2025-11-04', '2025-11-06', { source: 'architect', replaces: 'a2' }),
      set('b2', 'pB', 'Construction set', 'construction', '2026-08-11', '2026-08-13'),
      set('b3', 'pB', 'Bulletin 5', 'bulletin', null, '2026-10-30'),
      // A paper is kept with the sets and is not a drawing.
      set('x1', 'pA', 'Fixture schedule', 'schedule', '2026-01-05', '2026-01-05'),
    ],
    bids: [
      { id: 'bid2', label: 'B9044', sent: '2026-03-17', plansDated: '2026-03-10', outcome: null, outcomeAt: null },
      { id: 'bid1', label: 'B9001', sent: '2025-06-12', plansDated: '2025-05-20', outcome: 'won', outcomeAt: '2025-07-30T14:00:00Z' },
      { id: 'bid3', label: 'B9050', sent: null, plansDated: null, outcome: null, outcomeAt: null },
    ],
    jobs: [
      { id: 'j1', label: 'J9101', days: ['2025-09-08', '2025-09-09', '2025-09-12', '2025-09-15', '2025-10-06'], firstWorkDay: '2025-09-08', lastWorkDay: '2025-10-06' },
      { id: 'j2', label: 'J9103', days: ['2025-09-09', '2025-10-07'], firstWorkDay: null, lastWorkDay: '2025-10-07' },
      { id: 'j3', label: 'J9102', days: [], firstWorkDay: '2025-08-04', lastWorkDay: '2025-08-22' },
    ],
    history: [
      { id: 'h1', happenedAt: '2026-07-14T16:00:00Z', source: 'letter', body: 'Notice of delay sent to the GC.' },
      { id: 'h2', happenedAt: '2025-08-01T16:00:00Z', source: 'email', body: 'The GC sent  the signed\ncontract.' },
    ],
    clock: 'read',
    today: '2026-11-16',
    toYmd,
    ...over,
  }
}

describe('days', () => {
  it('turns a civil day into a number and back', () => {
    const d = dayOfYmd('2026-11-16')
    expect(d).not.toBeNull()
    expect(ymdOfDay(d as number)).toBe('2026-11-16')
    expect((dayOfYmd('2026-11-17') as number) - (d as number)).toBe(1)
    expect(dayOfYmd('Nov 16')).toBeNull()
    expect(dayOfYmd(null)).toBeNull()
  })
  it('says a day with and without its year', () => {
    expect(dayWords('2026-11-06')).toBe('Nov 6, 2026')
    expect(dayWords('2026-11-06', false)).toBe('Nov 6')
  })
})

describe('crewRuns', () => {
  it('joins days into a bar across a weekend and ends it after a week off', () => {
    const runs = crewRuns([
      { label: 'J2', days: ['2025-09-09', '2025-10-07'] },
      { label: 'J1', days: ['2025-09-08', '2025-09-09', '2025-09-12', '2025-09-15', '2025-10-06'] },
    ])
    expect(runs).toHaveLength(2)
    expect(ymdOfDay(at(runs, 0).from)).toBe('2025-09-08')
    expect(ymdOfDay(at(runs, 0).to)).toBe('2025-09-15')
    // Sep 9 is on both jobs and counts once.
    expect(at(runs, 0).days).toBe(4)
    expect(at(runs, 0).jobs).toEqual(['J1', 'J2'])
    expect(at(runs, 1).days).toBe(2)
  })
  it('keeps a gap of exactly a week in one bar and splits at eight days', () => {
    expect(crewRuns([{ label: 'J1', days: ['2025-09-01', '2025-09-08'] }])).toHaveLength(1)
    expect(crewRuns([{ label: 'J1', days: ['2025-09-01', '2025-09-09'] }])).toHaveLength(2)
  })
  it('gives nothing for no days, and skips words that are not a day', () => {
    expect(crewRuns([{ label: 'J1', days: null }, { label: 'J2', days: ['soon'] }])).toEqual([])
  })
})

describe('buildPlansByDate', () => {
  const model = buildPlansByDate(site())

  it('draws the bids, then a lane for each part in the table’s order, then the crews and History', () => {
    expect(model.lanes.map((l) => l.label)).toEqual(['Bids', 'ZZ Building A', 'ZZ Building B', 'ZZ Clubhouse', 'Crews on site', 'History'])
    expect(model.lanes.map((l) => l.sub)).toEqual(['2 sent', '4 sets', '3 sets', 'no set yet', '6 days by the clock', '2 lines kept'])
  })

  it('marks every drawing set on the date on its sheets and leaves papers out', () => {
    const a = at(model.lanes, 1)
    expect(a.marks.map((m) => [m.label, m.glyph, ymdOfDay(m.day)])).toEqual([
      ['Issued set', 'set', '2025-05-20'],
      ['Addendum 1', 'set', '2025-06-30'],
      ['Permit set', 'current', '2026-05-08'],
      ['As-built', 'ours', '2026-09-22'],
    ])
    expect(a.lifeFrom).toBe(dayOfYmd('2025-05-20'))
    expect(model.rows.some((r) => r.text.includes('Fixture schedule'))).toBe(false)
  })

  it('places a set with no date on the day it came, as an open mark', () => {
    const undated = at(model.lanes, 2).marks.find((m) => m.label === 'Bulletin 5')
    expect(undated?.glyph).toBe('undated')
    expect(ymdOfDay(undated?.day as number)).toBe('2026-10-30')
    expect(undated?.tip).toContain('no date on the sheets · came Oct 30, 2026')
  })

  it('names the set a part builds from first, then the newest', () => {
    const a = at(model.lanes, 1)
    const byPriority = [...a.marks].sort((x, y) => y.priority - x.priority).map((m) => m.label)
    expect(byPriority).toEqual(['Permit set', 'As-built', 'Addendum 1', 'Issued set'])
    expect(a.marks.find((m) => m.glyph === 'current')?.tip).toBe('Permit set · the GC · dated May 8, 2026 · came May 12 · ZZ Building A builds from it')
  })

  it('joins two lanes on the day one design became two parts', () => {
    expect(model.links).toEqual([{ from: 'pA', to: 'pB', day: dayOfYmd('2025-11-04') }])
    expect(at(at(model.lanes, 2).marks, 0).tip).toContain('the day ZZ Building B split from ZZ Building A')
  })

  it('stands each bid on the day it was sent, with the plans it was priced from, and names the ones with no day', () => {
    const bids = at(model.lanes, 0)
    expect(bids.marks.filter((m) => m.glyph === 'bid').map((m) => m.label)).toEqual(['B9001', 'B9044'])
    expect(bids.marks.find((m) => m.label === 'B9001')?.tip).toBe('B9001 sent Jun 12, 2025 · priced from plans dated May 20, 2025 · won Jul 30, 2025')
    expect(bids.joins).toHaveLength(2)
    expect(model.unsentBids).toEqual(['B9050'])
    expect(plansByDateUnsentWords(model.unsentBids)).toBe('1 bid has no sent day, so it is not on the chart: B9050.')
    expect(plansByDateUnsentWords([])).toBeNull()
  })

  it('draws the clock’s days as bars and a job with none as its first work day to its last', () => {
    const crew = at(model.lanes, 4)
    expect(crew.spans.map((s) => [s.glyph, ymdOfDay(s.from), ymdOfDay(s.to)])).toEqual([
      ['crewOpen', '2025-08-04', '2025-08-22'],
      ['crew', '2025-09-08', '2025-09-15'],
      ['crew', '2025-10-06', '2025-10-07'],
    ])
    expect(at(crew.spans, 1).tip).toBe('Crews on site Sep 8 to Sep 15, 2025 · 4 days · J9101, J9103')
    expect(at(crew.spans, 0).tip).toContain('the days between are not on the clock')
  })

  it('ticks every kept line and flags a letter', () => {
    const history = at(model.lanes, 5)
    expect(history.marks.map((m) => [m.glyph, m.label])).toEqual([['tick', null], ['letter', 'Letter']])
    expect(at(history.marks, 0).tip).toBe('Email · Aug 1, 2025 · The GC sent the signed contract.')
  })

  it('counts the sets since the first bid won, and leaves our own as-built out of the counts', () => {
    expect(model.figures).toEqual([
      { key: 'first', label: 'First drawings', value: 'May 20, 2025', sub: 'the oldest date on any sheet' },
      { key: 'since', label: 'Sets since the bid', value: '5', sub: 'of 6, since B9001 was sent Jun 12, 2025' },
      { key: 'newest', label: 'Newest set', value: 'Oct 30, 2026', sub: 'ZZ Building B · came 17 days ago' },
      { key: 'crew', label: 'Days on site', value: '6', sub: 'by the clock, first on Sep 8, 2025' },
    ])
  })

  it('lists every mark as a dated line, oldest first, with today last', () => {
    expect(at(model.rows, 0)).toMatchObject({ ymd: '2025-05-20', lane: 'ZZ Building A', text: 'Issued set', soft: 'the GC' })
    expect(at(model.rows, model.rows.length - 1)).toMatchObject({ today: true, text: 'Today', ymd: '2026-11-16' })
    expect(model.rows.map((r) => r.day)).toEqual([...model.rows.map((r) => r.day)].sort((a, b) => a - b))
    expect(model.rows.find((r) => r.key === 'bid-bid1')).toMatchObject({ bid: true, text: 'B9001 sent', soft: 'priced from plans dated May 20, 2025' })
    expect(model.rows.find((r) => r.key === 'bidout-bid1')?.text).toBe('B9001 won')
    expect(model.rows.find((r) => r.key === 'set-a3')?.text).toBe('Permit set, the set it builds from')
    expect(new Set(model.rows.map((r) => r.key)).size).toBe(model.rows.length)
  })

  it('frames whole months around everything drawn', () => {
    expect(ymdOfDay(model.start)).toBe('2025-05-01')
    expect(ymdOfDay(model.end)).toBe('2026-12-01')
    expect(model.empty).toBe(false)
  })

  it('keys only the marks that are on the chart', () => {
    expect(model.legend.map((l) => l.glyph)).toEqual(['set', 'current', 'undated', 'ours', 'bid', 'bidPlans', 'crew', 'crewOpen', 'tick', 'letter'])
    expect(buildPlansByDate(site({ bids: [], history: [], jobs: [] })).legend.map((l) => l.glyph)).toEqual(['set', 'current', 'undated', 'ours'])
  })

  it('shows each job’s own work days to a reader the clock is closed to', () => {
    const closed = buildPlansByDate(site({ clock: 'closed', jobs: [{ id: 'j1', label: 'J9101', days: null, firstWorkDay: null, lastWorkDay: '2025-10-06' }] }))
    const crew = at(closed.lanes, 4)
    expect(crew.sub).toBe('each job’s work days')
    expect(crew.spans).toHaveLength(1)
    expect(at(crew.spans, 0)).toMatchObject({ glyph: 'crewOpen', tip: 'J9101 · last work day Oct 6, 2025' })
    expect(at(closed.figures, 3)).toEqual({ key: 'crew', label: 'Last on site', value: 'Oct 6, 2025', sub: 'J9101 · 406 days ago' })
    expect(plansByDateCrewNote('closed')).toContain('each job’s own work days')
    expect(plansByDateCrewNote('read')).toBeNull()
  })

  it('draws no crew bar while the clock is still out', () => {
    const reading = buildPlansByDate(site({ clock: 'reading' }))
    expect(at(reading.lanes, 4).spans).toEqual([])
    expect(at(reading.lanes, 4).sub).toBe('reading the clock…')
  })

  it('counts every set when no bid has been sent, and says so', () => {
    const none = buildPlansByDate(site({ bids: [] }))
    expect(at(none.figures, 1)).toEqual({ key: 'since', label: 'Sets', value: '6', sub: 'on 3 parts · no bid sent yet' })
    expect(at(none.lanes, 0).sub).toBe('none sent yet')
  })

  it('is empty when nothing but today has a date', () => {
    const empty = buildPlansByDate(site({ parts: [part('pA', 'ZZ Building A', 1, null)], sets: [], bids: [], jobs: [], history: [] }))
    expect(empty.empty).toBe(true)
    expect(empty.figures.map((f) => f.value)).toEqual(['None yet', '0', 'None yet', 'None yet'])
    expect(empty.rows).toHaveLength(1)
  })
})

describe('a bid’s schedule', () => {
  const withSchedule = (over: Partial<PlansByDateInput['bids'][number]>, today = '2026-11-16') =>
    buildPlansByDate(site({ today, bids: [{ id: 'bid1', label: 'B9001', sent: '2025-06-12', plansDated: null, outcome: 'won', outcomeAt: null, scheduleStart: '2025-07-01', scheduleEnd: '2026-12-31', scheduleNoEnd: false, ...over }] }))

  it('draws no Schedule lane for a bid with no start', () => {
    expect(buildPlansByDate(site()).lanes.some((l) => l.kind === 'schedule')).toBe(false)
    expect(at(buildPlansByDate(site()).figures, 0).key).toBe('first')
  })

  it('draws a lane from the typed start to the typed end, under the bids, and counts the days left', () => {
    const model = withSchedule({})
    expect(model.lanes.map((l) => l.kind).slice(0, 2)).toEqual(['bids', 'schedule'])
    const lane = at(model.lanes, 1)
    expect([lane.label, lane.sub]).toEqual(['Schedule', 'B9001 · 45 days left'])
    expect(lane.spans).toHaveLength(1)
    expect(at(lane.spans, 0)).toMatchObject({ glyph: 'schedule', tip: 'B9001’s schedule · Jul 1, 2025 to Dec 31, 2026 · 45 days left', startWords: 'starts Jul 1, 2025', endWords: 'ends Dec 31, 2026' })
    expect(ymdOfDay(at(lane.spans, 0).from)).toBe('2025-07-01')
    expect(ymdOfDay(at(lane.spans, 0).to)).toBe('2026-12-31')
    expect(at(model.figures, 0)).toEqual({ key: 'schedule', label: 'Schedule ends', value: 'Dec 31, 2026', sub: '45 days left · 18 months · B9001', over: false, bidId: 'bid1' })
    expect(model.rows.find((r) => r.key === 'schedstart-bid1')).toMatchObject({ ymd: '2025-07-01', lane: 'Schedule', text: 'B9001’s schedule starts', soft: 'ends Dec 31, 2026' })
    expect(model.rows.find((r) => r.key === 'schedend-bid1')).toMatchObject({ ymd: '2026-12-31', text: 'B9001’s schedule ends' })
    // The chart reaches past today to the schedule's end.
    expect(ymdOfDay(model.end)).toBe('2027-02-01')
    expect(model.legend.map((l) => l.glyph)).toContain('schedule')
  })

  it('runs a schedule with no end date off the chart and says so', () => {
    const model = withSchedule({ scheduleEnd: null, scheduleNoEnd: true })
    const span = at(at(model.lanes, 1).spans, 0)
    expect(span).toMatchObject({ open: true, endWords: 'no end date', tip: 'B9001’s schedule · Jul 1, 2025 to no end date' })
    expect(at(model.figures, 0)).toEqual({ key: 'schedule', label: 'Schedule', value: 'No end date', sub: 'started Jul 1, 2025 · B9001', bidId: 'bid1' })
    expect(model.rows.some((r) => r.key === 'schedend-bid1')).toBe(false)
    const layout = layoutPlansByDate(model, 'desktop')
    const bar = layout.marks.find((m) => m.key === 'sched-bid1')
    expect(bar?.prims[0]?.t).toBe('path')
  })

  it('keeps the bar’s end and adds a red stretch to today once the schedule is over', () => {
    const model = withSchedule({ scheduleEnd: '2026-10-13' })
    const lane = at(model.lanes, 1)
    expect(lane.sub).toBe('B9001 · 34 days over')
    expect(lane.spans.map((s) => [s.glyph, ymdOfDay(s.from), ymdOfDay(s.to)])).toEqual([
      ['schedule', '2025-07-01', '2026-10-13'],
      ['scheduleOver', '2026-10-13', '2026-11-16'],
    ])
    expect(at(model.figures, 0)).toMatchObject({ value: 'Oct 13, 2026', over: true })
    expect(at(model.figures, 0).sub).toContain('34 days over')
    expect(model.legend.map((l) => l.glyph)).toContain('scheduleOver')
    expect(plansByDatePrintHtml({ siteName: 'ZZ', customerName: null, model, notes: [], printedAt: 'now', printedBy: null })).toContain('<div class="v" style="color:#b91c1c">Oct 13, 2026</div>')
  })

  it('names the bar’s two ends inside it where it has room, and not on a phone', () => {
    const model = withSchedule({})
    const words = (variant: 'desktop' | 'phone') => layoutPlansByDate(model, variant).labels.flatMap((p) => (p.t === 'text' && p.cls === 'barWord' ? [p.text] : []))
    expect(words('desktop')).toEqual(['ends Dec 31, 2026', 'starts Jul 1, 2025'])
    expect(words('phone')).toEqual([])
    const short = layoutPlansByDate(withSchedule({ scheduleStart: '2026-10-01', scheduleEnd: '2026-10-20' }), 'desktop').labels.filter((p) => p.cls === 'barWord')
    expect(short).toEqual([])
  })

  it('treats an end before the start as no end, and a start that is not a day as no schedule', () => {
    expect(at(at(withSchedule({ scheduleEnd: '2025-01-01' }).lanes, 1).spans, 0).open).toBe(true)
    expect(withSchedule({ scheduleStart: 'soon' }).lanes.some((l) => l.kind === 'schedule')).toBe(false)
  })

  it('says a schedule has not started yet', () => {
    expect(at(withSchedule({ scheduleStart: '2026-11-28', scheduleEnd: '2027-06-01' }).lanes, 1).sub).toBe('B9001 · starts in 12 days')
  })
})

describe('plansByDateTicks', () => {
  const start = dayOfYmd('2025-05-01') as number
  const end = dayOfYmd('2026-12-01') as number
  it('labels every month when there is room and thins them when there is not', () => {
    const wide = plansByDateTicks(start, end, 812)
    expect(wide).toHaveLength(20)
    expect(wide.every((t) => t.labelled)).toBe(true)
    expect(at(wide, 0)).toMatchObject({ month: 5, year: '2025', first: true })
    const narrow = plansByDateTicks(start, end, 344)
    expect(narrow.filter((t) => t.labelled).map((t) => t.month)).toEqual([5, 7, 9, 11, 1, 3, 5, 7, 9, 11])
  })
})

describe('placePlansByDateLabels', () => {
  const item = (x: number, label: string, priority: number, strong = false) => ({ x, label, priority, strong })
  it('puts the first name above its mark, a neighbour below, and leaves a third to the hover', () => {
    const a = item(100, 'Permit set', 3, true)
    const b = item(110, 'Addendum 1', 2)
    const c = item(120, 'Bulletin 2', 1)
    const spots = placePlansByDateLabels([c, b, a], 0, 800)
    expect(spots.get(a)?.slot).toBe('above')
    expect(spots.get(b)?.slot).toBe('below')
    expect(spots.has(c)).toBe(false)
  })
  it('nudges a name inside the plot’s edges', () => {
    const edge = item(2, 'Issued set', 1)
    const far = item(799, 'Revised set', 1)
    const spots = placePlansByDateLabels([edge, far], 0, 800)
    expect((spots.get(edge)?.cx as number) - (10 * 5.6 + 6) / 2).toBeGreaterThanOrEqual(0)
    expect((spots.get(far)?.cx as number) + (11 * 5.6 + 6) / 2).toBeLessThanOrEqual(800)
  })
})

describe('layoutPlansByDate', () => {
  const model = buildPlansByDate(site())

  it('gives every mark and bar a shape with its hover line', () => {
    const layout = layoutPlansByDate(model, 'desktop')
    const marks = model.lanes.reduce((n, l) => n + l.marks.length + l.spans.length, 0)
    expect(layout.marks).toHaveLength(marks)
    expect(layout.marks.every((m) => m.tip.length > 0 && m.prims.length > 0)).toBe(true)
    expect(new Set(layout.marks.map((m) => m.key)).size).toBe(marks)
    expect(layout.width).toBe(980)
    expect(layout.height).toBe(46 + 6 * 50 + 6)
  })

  it('keeps every shape inside the drawing', () => {
    for (const variant of ['desktop', 'phone', 'paper'] as const) {
      const layout = layoutPlansByDate(model, variant)
      for (const m of layout.marks) {
        expect(m.cx).toBeGreaterThanOrEqual(0)
        expect(m.cx).toBeLessThanOrEqual(layout.width)
      }
      for (const p of layout.labels) if (p.t === 'text') expect(p.x).toBeLessThanOrEqual(layout.width)
    }
  })

  it('draws every word whole inside the chart, at every width, with a schedule on it', () => {
    const scheduled = buildPlansByDate(site({ bids: [{ id: 'bid1', label: 'B9001', sent: '2025-06-12', plansDated: '2025-05-20', outcome: 'won', outcomeAt: null, scheduleStart: '2025-07-01', scheduleEnd: '2026-12-31' }] }))
    for (const [variant, measured] of [['phone', 300], ['phone', 358], ['desktop', 640], ['desktop', 980], ['desktop', 1202], ['desktop', 1600], ['paper', undefined]] as const) {
      const layout = layoutPlansByDate(scheduled, variant, measured)
      for (const p of [...layout.back, ...layout.labels]) {
        if (p.t !== 'text') continue
        // A generous width for a word at this size: no glyph here is wider.
        const w = (p.text.length + (p.tail ? p.tail.length + 1 : 0)) * 6.4
        const left = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - w : p.x - w / 2
        expect(left, `${variant} ${measured}: ${p.text}`).toBeGreaterThanOrEqual(-1)
        if (p.cls !== 'laneWord' && p.cls !== 'subWord') expect(left + w, `${variant} ${measured}: ${p.text}`).toBeLessThanOrEqual(layout.width + 1)
      }
    }
  })

  it('names the lanes in a gutter on a desktop and over each lane on a phone', () => {
    const desk = layoutPlansByDate(model, 'desktop').back.filter((p) => p.t === 'text' && p.cls === 'laneWord')
    expect(desk.map((p) => (p.t === 'text' ? [p.text, p.tail] : null))).toContainEqual(['ZZ Building A', undefined])
    const phone = layoutPlansByDate(model, 'phone').back.filter((p) => p.t === 'text' && p.cls === 'laneWord')
    expect(phone.map((p) => (p.t === 'text' ? [p.text, p.tail] : null))).toContainEqual(['ZZ Building A', '4 sets'])
  })

  it('names only the bids, the letters and the sets being built from on a phone', () => {
    const words = layoutPlansByDate(model, 'phone').labels.map((p) => (p.t === 'text' ? p.text : ''))
    expect(words.sort()).toEqual(['B9001', 'B9044', 'Construction set', 'Letter', 'Permit set'])
    const desk = layoutPlansByDate(model, 'desktop').labels.map((p) => (p.t === 'text' ? p.text : ''))
    expect(desk).toContain('Addendum 1')
  })

  it('lays itself out at the width the screen has, within sane ends, and paper keeps its own', () => {
    expect(layoutPlansByDate(model, 'desktop', 720).width).toBe(720)
    expect(layoutPlansByDate(model, 'desktop', 4000).width).toBe(1600)
    expect(layoutPlansByDate(model, 'phone', 120).width).toBe(280)
    expect(layoutPlansByDate(model, 'paper', 720).width).toBe(980)
    // Less room, fewer names on the chart: the rest stay in the hover and the list.
    const wide = layoutPlansByDate(model, 'desktop', 1400).labels.length
    const tight = layoutPlansByDate(model, 'desktop', 640).labels.length
    expect(tight).toBeLessThanOrEqual(wide)
    for (const p of layoutPlansByDate(model, 'desktop', 640).labels) if (p.t === 'text') expect(p.x).toBeLessThanOrEqual(640)
  })

  it('draws a burst of sets too close to tell apart as one bar with its count, and names them in its line', () => {
    const burst = buildPlansByDate(
      site({
        sets: [
          set('a1', 'pA', 'Issued set', 'issued', '2025-05-20', '2025-05-22'),
          set('k1', 'pA', 'Bulletin 1', 'bulletin', '2026-06-01', '2026-06-01'),
          set('k2', 'pA', 'Bulletin 2', 'bulletin', '2026-06-08', '2026-06-08'),
          set('k3', 'pA', 'Bulletin 3', 'bulletin', '2026-06-15', '2026-06-15'),
          set('k4', 'pA', 'Bulletin 4', 'bulletin', '2026-06-22', '2026-06-22'),
        ],
        parts: [part('pA', 'ZZ Building A', 1, null)],
      }),
    )
    const tight = layoutPlansByDate(burst, 'phone')
    expect(tight.clusters).toBe(1)
    const bar = tight.marks.find((m) => m.key === 'cluster-set-k1')
    expect(bar?.tip).toBe('4 sets · Jun 1 to Jun 22, 2026 · Bulletin 1, Bulletin 2, Bulletin 3 and 1 more')
    expect(tight.marks.some((m) => m.key === 'set-k2')).toBe(false)
    expect(tight.marks.some((m) => m.key === 'set-a1')).toBe(true)
    expect(tight.labels.some((p) => p.t === 'text' && p.text === '4 sets')).toBe(true)
    // With room to tell them apart, each is its own dot again.
    const roomy = layoutPlansByDate(burst, 'desktop', 1600)
    expect(roomy.clusters).toBe(0)
    expect(roomy.marks.some((m) => m.key === 'set-k2')).toBe(true)
  })

  it('never folds the set a part builds from into a bar', () => {
    const burst = buildPlansByDate(
      site({
        sets: [
          set('k1', 'pA', 'Bulletin 1', 'bulletin', '2026-06-01', '2026-06-01'),
          set('k2', 'pA', 'Permit set', 'permit', '2026-06-03', '2026-06-03'),
          set('k3', 'pA', 'Bulletin 3', 'bulletin', '2026-06-05', '2026-06-05'),
          set('k4', 'pA', 'Bulletin 4', 'bulletin', '2026-06-08', '2026-06-08'),
        ],
        parts: [part('pA', 'ZZ Building A', 1, 'k2')],
      }),
    )
    const tight = layoutPlansByDate(burst, 'phone')
    expect(tight.clusters).toBe(0)
    expect(tight.marks.some((m) => m.key === 'set-k2')).toBe(true)
  })

  it('drops the word Letter from each flag once a lane has more than three', () => {
    const letters = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, happenedAt: `2026-0${1 + i}-10T12:00:00Z`, source: 'letter' as const, body: 'A made-up letter.' }))
    const few = layoutPlansByDate(buildPlansByDate(site({ history: letters(3) })), 'desktop')
    expect(few.labels.filter((p) => p.t === 'text' && p.text === 'Letter')).toHaveLength(3)
    const many = layoutPlansByDate(buildPlansByDate(site({ history: letters(4) })), 'desktop')
    expect(many.labels.filter((p) => p.t === 'text' && p.text === 'Letter')).toHaveLength(0)
  })

  it('draws today’s line and the split between the two lanes', () => {
    const layout = layoutPlansByDate(model, 'desktop')
    expect(layout.back.some((p) => p.t === 'text' && p.text === 'Today · Nov 16')).toBe(true)
    const link = layout.back.find((p) => p.cls === 'link')
    expect(link && link.t === 'line' ? link.y2 - link.y1 : 0).toBe(50)
  })
})

describe('plansByDateGlyph', () => {
  it('gives each kind of mark its own shape', () => {
    const shapes = (['set', 'current', 'undated', 'ours', 'bid', 'bidPlans', 'crew', 'crewOpen', 'tick', 'letter', 'today', 'cluster'] as const).map((g) => JSON.stringify(plansByDateGlyph(g).prims))
    expect(new Set(shapes).size).toBe(shapes.length)
  })
})

describe('plansByDatePrintHtml', () => {
  const model = buildPlansByDate(site())
  const html = plansByDatePrintHtml({ siteName: 'ZZ Test <Ridge>', customerName: 'ZZ Test Builders', model, notes: ['1 bid has no sent day, so it is not on the chart: B9050.'], printedAt: 'Nov 16, 2026, 9:14 AM', printedBy: 'ZZ Test Person' })

  it('is one landscape page with the site, the figures, the chart, the key and the list', () => {
    expect(html).toContain('@page { size: landscape;')
    expect(html).toContain('<h1>ZZ Test &lt;Ridge&gt; · plans by date</h1>')
    expect(html).toContain('ZZ Test Builders')
    expect(html).toContain('Sets since the bid')
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 ')
    expect(html).toContain('the set a part builds from')
    expect(html).toContain('1 bid has no sent day')
    expect(html).toContain('Printed Nov 16, 2026, 9:14 AM by ZZ Test Person')
  })

  it('lists every dated line and leaves today’s row off', () => {
    expect(html).toContain('<span class="d">May 20, 2025</span><span>ZZ Building A: Issued set <em>· the GC</em></span>')
    expect((html.match(/<span class="d">/g) ?? []).length).toBe(model.rows.length - 1)
  })

  it('wears paper’s colours, never a theme token', () => {
    expect(html).not.toContain('var(--')
    expect(html).toContain('fill="#eb6834"')
  })
})
