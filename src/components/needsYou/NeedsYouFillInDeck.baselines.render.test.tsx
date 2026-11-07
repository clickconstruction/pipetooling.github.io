// @vitest-environment jsdom
/**
 * The Fill them in deck's baseline kind (punch list #234, PR 1a): the newest working project with
 * no hours baseline first with what the app knows, one press writes the baseline and moves on with
 * no Save, the first usable source leads, a bid sent without hours is not drawn as a press, Undo
 * clears the row and brings it back, and a refused press stays on the row with its reason. Made-up
 * rows.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { baselineFillInRows, type BaselineJobSource, type BaselineSources } from '../../lib/needsYou/fillInBaselines'
import type { BaselineFillInIo } from '../../lib/needsYou/fillInBaselinesIo'
import type { AwardBaselineRpcArgs } from '../../lib/jobs/awardBaseline'
import type { BaselineRate } from '../../lib/bids/bidBaselineRates'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const job = (id: string, created: string, over: Partial<BaselineJobSource> = {}): BaselineJobSource => ({
  id,
  status: 'working',
  billing_only: false,
  kind: 'project',
  hcp_number: '',
  click_number: id,
  bid_id: null,
  project_id: null,
  revenue: 56_000,
  first_work_date: '2026-09-01',
  job_name: `Job ${id}`,
  job_address: null,
  customer_name: null,
  created_at: `${created}T12:00:00Z`,
  ...over,
})
const rate = (price: number, hours: number): BaselineRate => ({ job_id: `r${price}`, bid_id: null, kept_at: '2026-01-01', kept_on: 'billed', price_usd: price, team_hours: hours, hours_per_thousand: hours / (price / 1000), people_count: 2, grade: 'per_thousand' })

const sources = (): BaselineSources => ({
  jobs: [job('1031', '2026-08-01', { bid_id: 'b901' }), job('1070', '2026-09-04', { bid_id: 'b917', revenue: 112_000, customer_name: 'Harbor Lane Offices' })],
  fixtures: [],
  budgets: [],
  bids: [
    { bid_id: 'b901', bid_number: '901', breakdown: { has_estimate: true, labor_hours: 158, labor_rate: 42, labor_usd: 6_636, materials_usd: 20_000, completeness: { rows_total: 24, rows_with_hours: 22, rate_set: true, usable: true } } },
    { bid_id: 'b917', bid_number: '917', breakdown: { has_estimate: true, labor_hours: 71, labor_rate: 42, labor_usd: 2_982, materials_usd: 0, completeness: { rows_total: 31, rows_with_hours: 9, rate_set: true, usable: false } } },
  ],
  book: [rate(40_000, 160), rate(60_000, 252), rate(80_000, 336), rate(120_000, 504)],
})

function harness(saveError?: Error) {
  const saves: AwardBaselineRpcArgs[] = []
  const undos: string[] = []
  const io: BaselineFillInIo = {
    fetchCandidates: async () => ({ jobs: [], fixtures: [], budgets: [] }),
    fetchSources: async () => sources(),
    save: async (args) => {
      if (saveError) throw saveError
      saves.push(args)
    },
    undo: async (jobId) => {
      undos.push(jobId)
    },
  }
  let rows: FillInRow[] = baselineFillInRows(sources(), 45)
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noAccounts = { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noContracts = { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => false, filePaper: async () => ({ uploadError: null }) }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="baseline"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: noContracts, baselines: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const cardTitle = () => document.querySelector('[data-fill-in-row] [data-fill-in-title]')?.textContent ?? ''
const press = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · baselines', () => {
  it('opens on the newest project with what the app knows; a bid sent without hours is not a press and the book leads', async () => {
    harness().render()
    await settle()
    expect(cardTitle()).toBe('#1070 Job 1070 · Harbor Lane Offices · $112,000')
    expect(screen.getByText('1 of 2 projects')).toBeTruthy()
    expect(screen.getByText('A project, made Sep 4, before baselines were written at award.')).toBeTruthy()
    expect(screen.getByText('Not usable: hours on 9 of 31 rows. Fill the Labor rows on B917 and this becomes the pick. The 9 rows carry 71 h.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Take B917/ })).toBeNull()
    expect(press(/Freeze the book's/).textContent).toBe("Freeze the book's 470 h")
    expect(press(/Freeze the book's/).style.background).toBe('rgb(37, 99, 235)')
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
  })

  it('one press writes the baseline and moves on; the bid leads where it is usable; Undo clears the row and brings it back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press(/Freeze the book's/))
    await waitFor(() => expect(h.saves).toHaveLength(1))
    expect(h.saves[0]).toMatchObject({ p_job_id: '1070', p_source: 'book', p_labor_hours: 470.4, p_labor_rate: 42 })
    await settle()
    expect(trail()).toContain('470 h assumed from the book · frozen as the baseline')
    expect(cardTitle()).toBe('#1031 Job 1031 · $56,000')
    expect(press("Take B901's estimate · 158 h").style.background).toBe('rgb(37, 99, 235)')
    expect(press("Freeze the book's 235 h").style.background).toBe('var(--surface)')
    fireEvent.click(press("Take B901's estimate · 158 h"))
    await waitFor(() => expect(h.saves).toHaveLength(2))
    expect(h.saves[1]).toMatchObject({ p_job_id: '1031', p_source: 'bid', p_bid_id: 'b901' })
    await settle()
    expect(trail()).toContain('158 h from the bid · frozen as the baseline')
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo' })[0]!)
    await waitFor(() => expect(h.undos).toEqual(['1031']))
    await settle()
    expect(cardTitle()).toBe('#1031 Job 1031 · $56,000')
  })

  it('a refused press stays on the row with its reason', async () => {
    const h = harness(new Error('You cannot change this job’s budget'))
    h.render()
    await settle()
    fireEvent.click(press(/Freeze the book's/))
    await waitFor(() => expect(screen.getByText(/You cannot change this job’s budget/)).toBeTruthy())
    expect(cardTitle()).toBe('#1070 Job 1070 · Harbor Lane Offices · $112,000')
    expect(h.saves).toEqual([])
  })
})
