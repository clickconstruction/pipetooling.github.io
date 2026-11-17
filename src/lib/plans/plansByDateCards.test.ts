import { describe, expect, it } from 'vitest'
import { buildPlansByDate, type PlansByDateInput } from './plansByDate'
import { PBD_CARD_ROWS, PBD_JOB_DOOR_WORDS, buildPlansByDateCards, plansByDateClusterCard, type PbdCaps, type PbdCard } from './plansByDateCards'

const toYmd = (raw: string | null | undefined) => (raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)
const office: PbdCaps = { canWritePlans: true, canOpenJobs: true, canKeep: true, canAsk: true }
const estimator: PbdCaps = { canWritePlans: true, canOpenJobs: false, canKeep: true, canAsk: true }

const part = (id: string, name: string, position: number, current: string | null) => ({ id, name, position, created_at: `2025-05-0${position}T00:00:00Z`, current_set_id: current })
const set = (id: string, partId: string, name: string, kind: string, dated: string | null, came: string, more: { source?: string; replaces?: string; link?: string; memo?: string; changes?: string; by?: string } = {}) => ({
  id,
  part_id: partId,
  name,
  kind,
  source: more.source ?? 'gc',
  dated,
  came_at: `${came}T15:00:00Z`,
  replaces_set_id: more.replaces ?? null,
  link: more.link ?? '',
  memo: more.memo ?? '',
  changes: more.changes ?? '',
  created_by: more.by ?? null,
})

function site(over: Partial<PlansByDateInput> = {}): PlansByDateInput {
  return {
    parts: [part('pA', 'ZZ Building A', 1, 'a3'), part('pB', 'ZZ Building B', 2, 'b1')],
    sets: [
      set('a1', 'pA', 'Issued set', 'issued', '2025-05-20', '2025-05-22', { link: 'https://drive.example/a1' }),
      set('a2', 'pA', 'Addendum 1', 'addendum', '2025-06-30', '2025-07-01', { source: 'architect', memo: 'Moves the riser.', changes: 'Sheet P-201 only.', by: 'u1' }),
      set('a3', 'pA', 'Permit set', 'permit', '2026-05-08', '2026-05-12', { link: 'https://drive.example/a3' }),
      set('a4', 'pA', 'As-built', 'as_built', '2026-09-22', '2026-09-22', { source: 'ours' }),
      set('b1', 'pB', 'Revised set', 'revised', '2025-11-04', '2025-11-06', { source: 'architect', replaces: 'a2' }),
    ],
    bids: [
      { id: 'bid1', label: 'B9001', name: 'ZZ Ridge plumbing', sent: '2025-06-12', plansDated: '2025-05-20', outcome: 'won', outcomeAt: '2025-07-30' },
      { id: 'bid2', label: 'B9050', sent: null, plansDated: null, outcome: null, outcomeAt: null },
    ],
    jobs: [
      { id: 'j1', label: 'J9101', name: 'ZZ rough-in', partId: 'pA', days: ['2025-09-08', '2025-09-09', '2025-09-10'], firstWorkDay: null, lastWorkDay: '2025-09-10' },
      { id: 'j2', label: 'J9103', name: 'ZZ top-out', partId: 'pA', days: ['2025-09-09'], firstWorkDay: null, lastWorkDay: '2025-09-09' },
      { id: 'j3', label: 'J9102', days: [], firstWorkDay: '2025-08-04', lastWorkDay: '2025-08-22' },
    ],
    history: [{ id: 'h1', happenedAt: '2026-07-14T16:00:00Z', source: 'letter', body: 'Notice of delay sent to the GC', byName: 'ZZ Test Person', about: 'J9101', bodyChars: 900 }],
    names: { u1: 'ZZ Test Person' },
    clock: 'read',
    today: '2026-11-16',
    toYmd,
    ...over,
  }
}

function cardsFor(input: PlansByDateInput, caps: PbdCaps) {
  const model = buildPlansByDate(input)
  return { model, cards: buildPlansByDateCards(input, model, caps) }
}
const need = (cards: ReadonlyMap<string, PbdCard>, key: string): PbdCard => {
  const c = cards.get(key)
  if (!c) throw new Error(`no card ${key}`)
  return c
}

