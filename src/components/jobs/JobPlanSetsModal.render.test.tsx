// @vitest-environment jsdom
/**
 * The Pipeline row's plans icon and its picker (punch list #239, PR 6): one set opens it, two or more open the
 * window with the set the job builds from first, older sets and our as-builts each with Open ↗, and the door to the
 * Documents tab. Made-up names only.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanSetRow } from '../../lib/plans/planSets'
import { jobPlansPress, type JobPlanSetsEntry } from '../../lib/plans/jobPlanSetsIcon'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPlanSetsModal } from './JobPlanSetsModal'
import { StagesPlansButton } from './StagesRowActionButtons'

const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

function set(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1',
    name: 'Issued set',
    kind: 'issued',
    source: 'gc',
    dated: null,
    came_at: '2026-10-01T12:00:00Z',
    memo: '',
    link: 'https://drive.google.com/drive/folders/issued',
    replaces_set_id: null,
    marks_up_set_id: null,
    job_id: null,
    file_name: null,
    file_size: null,
    file_count: null,
    checked_at: null,
    check_note: null,
    created_by: 'u1',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...over,
  } as PlanSetRow
}
const entry: JobPlanSetsEntry = {
  partId: 'p1',
  currentSetId: 's2',
  sets: [
    set({ id: 's1', dated: '2026-08-11' }),
    set({ id: 's2', name: 'Permit set', kind: 'permit', dated: '2026-10-14', replaces_set_id: 's1', link: 'https://drive.google.com/drive/folders/permit' }),
    set({ id: 's3', name: 'As-built · JP972 · 2026-11-01', kind: 'as_built', source: 'ours', marks_up_set_id: 's2', job_id: 'j1', link: 'https://drive.google.com/drive/folders/asbuilt', came_at: '2026-11-01T18:00:00Z' }),
  ],
}

afterEach(() => {
  cleanup()
  opened.length = 0
})

describe('StagesPlansButton', () => {
  it('draws nothing for a job with nothing to open, opens the one set, and offers the picker with its count', () => {
    const onPick = vi.fn()
    const { container } = renderWithProviders(<StagesPlansButton press={jobPlansPress(null, null)} onPick={onPick} />)
    expect(container.querySelector('button')).toBeNull()
    cleanup()
    renderWithProviders(<StagesPlansButton press={jobPlansPress({ partId: 'p1', currentSetId: 's2', sets: [entry.sets[1]!] }, null)} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the job’s plans · Job plans · Permit set' }))
    expect(opened).toEqual(['https://drive.google.com/drive/folders/permit'])
    expect(onPick).not.toHaveBeenCalled()
    cleanup()
    renderWithProviders(<StagesPlansButton press={jobPlansPress(entry, null)} onPick={onPick} />)
    const pick = screen.getByRole('button', { name: 'Pick a set of the job’s plans · 3 sets' })
    expect(pick.getAttribute('title')).toBe('Job plans · Permit set · 3 sets')
    expect(pick.textContent).toBe('3')
    fireEvent.click(pick)
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})

describe('JobPlanSetsModal', () => {
  it('lists the set the job builds from first with its chip, the older set and our as-built, opens one, and the door closes first', () => {
    const onClose = vi.fn()
    const onOpenDocuments = vi.fn()
    renderWithProviders(<JobPlanSetsModal job={{ id: 'j1', label: 'JP972' }} entry={entry} names={{ u1: 'Taunya' }} onClose={onClose} onOpenDocuments={onOpenDocuments} />)
    expect(screen.getByRole('dialog', { name: 'Plans on JP972' })).toBeTruthy()
    expect(screen.getByText('3 sets of plans on this job. Open the one you want.')).toBeTruthy()
    const rows = screen.getAllByTestId('job-plan-set-row')
    expect(rows.map((r) => r.textContent)).toEqual([
      'Permit setbuilding fromPermit set · the GC · dated Oct 14, 2026Open ↗',
      'Issued setIssued set · the GC · dated Aug 11, 2026Open ↗',
      'As-built · JP972 · 2026-11-01Nov 1 · Taunya · marks up Permit setOpen ↗',
    ])
    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[1]!)
    expect(opened).toEqual(['https://drive.google.com/drive/folders/issued'])
    fireEvent.click(screen.getByRole('button', { name: 'Open the Documents tab' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenDocuments).toHaveBeenCalledTimes(1)
  })
})
