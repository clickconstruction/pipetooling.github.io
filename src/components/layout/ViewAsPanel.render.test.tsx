// @vitest-environment jsdom
/**
 * Render smoke for the View as panel (v2.3608): the eight roles in order, "no sample yet" when
 * the stubbed roster has none, the People search, and Close.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { ViewAsPanel } from './ViewAsPanel'
import { DISPATCH_MODE_FOOTER_Z_INDEX } from '../dispatchMode/DispatchModeFooter'
import { settle } from '../../test/renderSmokeMocks'

describe('ViewAsPanel', () => {
  it('lists every imitable role, says which have no sample, searches people, and closes', async () => {
    const onClose = vi.fn()
    render(<ViewAsPanel onClose={onClose} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'View as' })).toBeTruthy()
    const roles = within(screen.getByTestId('view-as-roles')).getAllByRole('button')
    expect(roles).toHaveLength(8)
    expect(roles[0]!.textContent).toContain('no sample yet')
    await waitFor(() => expect(screen.getByText('Nobody matches.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'wendi' } })
    expect(screen.getByText('Nobody matches.')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stands above the dock, so the last person in the list is never under it (v2.4431)', async () => {
    render(<ViewAsPanel onClose={vi.fn()} />)
    await settle()
    const backdrop = screen.getByRole('presentation')
    expect(backdrop.style.position).toBe('fixed')
    expect(Number(backdrop.style.zIndex)).toBeGreaterThan(DISPATCH_MODE_FOOTER_Z_INDEX)
  })
})