describe('buildPlansByDateCards', () => {
  const { model, cards } = cardsFor(site(), office)

  it('gives every mark, bar and line of the list a card', () => {
    for (const lane of model.lanes) {
      for (const m of lane.marks) expect(cards.has(m.key), m.key).toBe(true)
      for (const s of lane.spans) expect(cards.has(s.key), s.key).toBe(true)
      expect(cards.has(`lane-${lane.key}`), lane.key).toBe(true)
    }
    for (const r of model.rows) expect(cards.has(r.key), r.key).toBe(true)
    for (const f of model.figures) expect(cards.has(`figure-${f.key}`)).toBe(true)
  })

  it('says what a set is and offers its link, the switch, its part and a question', () => {
    const c = need(cards, 'set-a1')
    expect(c.title).toBe('Issued set')
    expect(c.kicker).toBe('ZZ Building A · the GC')
    expect(c.facts).toEqual([
      { label: 'On the sheets', value: 'May 20, 2025' },
      { label: 'Came', value: 'May 22, 2025 · 543 days ago' },
    ])
    expect(c.actions.map((a) => a.kind)).toEqual(['open-link', 'build-from', 'set-sheets', 'show-part', 'ask'])
    const build = c.actions.find((a) => a.kind === 'build-from')
    expect(build && build.kind === 'build-from' ? [build.message, build.confirmLabel] : null).toEqual(['Build ZZ Building A from Issued set? Every job on ZZ Building A follows the set its part builds from.', 'Build from Issued set'])
  })

  it('carries a set’s memo, what changed and who added it, and says when it has no link', () => {
    const c = need(cards, 'set-a2')
    expect(c.facts.slice(2)).toEqual([
      { label: 'Added by', value: 'ZZ Test Person' },
      { label: 'Memo', value: 'Moves the riser.' },
      { label: 'What changed', value: 'Sheet P-201 only.' },
    ])
    expect(c.actions.some((a) => a.kind === 'open-link')).toBe(false)
    expect(c.quiet).toBe('No link on this set yet.')
  })

  it('never offers to build from the set already built from, or from one of ours', () => {
    expect(need(cards, 'set-a3').kicker).toBe('ZZ Building A · the GC · the set it builds from')
    expect(need(cards, 'set-a3').actions.some((a) => a.kind === 'build-from')).toBe(false)
    expect(need(cards, 'set-a4').actions.some((a) => a.kind === 'build-from')).toBe(false)
  })

  it('names the set a split replaced and its part', () => {
    expect(need(cards, 'set-b1').facts).toContainEqual({ label: 'Replaces', value: 'Addendum 1 on ZZ Building A' })
  })

  it('offers no write to a reader who cannot write plans', () => {
    const read = cardsFor(site(), { canWritePlans: false, canOpenJobs: false, canKeep: false, canAsk: false }).cards
    expect(need(read, 'set-a1').actions.map((a) => a.kind)).toEqual(['open-link', 'show-part'])
    expect(need(read, 'lane-pA').actions.map((a) => a.kind)).toEqual(['show-part'])
    expect(need(read, 'today').actions).toEqual([])
  })

  it('says how a bid ended, counts the sets since it was sent and leads to each', () => {
    const c = need(cards, 'bid-bid1')
    expect(c.title).toBe('B9001 · ZZ Ridge plumbing')
    expect(c.kicker).toBe('won')
    expect(c.facts).toEqual([
      { label: 'Sent', value: 'Jun 12, 2025 · 522 days ago' },
      { label: 'Priced from plans dated', value: 'May 20, 2025' },
      { label: 'Won', value: 'Jul 30, 2025' },
      { label: 'Sets since it was sent', value: '3 of 4' },
    ])
    expect(c.rows.map((r) => [r.text, r.to])).toEqual([
      ['ZZ Building A: Permit set, the set it builds from', 'set-a3'],
      ['ZZ Building B: Revised set, the set it builds from', 'set-b1'],
      ['ZZ Building A: Addendum 1', 'set-a2'],
    ])
    expect(c.actions).toEqual([{ kind: 'open-bid', label: 'Open the bid', bidId: 'bid1' }])
    expect(need(cards, 'bidout-bid1').title).toBe(c.title)
  })

  it('lists the jobs on a crew bar with their own days, most days first, each leading to the job', () => {
    const bar = model.lanes.find((l) => l.kind === 'crew')?.spans.find((s) => s.glyph === 'crew')
    const c = need(cards, bar?.key ?? '')
    expect(c.kicker).toBe('Sep 8 to Sep 10, 2025 · 3 days')
    expect(c.rows.map((r) => [r.text, r.soft, r.to])).toEqual([
      ['J9101 · ZZ rough-in', '3 days', 'job-j1'],
      ['J9103 · ZZ top-out', '1 day', 'job-j2'],
    ])
    expect(need(cards, 'job-j1').facts).toEqual([
      { label: 'Days by the clock', value: '3' },
      { label: 'Last work day', value: 'Sep 10, 2025 · 432 days ago' },
      { label: 'Builds from', value: 'ZZ Building A' },
    ])
    expect(need(cards, 'job-j1').actions).toEqual([{ kind: 'open-job', label: 'Open the job', jobId: 'j1' }])
  })

  it('tells an estimator why a job does not open, with no dead press', () => {
    const c = need(cardsFor(site(), estimator).cards, 'job-j3')
    expect(c.actions).toEqual([])
    expect(c.quiet).toBe(PBD_JOB_DOOR_WORDS)
    expect(c.kicker).toBe('first work day to last, the days between are not on the clock')
  })

  it('shows a kept line’s words, who kept it and what it is about, and offers the whole of it', () => {
    const c = need(cards, 'hist-h1')
    expect(c.title).toBe('Letter')
    expect(c.kicker).toBe('Jul 14, 2026 · kept by ZZ Test Person · about J9101')
    expect(c.words).toBe('Notice of delay sent to the GC…')
    expect(c.actions).toEqual([{ kind: 'read-line', label: 'Read the whole line', entryId: 'h1' }])
  })

  it('answers a lane’s name with what is on it and the presses for it', () => {
    const a = need(cards, 'lane-pA')
    expect(a.title).toBe('ZZ Building A')
    expect(a.facts).toEqual([
      { label: 'Builds from', value: 'Permit set · May 8, 2026' },
      { label: 'The jobs on it', value: 'J9101, J9103' },
    ])
    expect(a.rows.map((r) => r.text)).toEqual(['As-built', 'Permit set, the set it builds from', 'Addendum 1', 'Issued set'])
    expect(a.actions.map((x) => x.kind)).toEqual(['new-set', 'show-part'])
    expect(need(cards, 'lane-bids').kicker).toBe('1 sent · 1 with no sent day: B9050')
    expect(need(cards, 'lane-history').actions).toEqual([{ kind: 'keep', label: 'Write a line' }])
  })

  it('puts the items behind a figure on its card', () => {
    const since = need(cards, 'figure-since')
    expect(since.kicker).toBe('3 · of 4, since B9001 was sent Jun 12, 2025')
    expect(since.rows.map((r) => r.to)).toEqual(['set-a3', 'set-b1', 'set-a2'])
    expect(since.quiet).toContain('as-builts are not counted')
    expect(need(cards, 'figure-first').rows.map((r) => r.to)).toEqual(['set-a1'])
    expect(need(cards, 'figure-newest').rows.map((r) => r.to)).toEqual(['set-a3'])
  })

  it('answers today with the newest set, the last day on site and the press to write a line', () => {
    const c = need(cards, 'today')
    expect(c.kicker).toBe('Nov 16, 2026')
    expect(c.facts).toEqual([
      { label: 'Newest set', value: 'Permit set on ZZ Building A · 192 days ago' },
      { label: 'Last on site', value: 'Sep 10, 2025 · 432 days ago' },
    ])
    expect(c.actions).toEqual([{ kind: 'keep', label: 'Write a line' }])
  })

  it('lists eight rows and counts the rest', () => {
    const many = Array.from({ length: 12 }, (_, i) => set(`m${i}`, 'pA', `Bulletin ${i + 1}`, 'bulletin', `2026-07-${String(i + 1).padStart(2, '0')}`, '2026-07-20'))
    const lane = need(cardsFor(site({ sets: many }), office).cards, 'lane-pA')
    expect(lane.rows).toHaveLength(PBD_CARD_ROWS)
    expect(lane.rowsMore).toBe(4)
    expect(lane.rows[0]?.text).toBe('Bulletin 12')
  })
})

