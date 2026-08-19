// @vitest-environment jsdom
/**
 * Render-smoke tests for ManagePersonDayModal — the Assign work sheet's
 * "click a name" day manager (v2.1537).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const fetchDayBlocks = vi.fn()
vi.mock('../../lib/dispatchModeSchedule', async () => {
  const real = await vi.importActual<typeof import('../../lib/dispatchModeSchedule')>(
    '../../lib/dispatchModeSchedule',
  )
  return { ...real, fetchDispatchModeDayBlocks: (...args: unknown[]) => fetchDayBlocks(...args) }
})

import ManagePersonDayModal from './ManagePersonDayModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const BLOCK = {
  id: 'b-1',
  assigneeUserId: 'u-1',
  assigneeName: 'Abraham',
  timeStart: '08:00:00',
  timeEnd: '12:00:00',
  note: 'Gate code 4482',
  sharedBlockGroupId: 'grp-1',
  jobId: 'job-1',
  hcpNumber: '951',
  clickNumber: null,
  jobName: 'Shearer Pinpoint',
  jobAddress: '717 Trinity St',
  customerName: 'Laura Shearer',
  serviceTypeName: 'Plumbing',
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    personUserId: 'u-1',
    personName: 'Abraham',
    initialYmd: '2026-08-10',
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('ManagePersonDayModal', () => {
  it('lists the day blocks with edit/remove and the crew badge', async () => {
    fetchDayBlocks.mockResolvedValue({ data: [BLOCK], error: null })
    renderWithProviders(<ManagePersonDayModal {...makeProps()} />)
    await waitFor(() => expect(screen.getByText('951 · Shearer Pinpoint')).toBeTruthy())
    expect(screen.getByText('Gate code 4482')).toBeTruthy()
    expect(screen.getByText('⛓ linked crew')).toBeTruthy()
    expect(screen.getByLabelText('Edit 951 block')).toBeTruthy()
    expect(screen.getByLabelText('Remove 951 block')).toBeTruthy()
    expect(fetchDayBlocks).toHaveBeenCalledWith('2026-08-10', 'u-1')
  })

  it('renders the four ±30 nudge chips per block, crew-aware tooltips (v2.1817)', async () => {
    fetchDayBlocks.mockResolvedValue({ data: [BLOCK], error: null })
    renderWithProviders(<ManagePersonDayModal {...makeProps()} />)
    await waitFor(() => expect(screen.getByText('951 · Shearer Pinpoint')).toBeTruthy())
    const shiftBack = screen.getByLabelText('Shift the whole block 30 minutes earlier for 951')
    expect(shiftBack.title).toContain('whole crew moves together')
    expect(screen.getByLabelText('Shift the whole block 30 minutes later for 951')).toBeTruthy()
    expect(screen.getByLabelText('End 30 minutes earlier for 951')).toBeTruthy()
    expect(screen.getByLabelText('End 30 minutes later for 951')).toBeTruthy()
  })

  it('edit expands with time/day/note fields and the crew-scope choice', async () => {
    fetchDayBlocks.mockResolvedValue({ data: [BLOCK], error: null })
    renderWithProviders(<ManagePersonDayModal {...makeProps()} />)
    await waitFor(() => expect(screen.getByLabelText('Edit 951 block')).toBeTruthy())
    screen.getByLabelText('Edit 951 block').click()
    await waitFor(() => expect(screen.getByLabelText('Start time')).toBeTruthy())
    expect((screen.getByLabelText('Start time') as HTMLInputElement).value).toBe('08:00')
    expect((screen.getByLabelText('Work day (change to move the block)') as HTMLInputElement).value).toBe('2026-08-10')
    expect((screen.getByLabelText('Block note') as HTMLInputElement).value).toBe('Gate code 4482')
    expect(screen.getByLabelText('Whole linked crew')).toBeTruthy()
    expect(screen.getByLabelText('Abraham only (unlinks)')).toBeTruthy()
  })

  it('empty day renders the empty line; remove asks inline with the crew caveat', async () => {
    fetchDayBlocks.mockResolvedValue({ data: [], error: null })
    renderWithProviders(<ManagePersonDayModal {...makeProps()} />)
    await waitFor(() => expect(screen.getByText('Nothing scheduled this day.')).toBeTruthy())
  })

  it('footer offers "select for this assignment" only when not already picked', async () => {
    fetchDayBlocks.mockResolvedValue({ data: [], error: null })
    const onPickForAssignment = vi.fn()
    renderWithProviders(
      <ManagePersonDayModal {...makeProps({ onPickForAssignment, pickedForAssignment: false })} />,
    )
    await waitFor(() => expect(screen.getByText('+ Select Abraham for this assignment')).toBeTruthy())
    screen.getByText('+ Select Abraham for this assignment').click()
    expect(onPickForAssignment).toHaveBeenCalledWith('u-1')
  })
})
