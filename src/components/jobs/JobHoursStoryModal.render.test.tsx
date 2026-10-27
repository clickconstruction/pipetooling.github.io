// @vitest-environment jsdom
/**
 * The work-story window's Session notes link (v2.4324): the man-hours chip is
 * the row's one door to time, so the office reaches Session notes from here.
 * With no hours yet (#184), the empty list names Overlay schedule while blocks are booked.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

let blockRows: unknown[] = []
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => unknown
  stub.from = (table: string) => {
    if (table !== 'job_schedule_blocks') return baseFrom(table)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) b[m] = () => b
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: blockRows, error: null }).then(res, rej)
    return b
  }
  return { supabase: stub }
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

  it('with no hours, names Overlay schedule while blocks are booked, and the press turns it on (#184)', async () => {
    blockRows = [{ id: 'b-1', assignee_user_id: 'u-1', work_date: '2026-10-28', time_start: '08:00', time_end: '12:00', note: null }]
    renderWithProviders(<JobHoursStoryModal jobId="job-1023" hcpNumber="1023" jobName="Water Sample Test" onClose={vi.fn()} />)
    const press = await screen.findByRole('button', { name: 'Overlay schedule' })
    expect((press.closest('[data-empty-state]') as HTMLElement).textContent).toBe('No clock sessions on this job yet. Overlay schedule shows what is scheduled.')
    fireEvent.click(press)
    expect((screen.getByRole('checkbox', { name: 'Overlay schedule' }) as HTMLInputElement).checked).toBe(true)
    blockRows = []
  })
})
