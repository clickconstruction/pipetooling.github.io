// @vitest-environment jsdom
/**
 * The Development page's Plans look by part (punch list #239, PR 3): each part with what it builds from, the
 * older sets folded, the as-builts, the jobs on no part and the parts with no set as chips, + Part and + New
 * set through the writes, Build from this set, and the bids' pinned sets. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { PlanPartRow, PlanSetRow } from '../../lib/plans/planSets'
import { buildSitePlansView } from '../../lib/plans/sitePlans'
import { DevelopmentPartsCard, type SitePlansWrites } from './DevelopmentPartsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The screen's width: the desk by default, a phone where a test says so (the Gun Dog spike, 2026-11-02).
const screenState = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useMatchMedia', () => ({ useMatchMedia: () => screenState.phone }))
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  opened.length = 0
  screenState.phone = false
})

function part(over: Partial<PlanPartRow> & { id: string; name: string }): PlanPartRow {
  return { development_id: 'd1', job_id: null, position: 0, current_set_id: null, current_set_by: null, current_set_at: null, created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over }
}
function set(over: Partial<PlanSetRow> & { id: string; part_id: string }): PlanSetRow {
  return {
    name: 'Issued set', kind: 'issued', source: 'gc', dated: null, came_at: '2026-10-01T12:00:00Z', memo: '', link: 'https://drive.google.com/x',
    replaces_set_id: null, marks_up_set_id: null, job_id: null, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null,
    created_by: 'u1', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', ...over,
  }
}
const parts = [part({ id: 'p1', name: 'Lodge', position: 1, current_set_id: 's3' }), part({ id: 'p2', name: 'Bunker', position: 2, current_set_id: 's2', current_set_by: 'u1', current_set_at: '2026-10-30T15:00:00Z' }), part({ id: 'p3', name: 'ATV building', position: 3 })]
const sets = [
  set({ id: 's1', part_id: 'p2', name: 'Bunker issued set', dated: '2026-08-11', link: 'https://drive.google.com/issued' }),
  set({ id: 's2', part_id: 'p2', name: 'Bunker addendum 1', kind: 'addendum', dated: '2026-10-02', replaces_set_id: 's1', memo: 'P-201 redrawn', link: 'https://drive.google.com/addendum' }),
  set({ id: 's3', part_id: 'p1', name: 'Lodge issued set', dated: '2026-08-11' }),
  set({ id: 's4', part_id: 'p2', name: 'As-built · JP991 · 2026-11-01', kind: 'as_built', source: 'ours', job_id: 'j1', marks_up_set_id: 's2', came_at: '2026-11-01T00:00:00Z' }),
]
const jobs = [
  { id: 'j1', label: 'JP991', plan_part_id: 'p2' },
  { id: 'j2', label: 'JP957', plan_part_id: null, name: 'Mobilizations Feb-Mar 2026' },
]
const bids = [{ id: 'b1', label: 'BP340', plans_link: 'https://drive.google.com/robot' }]
const view = buildSitePlansView({ parts, sets, jobs, bids })

function writes(over: Partial<SitePlansWrites> = {}): SitePlansWrites {
  return { addPart: vi.fn(async () => true), addSet: vi.fn(async () => true), buildFrom: vi.fn(async () => true), removeSet: vi.fn(async () => true), putJobsOnPart: vi.fn(async () => true), ...over }
}

describe('DevelopmentPartsCard', () => {
  it('reads each part with what it builds from, the replaced line, the jobs, the as-builts and the pinned bids', () => {
    renderWithProviders(<DevelopmentPartsCard view={view} names={{ u1: 'Taunya' }} canWrite={false} openCarrier={() => {}} askAbout={() => {}} />)
    expect(screen.getByText('Bunker addendum 1')).toBeTruthy()
    expect(screen.getByText('replaced Bunker issued set on Oct 30 · set by Taunya')).toBeTruthy()
    expect(screen.getByText('P-201 redrawn')).toBeTruthy()
    expect(screen.getByText('JP991')).toBeTruthy()
    expect(screen.getByText('Our as-builts · 1')).toBeTruthy()
    expect(screen.getByText('no set yet')).toBeTruthy()
    expect(screen.getByTestId('site-bids-pinned').textContent).toContain('BP340')
    expect(screen.queryByText('+ New set')).toBeNull()
    expect(screen.queryByText('+ Part')).toBeNull()
  })

  it('shows the two chips, opens their lists, and offers the ask about the sum', () => {
    const ask = vi.fn()
    const open = vi.fn()
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite={false} openCarrier={open} askAbout={ask} />)
    fireEvent.click(screen.getByTestId('site-chip-no-set'))
    expect(screen.getByTestId('site-list-no-set').textContent).toContain('ATV building')
    fireEvent.click(screen.getByTestId('site-chip-no-part'))
    fireEvent.click(screen.getByText('JP957'))
    expect(open).toHaveBeenCalledWith({ kind: 'job', id: 'j2', label: 'JP957', name: 'Mobilizations Feb-Mar 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Ask the estimators about the 2' }))
    expect(ask).toHaveBeenCalledWith(2)
  })

  it('folds the older sets and switches with Build from this set', async () => {
    const w = writes()
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    fireEvent.click(screen.getByTestId('site-older-p2'))
    expect(screen.getByTestId('site-older-list-p2').textContent).toContain('Bunker issued set')
    fireEvent.click(screen.getByRole('button', { name: 'Build from this set' }))
    await waitFor(() => expect(w.buildFrom).toHaveBeenCalledWith('p2', 's1'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[0]!)
    expect(opened.length).toBe(1)
  })

  it('adds a set on a part through the form, replacing the current one, and names a new part', async () => {
    const w = writes()
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    fireEvent.click(screen.getAllByRole('button', { name: '+ New set' })[1]!)
    const form = await screen.findByTestId('job-plans-set-form')
    expect((form.querySelector('input') as HTMLInputElement).value).toBe('Addendum 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add the set and build from it' }))
    await waitFor(() => expect(w.addSet).toHaveBeenCalled())
    const [partId, draft, makeCurrent, replaces] = (w.addSet as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect([partId, draft.name, makeCurrent, replaces]).toEqual(['p2', 'Addendum 1', true, 's2'])
    fireEvent.click(screen.getByRole('button', { name: '+ Part' }))
    fireEvent.change(screen.getByLabelText("The part's name"), { target: { value: 'Pool house' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make the part' }))
    await waitFor(() => expect(w.addPart).toHaveBeenCalledWith('Pool house'))
  })

  it('on a phone draws each part as a card with the same facts, and no table', () => {
    screenState.phone = true
    renderWithProviders(<DevelopmentPartsCard view={view} names={{ u1: 'Taunya' }} canWrite openCarrier={() => {}} askAbout={() => {}} writes={writes()} />)
    expect(screen.queryByTestId('site-plans-table')).toBeNull()
    const cards = screen.getByTestId('site-plans-cards')
    expect(cards.querySelectorAll('[data-testid^="site-part-"]').length).toBe(3)
    const bunker = screen.getByTestId('site-part-p2')
    expect(bunker.textContent).toContain('Bunker addendum 1')
    expect(bunker.textContent).toContain('P-201 redrawn')
    expect(bunker.textContent).toContain('JP991')
    expect(screen.getByTestId('site-older-p2')).toBeTruthy()
  })

  it('says what fills an empty site and offers + Part to a writer', () => {
    const empty = buildSitePlansView({ parts: [], sets: [], jobs, bids: [] })
    renderWithProviders(<DevelopmentPartsCard view={empty} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={writes()} />)
    expect(screen.getByText('No part of the site has plans yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+ Part' }))
    expect(screen.getByTestId('site-part-form')).toBeTruthy()
  })

  it('a writer ticks the jobs on no part, names the part, and one press puts them on it', async () => {
    const w = writes()
    const many = buildSitePlansView({ parts, sets, jobs: [...jobs, { id: 'j3', label: 'JP960', plan_part_id: null, name: 'ATV building fans' }], bids })
    renderWithProviders(<DevelopmentPartsCard view={many} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    fireEvent.click(screen.getByTestId('site-chip-no-part'))
    // Each row carries the job's name, by name: the ATV building job before the mobilizations.
    const rows = screen.getByTestId('site-list-no-part').querySelectorAll('.developmentPickRow')
    expect([...rows].map((r) => r.textContent)).toEqual(['JP960ATV building fans', 'JP957Mobilizations Feb-Mar 2026'])
    expect(screen.getByText('Put jobs on a part').closest('button')!.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByText('Tick all 2'))
    fireEvent.change(screen.getByTestId('site-part-for-jobs'), { target: { value: 'p1' } })
    const press = screen.getByText('Put 2 jobs on Lodge').closest('button')!
    expect(press.hasAttribute('disabled')).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(w.putJobsOnPart).toHaveBeenCalledWith('p1', ['j2', 'j3']))
  })

  it('a reader sees the jobs on no part as doors and no press', () => {
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite={false} openCarrier={() => {}} askAbout={() => {}} />)
    fireEvent.click(screen.getByTestId('site-chip-no-part'))
    expect(screen.getByTestId('site-list-no-part').textContent).toContain('JP957')
    expect(screen.queryByTestId('site-part-for-jobs')).toBeNull()
  })
})
