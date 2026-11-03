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
import { buildScoreboard, scoreboardColumnsFor, SCOREBOARD_DEFAULT_SORT } from '../../lib/developments/scoreboard'
import type { MemberJob } from '../../lib/developments/overview'
import type { SiteCostsRead } from '../../lib/developments/siteCosts'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import { DevelopmentScoreboard } from './DevelopmentScoreboard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

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
const labor: SiteLaborRead = { state: 'read', labor: { byJobId: new Map([['j1', { jobId: 'j1', hours: 1842, costUsd: 55410, days: 118, people: [] }], ['j2', { jobId: 'j2', hours: 54, costUsd: 1296, days: 5, people: [] }]]), siteDays: 120, people: 4 } }
const costs: SiteCostsRead = {
  state: 'read',
  byJobId: new Map([
    ['j1', { jobId: 'j1', subLabor: 18400, parts: { supplyInvoices: 53770, cardCharges: 9100, tallyParts: 0, otherCharges: 0 }, total: 81270 }],
    ['j2', { jobId: 'j2', subLabor: 0, parts: { supplyInvoices: 1480, cardCharges: 0, tallyParts: 0, otherCharges: 0 }, total: 1480 }],
  ]),
}
const overhead = { state: 'read' as const, byJobId: new Map([['j1', { usd: 14920, days: 118 }], ['j2', { usd: 610, days: 5 }]]) }
const label = (j: MemberJob) => `JP${j.click_number}`
const head = { name: 'Harlow Ranch', line: 'Ridgeway Builders · 3 jobs · 2 bids', small: '$1,000 left to collect' }

function mount(over: { phone?: boolean; seesCosts?: boolean; jobs?: MemberJob[]; sort?: { key: 'earned' | 'profit'; desc: boolean } } = {}) {
  const onSort = vi.fn()
  const openJob = vi.fn()
  const model = buildScoreboard({ jobs: over.jobs ?? jobs, invoices: [], jobLabel: label, labor, costs, overhead, sort: over.sort ?? SCOREBOARD_DEFAULT_SORT })
  const columns = scoreboardColumnsFor(over.seesCosts ?? true)
  const r = renderWithProviders(<DevelopmentScoreboard model={model} columns={columns} phone={over.phone ?? false} onSort={onSort} openJob={openJob} head={head} />)
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

  it('with no job the board says what fills it', () => {
    mount({ jobs: [] })
    expect(screen.getByText('No job on this site yet.')).toBeTruthy()
    expect(screen.getByText('Bid Board')).toBeTruthy()
  })
})