describe('a bid’s schedule', () => {
  const editor: PbdCaps = { ...office, canEditBids: true }
  const scheduled = (caps: PbdCaps) => cardsFor(site({ bids: [{ id: 'bid1', label: 'B9001', sent: '2025-06-12', plansDated: null, outcome: 'won', outcomeAt: null, scheduleStart: '2025-07-01', scheduleEnd: '2026-12-31' }] }), caps).cards

  it('gives the bar, its lane’s name and its two lines of the list one card', () => {
    const cards = scheduled(editor)
    const c = need(cards, 'sched-bid1')
    expect(c.title).toBe('B9001’s schedule')
    expect(c.kicker).toBe('45 days left')
    expect(c.facts).toEqual([
      { label: 'Starts', value: 'Jul 1, 2025' },
      { label: 'Ends', value: 'Dec 31, 2026' },
      { label: 'Length', value: '18 months' },
    ])
    expect(c.actions).toEqual([
      { kind: 'set-schedule', label: 'Change the schedule', bidId: 'bid1' },
      { kind: 'open-bid', label: 'Open the bid', bidId: 'bid1' },
    ])
    for (const key of ['lane-sched-bid1', 'schedstart-bid1', 'schedend-bid1']) expect(need(cards, key).title).toBe(c.title)
    expect(need(cards, 'figure-schedule').rows.map((r) => r.to)).toEqual(['schedstart-bid1', 'schedend-bid1'])
  })

  it('offers Set the schedule on a bid with none, to whoever can edit a bid and to nobody else', () => {
    const set = need(cardsFor(site(), editor).cards, 'bid-bid1').actions
    expect(set).toContainEqual({ kind: 'set-schedule', label: 'Set the schedule', bidId: 'bid1' })
    expect(need(cardsFor(site(), office).cards, 'bid-bid1').actions.some((a) => a.kind === 'set-schedule')).toBe(false)
    expect(need(scheduled(office), 'sched-bid1').actions).toEqual([{ kind: 'open-bid', label: 'Open the bid', bidId: 'bid1' }])
  })
})

