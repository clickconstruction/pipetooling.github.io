// @vitest-environment jsdom
/**
 * The Development page's Plans look by part (punch list #239, PR 3): each part with what it builds from, the
 * older sets folded, the as-builts, the jobs that follow no plans yet and the parts with no set as chips (a
 * billing holder left out of the count and named with its reason), + Part and + New
 * set through the writes, Build from this set, and the bids' pinned sets. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { PlanPartRow, PlanSetRow } from '../../lib/plans/planSets'
import { buildSitePlansView } from '../../lib/plans/sitePlans'
import { DevelopmentPartsCard, type SitePlansWrites } from './DevelopmentPartsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  opened.length = 0
})

function part(over: Partial<PlanPartRow> & { id: string; name: string }): PlanPartRow {
  return { development_id: 'd1', job_id: null, position: 0, current_set_id: null, current_set_by: null, current_set_at: null, created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over }
}
function set(over: Partial<PlanSetRow> & { id: string; part_id: string }): PlanSetRow {
  return {
    name: 'Issued set', kind: 'issued', source: 'gc', dated: null, came_at: '2026-10-01T12:00:00Z', memo: '', changes: '', link: 'https://drive.google.com/x',
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
  set({ id: 's0', part_id: 'p2', name: 'Bunker permit set', kind: 'permit', dated: null, came_at: '2026-07-01T12:00:00Z', memo: 'The first set, before the issued one', link: '' }),
]
const jobs = [
  { id: 'j1', label: 'JP991', plan_part_id: 'p2' },
  { id: 'j2', label: 'JP957', plan_part_id: null },
  { id: 'j3', label: 'JP543', plan_part_id: null, billing_only: true },
]
const bids = [{ id: 'b1', label: 'BP340', plans_link: 'https://drive.google.com/robot' }]
const view = buildSitePlansView({ parts, sets, jobs, bids })

function writes(over: Partial<SitePlansWrites> = {}): SitePlansWrites {
  return { addPart: vi.fn(async () => true), addSet: vi.fn(async () => true), buildFrom: vi.fn(async () => true), removeSet: vi.fn(async () => true), writeChanges: vi.fn(async () => true), ...over }
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
    expect(screen.getByTestId('site-chip-no-part').textContent).toContain('1 job follows no plans yet')
    fireEvent.click(screen.getByText('JP957'))
    expect(open).toHaveBeenCalledWith({ kind: 'job', id: 'j2', label: 'JP957' })
    expect(screen.queryByText('JP543')).toBeNull()
    expect(screen.getByTestId('site-left-out').textContent).toBe('1 job needs no plans: 1 bills only')
    fireEvent.click(screen.getByRole('button', { name: 'Ask the estimators about the 2' }))
    expect(ask).toHaveBeenCalledWith(2)
  })

  it('folds the older sets and switches with Build from this set', async () => {
    const w = writes()
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    fireEvent.click(screen.getByTestId('site-older-p2'))
    expect(screen.getByTestId('site-older-list-p2').textContent).toContain('Bunker issued set')
    fireEvent.click(screen.getAllByRole('button', { name: 'Build from this set' })[0]!)
    await waitFor(() => expect(w.buildFrom).toHaveBeenCalledWith('p2', 's1'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[0]!)
    expect(opened.length).toBe(1)
  })

  it('reads the change line under a set, offers Write what changed on one that followed another with none, and saves it', async () => {
    const w = writes()
    const told = buildSitePlansView({ parts, sets: sets.map((s) => (s.id === 's2' ? { ...s, changes: 'P-201: the riser moved to the north wall.' } : s)), jobs, bids })
    const { unmount } = renderWithProviders(<DevelopmentPartsCard view={told} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    expect(screen.getByTestId('plan-set-changes-s2').textContent).toContain('What changed from Bunker issued set: P-201: the riser moved to the north wall.')
    expect(screen.getByRole('button', { name: 'Edit what changed' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('site-older-p2'))
    expect(within(screen.getByTestId('plan-set-changes-s1')).getByRole('button', { name: 'Write what changed' })).toBeTruthy()
    expect(screen.queryByTestId('plan-set-changes-s0')).toBeNull()
    unmount()
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={w} />)
    fireEvent.click(screen.getByRole('button', { name: 'Write what changed' }))
    expect(screen.getByTestId('plan-set-changes-editor-s2').style.display).toBe('grid')
    fireEvent.change(screen.getByLabelText('What changed in Bunker addendum 1'), { target: { value: 'P-201: the riser moved to the north wall.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save what changed' }))
    await waitFor(() => expect(w.writeChanges).toHaveBeenCalledWith('s2', 'P-201: the riser moved to the north wall.'))
    await waitFor(() => expect(screen.queryByTestId('plan-set-changes-editor-s2')).toBeNull())
  })

  it('shows no change press to a reader', () => {
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite={false} openCarrier={() => {}} askAbout={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Write what changed' })).toBeNull()
  })

  it('reads each older set date first, draws a dashed rule between sets, and groups the presses at the right', () => {
    renderWithProviders(<DevelopmentPartsCard view={view} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={writes()} />)
    fireEvent.click(screen.getByTestId('site-older-p2'))
    const rows = within(screen.getByTestId('site-older-list-p2')).getAllByTestId('site-older-set')
    expect(rows.map((r) => within(r).getByTestId('site-older-day').textContent)).toEqual(['Aug 11, 2026', 'came Jul 1, 2026'])
    expect(rows[0]!.textContent!.startsWith('Aug 11, 2026')).toBe(true)
    expect(rows[0]!.textContent).toContain('Bunker issued set Issued set · the GC')
    expect(rows[0]!.textContent).not.toContain('dated')
    expect(rows[1]!.textContent).toContain('The first set, before the issued one')
    expect(rows[0]!.getAttribute('style')).not.toContain('dashed')
    expect(rows[1]!.getAttribute('style')).toContain('border-top: 1px dashed var(--border)')
    const presses = within(rows[0]!).getByTestId('site-older-presses')
    expect(within(presses).getByRole('button', { name: 'Open ↗' })).toBeTruthy()
    expect(within(presses).getByRole('button', { name: 'Build from this set' })).toBeTruthy()
    expect(within(presses).getByRole('button', { name: 'Remove Bunker issued set' })).toBeTruthy()
    expect(presses.style.marginLeft).toBe('auto')
    expect(presses.style.whiteSpace).toBe('nowrap')
    expect(within(rows[1]!).getByText('link still to come')).toBeTruthy()
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

  it('says what fills an empty site and offers + Part to a writer', () => {
    const empty = buildSitePlansView({ parts: [], sets: [], jobs, bids: [] })
    renderWithProviders(<DevelopmentPartsCard view={empty} names={{}} canWrite openCarrier={() => {}} askAbout={() => {}} writes={writes()} />)
    expect(screen.getByText('No part of the site has plans yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+ Part' }))
    expect(screen.getByTestId('site-part-form')).toBeTruthy()
  })
})
