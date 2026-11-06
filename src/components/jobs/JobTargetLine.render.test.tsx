// @vitest-environment jsdom
/**
 * The job's Target line (punch list #255, v2.6585): the budget's hours as the fallback, Set a target with hours and why
 * through the hook's setTarget, an open target with who set it and Back to the budget, a crew lead reading only, and a
 * draft with no reason refused in words.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExpectedHoursApi } from '../../hooks/useExpectedHours'
import type { ExpectedHoursTarget } from '../../lib/jobs/expectedHours'

const auth = vi.hoisted(() => ({ role: 'assistant' as string, readOnly: false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, readOnly: auth.readOnly, user: { id: 'viewer' } }) }))
vi.mock('../../hooks/useExpectedHours', () => ({ useExpectedHours: () => apiWith(null) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) } }))

import { JobTargetLine } from './JobTargetLine'

const TARGET: ExpectedHoursTarget = { id: 't', jobId: 'job-1', hours: 96, from: 110, by: 'Robert', at: '2026-11-01T15:00:00Z', why: 'framed in a week' }

function apiWith(target: ExpectedHoursTarget | null): ExpectedHoursApi & { setTarget: ReturnType<typeof vi.fn>; clearTarget: ReturnType<typeof vi.fn> } {
  return {
    byJob: new Map(target ? [[target.jobId, target]] : []),
    history: [],
    undo: null,
    loading: false,
    error: null,
    setTarget: vi.fn(async () => true),
    clearTarget: vi.fn(async () => true),
    undoLatest: vi.fn(async () => true),
    reload: vi.fn(),
  }
}

const budget = (hours: number | null, source: 'bid' | 'typed' | null = 'bid') => async () => ({ hours, source })

afterEach(() => {
  cleanup()
  auth.role = 'assistant'
  auth.readOnly = false
})

describe('JobTargetLine', () => {
  it('falls back to the labor budget, and Set a target saves the hours and the reason', async () => {
    const api = apiWith(null)
    render(<JobTargetLine jobId="job-1" api={api} readBudget={budget(110)} />)
    expect(await screen.findByText('🎯 Target 110 h from the labor budget')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set a target' }))
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '96' } })
    fireEvent.change(screen.getByLabelText('Why this target'), { target: { value: 'framed in a week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(api.setTarget).toHaveBeenCalledWith('job-1', 96, 110, 'framed in a week'))
    expect(screen.queryByTestId('job-target-edit')).toBeNull()
  })

  it('reads an open target with who set it and why, and Back to the budget clears it', async () => {
    const api = apiWith(TARGET)
    render(<JobTargetLine jobId="job-1" api={api} readBudget={budget(110)} />)
    expect(await screen.findByText('🎯 Target 96 h')).toBeTruthy()
    expect(screen.getByText('Expected 96 h, set by Robert on Nov 1 (was 110 h): framed in a week')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the budget' }))
    await waitFor(() => expect(api.clearTarget).toHaveBeenCalledWith('job-1'))
    expect(screen.getByRole('button', { name: 'Change the target' })).toBeTruthy()
  })

  it('says no target yet, and a draft with no reason is refused in words', async () => {
    const api = apiWith(null)
    render(<JobTargetLine jobId="job-1" api={api} readBudget={budget(null, null)} />)
    expect(await screen.findByText('🎯 No target yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set a target' }))
    fireEvent.change(screen.getByLabelText('Target hours'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Say why, in a few words. The crew reads it.')
    expect(api.setTarget).not.toHaveBeenCalled()
  })

  it('a crew lead and a training account read the line and get no press', async () => {
    auth.role = 'primary'
    render(<JobTargetLine jobId="job-1" api={apiWith(TARGET)} readBudget={budget(110)} />)
    expect(await screen.findByText('🎯 Target 96 h')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    auth.role = 'dev'
    auth.readOnly = true
    render(<JobTargetLine jobId="job-1" api={apiWith(TARGET)} readBudget={budget(110)} />)
    expect(await screen.findByText('🎯 Target 96 h')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
