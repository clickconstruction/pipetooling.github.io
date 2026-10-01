// @vitest-environment jsdom
/**
 * The work-story window's Session notes link (v2.4324): the man-hours chip is
 * the row's one door to time, so the office reaches Session notes from here.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobHoursStoryModal from './JobHoursStoryModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

describe('JobHoursStoryModal — Session notes link', () => {
  it('closes the window, then opens Session notes on the job', async () => {
    const calls: string[] = []
    const onClose = vi.fn(() => calls.push('close'))
    const onOpenSessionNotes = vi.fn(() => calls.push('session notes'))
    renderWithProviders(
      <JobHoursStoryModal jobId="job-1023" hcpNumber="1023" jobName="Water Sample Test" onOpenSessionNotes={onOpenSessionNotes} onClose={onClose} />,
    )
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Session notes ›' }))
    expect(calls).toEqual(['close', 'session notes'])
  })

  it('draws no link for a viewer without Session notes', async () => {
    renderWithProviders(<JobHoursStoryModal jobId="job-1023" hcpNumber="1023" jobName="Water Sample Test" onClose={vi.fn()} />)
    await settle()
    expect(screen.queryByRole('button', { name: 'Session notes ›' })).toBeNull()
    expect(screen.getByText(/Hours on/)).toBeTruthy()
  })
})
