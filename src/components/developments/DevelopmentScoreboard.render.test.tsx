// @vitest-environment jsdom
/**
 * The Money look's Scoreboard (punch list #250, PR 1): the nine tiles as the column heads with the
 * site's totals, a row per job folded to the money three and opened to the nine, the jobs with
 * nothing on them folded under one line, a tile press that sorts, the lead's three-column board,
 * the phone's cards and the empty state. Made-up names only.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { buildScoreboard, scoreboardColumnsFor, scoreboardMembers, SCOREBOARD_DEFAULT_SORT } from '../../lib/developments/scoreboard'
import { scoreboardPartGroups, scoreboardPeopleCut, type ScoreboardCut, type ScoreboardWindowKey } from '../../lib/developments/scoreboardCuts'
import type { MemberJob } from '../../lib/developments/overview'
import type { SiteCostsRead } from '../../lib/developments/siteCosts'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import { DevelopmentScoreboard } from './DevelopmentScoreboard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// The middle widths (v2.6457): the board's own narrow query, off unless a test turns it on.
const narrowState = vi.hoisted(() => ({ on: false }))
vi.mock('../../hooks/useMatchMedia', () => ({ useMatchMedia: () => narrowState.on }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  narrowState.on = false
})

function job(over: Partial<MemberJob> & { id: string; click_number: string }): MemberJob {
  return {
    hcp_number: null, job_name: `Job ${over.click_number}`, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'd1', bid_id: null,
    status: 'working', revenue: 0, payments_made: 0, pct_complete: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, ...over,
  } as MemberJob
}
const jobs = [
  job({ id: 'j1', click_number: '612', job_name: 'Rough in: main house', status: 'paid', revenue: 241431 }),
  job({ id: 'j2', click_number: '583', job_name: 'Gas line trenching', status: 'working', revenue: 16000, pct_complete: 20 }),
  job({ id: 'j3', click_number: '953', job_name: 'Fire sprinkler risers', status: 'waiting', revenue: 0 }),
]
const labor: SiteLaborRead = { state: 'read', labor: { byJobId: new Map([['j1', { jobId: 'j1', hours: 1842, costUsd: 55410, days: 118, people: [] }], ['j2', { jobId: 'j2', hours: 54, costUsd: 1296, days: 5, people: [] }]]), siteDays: 120, people: 4, daysKnown: true } }
const costs: SiteCostsRead = {
  state: 'read',
  byJobId: new Map([
    ['j1', { jobId: 'j1', subLabor: 18400, parts: { supplyInvoices: 53770, cardCharges: 9100, tallyParts: 0, otherCharges: 0 }, total: 81270, breakdown: { subs: [{ name: 'Reyes Excavating', usd: 18400, sheets: 2 }], suppliers: [{ name: 'Ferguson', usd: 41120, invoices: 11 }, { name: 'Moore Supply', usd: 12650, invoices: 4 }], cardLines: [{ txId: 'tx1', usd: 9100 }], tallyLines: 0, otherLines: 0 } }],
    ['j2', { jobId: 'j2', subLabor: 0, parts: { supplyInvoices: 1480, cardCharges: 0, tallyParts: 0, otherCharges: 0 }, total: 1480, breakdown: { subs: [], suppliers: [{ name: 'Ferguson', usd: 1480, invoices: 1 }], cardLines: [], tallyLines: 0, otherLines: 0 } }],
  ]),
}
const overhead = { state: 'read' as const, byJobId: new Map([['j1', { usd: 14920, days: 118 }], ['j2', { usd: 610, days: 5 }]]) }
const label = (j: MemberJob) => `JP${j.click_number}`
const head = { name: 'Harlow Ranch', line: 'Ridgeway Builders · 3 jobs · 2 bids', small: '$1,000 left to collect' }

function mount(over: { phone?: boolean; seesCosts?: boolean; jobs?: MemberJob[]; sort?: { key: 'earned' | 'profit'; desc: boolean }; print?: { onPress: () => void; note: string | null } | null } = {}) {
  const onSort = vi.fn()
  const openJob = vi.fn()
  const model = buildScoreboard({ jobs: over.jobs ?? jobs, invoices: [], jobLabel: label, labor, costs, overhead, sort: over.sort ?? SCOREBOARD_DEFAULT_SORT })
  const columns = scoreboardColumnsFor(over.seesCosts ?? true)
  const r = renderWithProviders(<DevelopmentScoreboard model={model} columns={columns} phone={over.phone ?? false} onSort={onSort} openJob={openJob} head={head} print={over.print ?? null} />)
  return { ...r, onSort, openJob, model }
}

describe('DevelopmentScoreboard', () => {
  it('draws the nine tiles with the site’s totals as the column heads, and the flag block', () => {
    mount()
    const table = screen.getByTestId('scoreboard-table')
    for (const l of ['Hours', 'Days', 'Labor', 'Subs', 'Parts', 'Overhead', 'Earned', 'Cost', 'Profit']) expect(within(table).getAllByText(l).length).toBeGreaterThan(0)
    expect(within(table).getByText('Harlow Ranch')).toBeTruthy()
    const earnedTile = screen.getByTestId('scoreboard-tile-earned')
    expect(earnedTile.textContent).toContain('$244,631')
    expect(screen.getByTestId('scoreboard-tile-hours').textContent).toContain('1,896 h')
    expect(screen.getByTestId('scoreboard-tile-days').textContent).toContain('120 d')
  })

  it('a folded row shows the money three; opening it shows the nine', () => {
    mount()
    const row = screen.getByTestId('scoreboard-row-j1')
    expect(row.textContent).toContain('$241,431')
    expect(row.textContent).toContain('$151,600')
    expect(row.textContent).toContain('$89,831')
    expect(row.textContent).not.toContain('1,842 h')
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    const opened = screen.getByTestId('scoreboard-row-j1')
    expect(opened.textContent).toContain('1,842 h')
    expect(opened.textContent).toContain('$55,410')
    expect(opened.textContent).toContain('$14,920')
  })

  it('the jobs with nothing on them fold under one line and open on a press', () => {
    mount()
    expect(screen.queryByTestId('scoreboard-row-j3')).toBeNull()
    expect(screen.getByTestId('scoreboard-fold').textContent).toContain('Nothing on them yet · 1 job')
    fireEvent.click(screen.getByText('Show them'))
    expect(screen.getByTestId('scoreboard-row-j3')).toBeTruthy()
  })

  it('a tile press asks to sort by that column; the sorted tile says so', () => {
    const { onSort } = mount()
    fireEvent.click(screen.getByTestId('scoreboard-tile-profit'))
    expect(onSort).toHaveBeenCalledWith('profit')
    expect(screen.getByTestId('scoreboard-tile-earned').getAttribute('aria-pressed')).toBe('true')
  })

  it('the lead’s board has three columns and no wage or cost anywhere', () => {
    mount({ seesCosts: false })
    const table = screen.getByTestId('scoreboard-table')
    expect(within(table).queryByText('Labor')).toBeNull()
    expect(within(table).queryByText('Cost')).toBeNull()
    expect(table.textContent).not.toContain('$55,410')
    expect(screen.getByTestId('scoreboard-row-j1').textContent).toContain('1,842 h')
  })

  it('on a phone the rows are cards; an open card shows the nine as a grid', () => {
    mount({ phone: true })
    expect(screen.getByTestId('scoreboard-phone')).toBeTruthy()
    const card = screen.getByTestId('scoreboard-card-j2')
    expect(card.textContent).toContain('$3,200')
    expect(card.textContent).not.toContain('54 h')
    fireEvent.click(within(card).getByTestId('scoreboard-open-j2'))
    expect(screen.getByTestId('scoreboard-card-j2').textContent).toContain('54 h')
  })

  it('the print press (v2.6534) sits under the board for a reader given one, with the last press’s note; a reader without one sees no press', () => {
    const onPress = vi.fn()
    mount({ print: { onPress, note: 'The costs are still reading. Press again once the board is in.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Print cost summary' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('scoreboard-print-note').textContent).toContain('still reading')
    cleanup()
    mount({ phone: true, print: { onPress, note: null } })
    expect(screen.getByRole('button', { name: 'Print cost summary' })).toBeTruthy()
    expect(screen.queryByTestId('scoreboard-print-note')).toBeNull()
    cleanup()
    mount({ seesCosts: false })
    expect(screen.queryByRole('button', { name: 'Print cost summary' })).toBeNull()
  })

  it('with no job the board says what fills it', () => {
    mount({ jobs: [] })
    expect(screen.getByText('No job on this site yet.')).toBeTruthy()
    expect(screen.getByText('Bid Board')).toBeTruthy()
  })
})

describe('DevelopmentScoreboard · the rows under an open job (v2.6457)', () => {
  const crew: SiteLaborRead = {
    state: 'read',
    labor: {
      byJobId: new Map([
        [
          'j1',
          {
            jobId: 'j1',
            hours: 1842,
            costUsd: 55410,
            days: 118,
            people: [
              { personName: 'Mateo', personId: 'p2', userId: null, hours: 540, costUsd: 16200, days: 61, leadDays: 0 },
              { personName: 'Luis', personId: 'p1', userId: 'u-luis', hours: 612, costUsd: 21420, days: 74, leadDays: 40 },
              { personName: 'Tom', personId: 'p3', userId: null, hours: 690, costUsd: 17790, days: 70, leadDays: 0 },
            ],
          },
        ],
        ['j2', { jobId: 'j2', hours: 54, costUsd: 1296, days: 5, people: [{ personName: 'Sam', personId: 'p4', userId: null, hours: 54, costUsd: 1296, days: 5, leadDays: 5 }] }],
      ]),
      siteDays: 120,
      people: 4, daysKnown: true,
    },
  }
  const holders = { state: 'read' as const, byTxId: new Map([['tx1', { cardId: 'c1', name: 'Luis', userId: 'u-luis' }]]) }

  function mountRows(over: { phone?: boolean; seesCosts?: boolean; viewer?: { userId: string | null; name: string | null } } = {}) {
    const seesCosts = over.seesCosts ?? true
    const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: crew, costs, overhead, sort: SCOREBOARD_DEFAULT_SORT })
    const membersOf = (r: { jobId: string; m: { cost: number } }) =>
      scoreboardMembers({
        jobId: r.jobId,
        jobCost: r.m.cost,
        seesCosts,
        labor: crew,
        costs,
        overhead,
        cardHolders: holders,
        invoices: [{ job_id: 'j1', sent_by_user_id: 'u-dana' }],
        payments: [{ job_id: 'j1', created_by: 'u-dana' }],
        names: new Map([['u-dana', 'Dana']]),
        viewer: over.viewer ?? { userId: 'u-dana', name: 'Dana' },
      })
    renderWithProviders(<DevelopmentScoreboard model={model} columns={scoreboardColumnsFor(seesCosts)} phone={over.phone ?? false} onSort={vi.fn()} openJob={vi.fn()} head={head} membersOf={membersOf} />)
  }

  it('a folded job shows no rows; opened, the people, the sub, the houses, the card, the overhead and the office line', () => {
    mountRows()
    expect(screen.queryByTestId('scoreboard-member-person:p1')).toBeNull()
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    const luis = screen.getByTestId('scoreboard-member-person:p1')
    expect(luis.textContent).toContain('Lead')
    expect(luis.textContent).toContain('led 40 of 74 days')
    expect(luis.textContent).toContain('612 h')
    expect(luis.textContent).toContain('$21,420')
    expect(screen.getByTestId('scoreboard-member-sub:Reyes Excavating').textContent).toContain('2 sheets')
    expect(screen.getByTestId('scoreboard-member-supplier:Ferguson').textContent).toContain('$41,120')
    expect(screen.getByTestId('scoreboard-member-card:Luis').textContent).toContain('1 charge')
    expect(screen.getByTestId('scoreboard-member-overhead:day-share').textContent).toContain('118 days charged')
    expect(screen.getByTestId('scoreboard-member-office:u-dana').textContent).toContain('sent 1 bill · booked 1 payment')
  })

  it('the leads come first, then the crew by hours', () => {
    mountRows()
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    const order = screen.getAllByTestId(/^scoreboard-member-person:/).map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual(['scoreboard-member-person:p1', 'scoreboard-member-person:p3', 'scoreboard-member-person:p2'])
  })

  it('the viewer’s own rows are gold with You: the office line for Dana, the person and the card for Luis', () => {
    mountRows()
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    expect(screen.getByTestId('scoreboard-member-office:u-dana').getAttribute('data-you')).toBe('true')
    expect(screen.getAllByTestId('scoreboard-you')).toHaveLength(1)
    cleanup()
    mountRows({ viewer: { userId: 'u-luis', name: 'Luis' } })
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    expect(screen.getByTestId('scoreboard-member-person:p1').getAttribute('data-you')).toBe('true')
    expect(screen.getByTestId('scoreboard-member-card:Luis').getAttribute('data-you')).toBe('true')
    expect(screen.getByTestId('scoreboard-member-person:p3').getAttribute('data-you')).toBeNull()
  })

  it('the lead’s board opens to the people alone, with hours and days and no dollar', () => {
    mountRows({ seesCosts: false, viewer: { userId: 'u-luis', name: 'Luis' } })
    fireEvent.click(screen.getByTestId('scoreboard-open-j1'))
    const rows = screen.getAllByTestId(/^scoreboard-member-/)
    expect(rows.map((el) => el.getAttribute('data-testid'))).toEqual(['scoreboard-member-person:p1', 'scoreboard-member-person:p3', 'scoreboard-member-person:p2'])
    expect(rows[0]!.textContent).toContain('612 h')
    expect(rows[0]!.textContent).not.toContain('$')
    expect(rows[0]!.getAttribute('data-you')).toBe('true')
  })

  it('on a phone an open card lists the rows as lines with their figures', () => {
    mountRows({ phone: true })
    fireEvent.click(screen.getByTestId('scoreboard-open-j2'))
    const lines = screen.getByTestId('scoreboard-member-lines')
    expect(within(lines).getByTestId('scoreboard-member-person:p4').textContent).toContain('$1,296 · 54 h · 5 d')
    expect(within(lines).getByTestId('scoreboard-member-supplier:Ferguson').textContent).toContain('$1,480')
  })
})

describe('DevelopmentScoreboard · the middle widths (v2.6457)', () => {
  it('between the phone and 1180 px the money reads short, the whole figure on the title', () => {
    narrowState.on = true
    mount()
    const tile = screen.getByTestId('scoreboard-tile-earned')
    expect(tile.textContent).toContain('$245k')
    const row = screen.getByTestId('scoreboard-row-j1')
    const cost = [...row.querySelectorAll('td')].find((td) => td.textContent?.startsWith('$152k'))
    expect(cost).toBeTruthy()
    expect(cost!.getAttribute('title')).toBe('$151,600')
  })
  it('at full width the figures are whole and carry no title', () => {
    mount()
    expect(screen.getByTestId('scoreboard-tile-earned').textContent).toContain('$244,631')
    const row = screen.getByTestId('scoreboard-row-j1')
    const cost = [...row.querySelectorAll('td')].find((td) => td.textContent?.startsWith('$151,600'))
    expect(cost!.getAttribute('title')).toBeNull()
  })
})

describe('DevelopmentScoreboard · the Right now headline (v2.6467, punch list #250 PR 3)', () => {
  const draw = (over: { phone?: boolean; seesCosts?: boolean; costsIn?: SiteCostsRead } = {}) => {
    const openJob = vi.fn()
    const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs: over.costsIn ?? costs, overhead, sort: SCOREBOARD_DEFAULT_SORT })
    renderWithProviders(<DevelopmentScoreboard model={model} columns={scoreboardColumnsFor(over.seesCosts ?? true)} phone={over.phone ?? false} onSort={vi.fn()} openJob={openJob} head={head} />)
    return { openJob }
  }
  // A ticket with no price that is costing: the headline's first case.
  const withTicket: SiteCostsRead =
    costs.state === 'read'
      ? { state: 'read', byJobId: new Map([...costs.byJobId, ['j3', { jobId: 'j3', subLabor: 0, parts: { supplyInvoices: 0, cardCharges: 2400, tallyParts: 0, otherCharges: 0 }, total: 2400, breakdown: { subs: [], suppliers: [], cardLines: [], tallyLines: 0, otherLines: 0 } }]]) }
      : costs

  it('under Right now in the flag block, the job that carried the site; its number opens the job', () => {
    const { openJob } = draw()
    const h = within(screen.getByTestId('scoreboard-table').querySelector('thead') as HTMLElement).getByTestId('scoreboard-headline')
    expect(h.textContent).toMatch(/^Right nowJP612 carried the site: \$[\d,]+ profit, \d+% of what it earned\.$/)
    fireEvent.click(within(h).getByText('JP612'))
    expect(openJob).toHaveBeenCalledWith('j1')
  })

  it('a ticket with no price that is costing comes first', () => {
    draw({ costsIn: withTicket })
    expect(screen.getByTestId('scoreboard-headline').textContent).toBe('Right nowJP953 has no price yet: $2,400 spent.')
  })

  it('the leader’s board speaks in earned dollars, never a cost', () => {
    draw({ seesCosts: false, costsIn: withTicket })
    const text = screen.getByTestId('scoreboard-headline').textContent ?? ''
    expect(text).toMatch(/carried the site: \$[\d,]+ earned, \d+% of the site\.$/)
    expect(text).not.toContain('2,400')
    expect(text).not.toContain('profit')
  })

  it('on a phone the banner carries it under the line', () => {
    draw({ phone: true, costsIn: withTicket })
    expect(within(screen.getByTestId('scoreboard-phone')).getByTestId('scoreboard-headline').textContent).toContain('JP953 has no price yet')
  })

  it('at the middle widths it takes the board’s width in a row of its own', () => {
    narrowState.on = true
    draw({ costsIn: withTicket })
    expect(screen.getByTestId('scoreboard-headline-row').textContent).toContain('JP953 has no price yet')
    expect(screen.getByTestId('scoreboard-table').querySelector('thead [data-testid="scoreboard-headline"]')).toBeNull()
  })

  it('nothing while a read is out', () => {
    draw({ costsIn: { state: 'reading' } })
    expect(screen.queryByTestId('scoreboard-headline')).toBeNull()
  })
})

describe('DevelopmentScoreboard · the cuts and the window (v2.6558, punch list #250 PR 4)', () => {
  const day = (ymd: string, hours: number, costUsd: number) => ({ ymd, hours, costUsd })
  const clock: SiteLaborRead = {
    state: 'read',
    labor: {
      byJobId: new Map([
        ['j1', { jobId: 'j1', hours: 100, costUsd: 3000, days: 2, people: [{ personName: 'Luis Ortega', personId: 'p1', userId: 'u-luis', hours: 75, costUsd: 2250, days: 2, leadDays: 2, byWorkDate: [day('2026-11-02', 40, 1200), day('2026-11-03', 35, 1050)] }, { personName: 'Ana Reyes', personId: 'p2', userId: null, hours: 25, costUsd: 750, days: 1, leadDays: 0, byWorkDate: [day('2026-11-03', 25, 750)] }] }],
        ['j2', { jobId: 'j2', hours: 54, costUsd: 1296, days: 5, people: [{ personName: 'Ana Reyes', personId: 'p2', userId: null, hours: 54, costUsd: 1296, days: 5, leadDays: 0, byWorkDate: [day('2026-10-20', 54, 1296)] }] }],
      ]),
      siteDays: 3,
      people: 2,
      daysKnown: true,
    },
  }
  const parted = [{ ...jobs[0]!, plan_part_id: 'lodge' }, { ...jobs[1]!, plan_part_id: 'bunker' }, jobs[2]!]
  const parts = [
    { id: 'lodge', name: 'The lodge' },
    { id: 'bunker', name: 'The bunker' },
  ]
  function mountCuts(over: { cut?: ScoreboardCut; window?: ScoreboardWindowKey; range?: { from: string; to: string } | null; phone?: boolean; seesCosts?: boolean; windowOffered?: boolean } = {}) {
    const onCut = vi.fn()
    const onWindow = vi.fn()
    const openJob = vi.fn()
    const seesCosts = over.seesCosts ?? true
    const model = buildScoreboard({ jobs: parted, invoices: [], jobLabel: label, labor: clock, costs, overhead, window: over.range ?? null, chargeEvents: new Map() })
    const cut = over.cut ?? 'job'
    const cuts = {
      cut,
      onCut,
      window: over.window ?? 'all',
      onWindow,
      windowOffered: over.windowOffered ?? true,
      parts: cut === 'part' ? scoreboardPartGroups(model, new Map(parted.map((j) => [j.id, j.plan_part_id ?? null])), parts) : null,
      people: cut === 'person' ? scoreboardPeopleCut({ model, labor: clock, seesCosts, viewer: { userId: 'u-luis', name: null } }) : null,
    }
    const r = renderWithProviders(<DevelopmentScoreboard model={model} columns={scoreboardColumnsFor(seesCosts)} phone={over.phone ?? false} onSort={vi.fn()} openJob={openJob} head={head} print={null} cuts={cuts} />)
    return { ...r, onCut, onWindow, openJob, model }
  }

  it('draws Cut by and Window as chip rows; a press asks for the cut or the window; the window’s two days read beside the chips', () => {
    const { onCut, onWindow } = mountCuts({ window: 'month', range: { from: '2026-11-01', to: '2026-11-05' } })
    expect(screen.getByTestId('scoreboard-cut-job').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('scoreboard-cut-part'))
    expect(onCut).toHaveBeenCalledWith('part')
    expect(screen.getByTestId('scoreboard-window-month').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('scoreboard-window-90d'))
    expect(onWindow).toHaveBeenCalledWith('90d')
    expect(screen.getByTestId('scoreboard-window-words').textContent).toBe('Nov 1 – Nov 5')
  })

  it('a read without days offers no window chips; without the cuts prop there are no chips at all', () => {
    mountCuts({ windowOffered: false })
    expect(screen.queryByTestId('scoreboard-window-all')).toBeNull()
    expect(screen.getByTestId('scoreboard-cut-job')).toBeTruthy()
    cleanup()
    mount()
    expect(screen.queryByTestId('scoreboard-cuts')).toBeNull()
  })

  it('the cut by part: each part a row folded to its three, opening to its nine and its jobs; the jobs on no part last', () => {
    mountCuts({ cut: 'part' })
    const lodge = screen.getByTestId('scoreboard-part-lodge')
    expect(lodge.textContent).toContain('The lodge')
    expect(lodge.textContent).toContain('1 job')
    expect(screen.getByTestId('scoreboard-part-bunker')).toBeTruthy()
    expect(screen.queryByTestId('scoreboard-part-none')).toBeNull()
    expect(screen.queryByTestId('scoreboard-row-j1')).toBeNull()
    // Folded: the money three; the effort cells are blank.
    const cells = within(lodge).getAllByRole('cell')
    expect(cells[cells.length - 1]!.textContent).toContain('$')
    expect(cells[1]!.textContent).toBe('')
    fireEvent.click(screen.getByTestId('scoreboard-open-part-lodge'))
    expect(screen.getByTestId('scoreboard-row-j1')).toBeTruthy()
    expect(within(screen.getByTestId('scoreboard-part-lodge')).getAllByRole('cell')[1]!.textContent).toBe('100 h')
    // The site's foot stays.
    expect(screen.getByText(/The site · 3 jobs/)).toBeTruthy()
  })

  it('the cut by person: a person is a row with hours and their share of earned marked ≈, the viewer gold; it opens to their jobs with the role tag', () => {
    const { openJob } = mountCuts({ cut: 'person' })
    const luis = screen.getByTestId('scoreboard-person-p1')
    expect(luis.getAttribute('data-you')).toBe('true')
    expect(within(luis).getByTestId('scoreboard-you')).toBeTruthy()
    expect(luis.textContent).toContain('Luis Ortega')
    expect(luis.textContent).toContain('1 job')
    const cells = within(luis).getAllByRole('cell')
    expect(cells[1]!.textContent).toBe('75 h')
    const earnedCell = cells.find((c) => c.getAttribute('title') === 'Their share of the job’s earned dollars, by hours')!
    expect(earnedCell.textContent).toContain('≈')
    // Subs, parts and overhead are not a person's: blank.
    expect(cells[4]!.textContent).toBe('')
    expect(screen.getByTestId('scoreboard-person-note').textContent).toContain('not people')
    expect(screen.queryByTestId('scoreboard-fold-row')).toBeNull()
    fireEvent.click(screen.getByTestId('scoreboard-open-person-p1'))
    const line = screen.getByTestId('scoreboard-person-line-p1-j1')
    expect(line.textContent).toContain('Lead')
    expect(line.textContent).toContain('JP612')
    fireEvent.click(within(line).getByText('JP612'))
    expect(openJob).toHaveBeenCalledWith('j1')
    // Ana is not the viewer and led nobody.
    expect(screen.getByTestId('scoreboard-person-p2').getAttribute('data-you')).toBeNull()
  })

  it('on a phone the parts are headings over their cards and a person is a card that opens to their jobs', () => {
    mountCuts({ cut: 'part', phone: true })
    expect(screen.getByTestId('scoreboard-part-lodge').textContent).toContain('The lodge')
    expect(screen.getByTestId('scoreboard-card-j1')).toBeTruthy()
    cleanup()
    mountCuts({ cut: 'person', phone: true })
    const card = screen.getByTestId('scoreboard-person-p1')
    expect(card.textContent).toContain('≈ $')
    fireEvent.click(screen.getByTestId('scoreboard-open-person-p1'))
    expect(screen.getByTestId('scoreboard-person-lines-p1').textContent).toContain('JP612')
  })
})