describe('sheets in hand', () => {
  const counted = (over: Record<string, number | null> = {}) =>
    site({
      sets: [
        { ...set('a1', 'pA', 'Issued set', 'issued', '2025-05-20', '2025-05-22'), sheet_count: 64 },
        { ...set('a3', 'pA', 'Permit set', 'permit', '2026-05-08', '2026-05-12'), sheet_count: 'a3' in over ? over.a3 : 118 },
        { ...set('b1', 'pB', 'Revised set', 'revised', '2025-11-04', '2025-11-06'), sheet_count: 'b1' in over ? over.b1 : 94 },
      ],
    })

  it('shows a set’s count on its card and offers to change it, or to set it on a set nobody counted', () => {
    const cards = cardsFor(counted({ b1: null }), office).cards
    expect(need(cards, 'set-a3').facts).toContainEqual({ label: 'Sheets', value: '118 sheets' })
    expect(need(cards, 'set-a3').actions).toContainEqual({ kind: 'set-sheets', label: 'Change the sheet count', setId: 'a3', setName: 'Permit set', count: 118 })
    expect(need(cards, 'set-b1').actions).toContainEqual({ kind: 'set-sheets', label: 'Set the sheet count', setId: 'b1', setName: 'Revised set', count: null })
    expect(need(cards, 'set-b1').facts.some((f) => f.label === 'Sheets')).toBe(false)
  })

  it('adds the sets being built from, against what was in hand when the bid was sent', () => {
    const { model, cards } = cardsFor(counted(), office)
    const figure = model.figures.find((f) => f.key === 'sheets')
    // Now: Permit set 118 + Revised set 94. At the bid (Jun 12, 2025): the Issued set, 64.
    expect(figure).toEqual({ key: 'sheets', label: 'Sheets in hand', value: '212', sub: '64 at the bid' })
    expect(need(cards, 'figure-sheets').rows.map((r) => [r.to, r.soft])).toEqual([
      ['set-a3', '118 sheets'],
      ['set-b1', '94 sheets'],
    ])
  })

  it('says how many of the sets being built from nobody has counted', () => {
    const { model, cards } = cardsFor(counted({ b1: null }), office)
    expect(model.figures.find((f) => f.key === 'sheets')?.sub).toBe('64 at the bid · 1 set not counted')
    expect(need(cards, 'figure-sheets').rows.map((r) => r.soft)).toEqual(['118 sheets', 'not counted yet'])
  })

  it('draws no sheets figure until someone has counted a set, and offers no press to a reader who cannot write plans', () => {
    expect(cardsFor(site(), office).model.figures.some((f) => f.key === 'sheets')).toBe(false)
    const read = cardsFor(counted(), { canWritePlans: false, canOpenJobs: false, canKeep: false, canAsk: false }).cards
    expect(need(read, 'set-a3').actions.some((a) => a.kind === 'set-sheets')).toBe(false)
    expect(need(read, 'set-a3').facts).toContainEqual({ label: 'Sheets', value: '118 sheets' })
  })
})

describe('plansByDateClusterCard', () => {
  it('lists a burst bar’s sets newest first, each leading to its own card', () => {
    const { model, cards } = cardsFor(site(), office)
    const c = plansByDateClusterCard('cluster-set-a1', ['set-a1', 'set-a2', 'set-a3'], cards, model)
    expect(c.title).toBe('3 sets')
    expect(c.kicker).toBe('ZZ Building A · May 20, 2025 to May 8, 2026')
    expect(c.rows.map((r) => [r.text, r.to])).toEqual([
      ['Permit set, the set it builds from', 'set-a3'],
      ['Addendum 1', 'set-a2'],
      ['Issued set', 'set-a1'],
    ])
  })
})
