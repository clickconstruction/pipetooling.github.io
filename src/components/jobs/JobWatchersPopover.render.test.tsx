// @vitest-environment jsdom
/**
 * Render smoke for the job watchers bell (v2.2932): mounts against the stub,
 * opens, shows the empty state and the subscribe picker.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobWatchersPopover } from './JobWatchersPopover'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('JobWatchersPopover', () => {
  it('opens to the empty list with a subscribe picker', async () => {
    renderWithProviders(<JobWatchersPopover jobId="j-1" authUserId="u-1" />)
    const bell = screen.getByTestId('job-watchers-bell')
    await waitFor(() => expect(bell.textContent).toContain('Watching · 0'))
    fireEvent.click(bell)
    expect(screen.getByRole('dialog', { name: 'Watch this job' })).toBeTruthy()
    expect(screen.getByText(/Nobody yet/)).toBeTruthy()
    expect(screen.getByLabelText('Subscribe someone')).toBeTruthy()
  })
})
