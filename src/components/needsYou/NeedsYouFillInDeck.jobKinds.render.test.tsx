// @vitest-environment jsdom
/**
 * The Fill them in deck's job-kind kind (punch list #238, PR 2): the newest working job with no kind
 * first with what the app knows, one press saves and moves on with no Save, the side the hours lean
 * to leads, Skip sends a row to the back, Undo clears the press and brings the row back, a refused
 * press stays on the row with its reason, and the door opens the job. Made-up rows.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { jobKindFillInRows, type JobKindJobSource, type JobKindSources } from '../../lib/needsYou/fillInJobKinds'
import type { JobKindFillInIo } from '../../lib/needsYou/fillInJobKindsIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const job = (id: string, created: string, over: Partial<JobKindJobSource> = {}): JobKindJobSource => ({
  id,
  status: 'working',
  billing_only: false,
  kind: null,
  hcp_number: '',
  click_number: id,
  bid_id: null,
  project_id: null,
  revenue: 0,
  first_work_date: '2026-09-01',
  job_name: `Job ${id}`,
  job_address: null,
  customer_name: null,
  created_at: `${created}T12:00:00Z`,
  ...over,
})

const sources = (): JobKindSources => ({
  jobs: [job('1031', '2026-08-01'), job('1042', '2026-09-01', { revenue: 56000, customer_name: 'Ridgeway Builders' })],
  fixtures: [],
  sessions: [
    { job_ledger_id: '1042', user_id: 'u1', work_date: '2026-09-01', clocked_in_at: '2026-09-01T13:00:00Z', clocked_out_at: '2026-09-01T21:00:00Z' },
    { job_ledger_id: '1042', user_id: 'u2', work_date: '2026-10-12', clocked_in_at: '2026-10-12T13:00:00Z', clocked_out_at: '2026-10-12T21:00:00Z' },
  ],
  bills: [{ job_id: '1042', amount: 18000, status: 'billed' }],
})

function harness(saveError?: Error) {
  const saves: Array<[string, string]> = []
  const undos: string[] = []
  const io: JobKindFillInIo = {
    fetchCandidates: async () => ({ jobs: [], fixtures: [] }),
    fetchSources: async () => sources(),
    save: async (jobId, kind) => {
      if (saveError) throw saveError
      saves.push([jobId, kind])
    },
    undo: async (jobId) => {
      undos.push(jobId)
    },
  }
  let rows: FillInRow[] = jobKindFillInRows(sources())
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
        startKind="job-kind"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: noContracts, jobKinds: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const cardTitle = () => document.querySelector('[data-fill-in-row] [data-fill-in-title]')?.textContent ?? ''
const press = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · job kinds', () => {
  it('opens on the newest job with what the app knows, and the press the hours lean to leads', async () => {
    harness().render()
    await settle()
    expect(cardTitle()).toBe('#1042 Job 1042 · Ridgeway Builders · $56,000')
    expect(screen.getByText('1 of 2 jobs')).toBeTruthy()
    expect(screen.getByText('No price before the work, no bid, no stages: your call.')).toBeTruthy()
    expect(screen.getByText('Clocked 16 hours over 6 weeks by 2 people.')).toBeTruthy()
    expect(screen.getByText('Billed once, $18,000, with $38,000 left.')).toBeTruthy()
    expect(screen.getByText('6 weeks and 2 people on one job reads like a project. The press is yours.')).toBeTruthy()
    expect(press('Project').style.background).toBe('rgb(37, 99, 235)')
    expect(press('Service call').style.background).toBe('var(--surface)')
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
  })

  it('one press saves and moves on; Undo clears the press and brings the row back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press('Project'))
    await waitFor(() => expect(h.saves).toEqual([['1042', 'project']]))
    await settle()
    expect(trail()).toContain('Project · saved on the job')
    expect(cardTitle()).toBe('#1031 Job 1031')
    // No hours and no lean on this one: neither side leads.
    expect(press('Project').style.background).toBe('var(--surface)')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos).toEqual(['1042']))
    await settle()
    expect(cardTitle()).toBe('#1042 Job 1042 · Ridgeway Builders · $56,000')
  })

  it('Skip sends the row to the back and saves nothing', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press('Skip'))
    await settle()
    expect(cardTitle()).toBe('#1031 Job 1031')
    expect(h.saves).toEqual([])
    expect(trail()).toContain('skipped')
  })

  it('a refused press stays on the row and says why', async () => {
    const h = harness(new Error('This account cannot change this job.'))
    h.render()
    await settle()
    fireEvent.click(press('Service call'))
    expect(await screen.findByText(/This account cannot change this job/)).toBeTruthy()
    expect(cardTitle()).toBe('#1042 Job 1042 · Ridgeway Builders · $56,000')
    expect(press('Service call').disabled).toBe(false)
  })

  it('the door opens the job', async () => {
    harness().render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the job ›' }))
    expect(navigate).toHaveBeenCalledWith('/jobs?tab=stages&edit=1042')
  })
})
