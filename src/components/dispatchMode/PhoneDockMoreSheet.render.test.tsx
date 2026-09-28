// @vitest-environment jsdom
/**
 * Render smokes for the phone's More sheet (punch list #30): the tap-only door to changing a dock
 * slot (v2.4074 — Taunya's walk on her own iPhone: the press-and-hold never opened for her) and the
 * hold's swap mode, which the parent passes in as `swapIndex`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { PhoneDockMoreSheet, type PhoneDockMoreSheetProps } from './PhoneDockMoreSheet'
import { roleDockDefault } from '../../lib/phoneDock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function mount(overrides: Partial<PhoneDockMoreSheetProps> = {}) {
  const props: PhoneDockMoreSheetProps = {
    open: true,
    swapIndex: null,
    onClose: vi.fn(),
    role: 'assistant',
    userId: 'u-assistant',
    slots: roleDockDefault('assistant')!,
    customized: false,
    onSwap: vi.fn(),
    onReset: vi.fn(),
    modes: [],
    onSignOut: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<PhoneDockMoreSheet {...props} />)
  return props
}

describe('PhoneDockMoreSheet', () => {
  it('opens on More with the four in The dock row, PO in the third slot (v2.4074)', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'More' })).toBeTruthy()
    const row = screen.getByTestId('phone-dock-slots')
    const labels = Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))
    expect(labels).toEqual(['Change the Jobs slot', 'Change the Schedule slot', 'Change the PO slot', 'Change the Inbox slot'])
    expect(screen.queryByText('Reset to the role’s four')).toBeNull()
  })

  it('a tap on a slot enters swap mode; a tap on a page swaps it in and closes', () => {
    const props = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Change the Schedule slot' }))
    expect(screen.getByRole('heading', { name: 'Swap Schedule for…' })).toBeTruthy()
    expect(screen.queryByTestId('phone-dock-slots')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put Supply houses in the Schedule slot' }))
    expect(props.onSwap).toHaveBeenCalledWith(1, 'supplyHouses')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('‹ Back leaves a tapped swap without closing the sheet', () => {
    const props = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Change the Jobs slot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    expect(screen.getByRole('heading', { name: 'More' })).toBeTruthy()
    expect(screen.getByTestId('phone-dock-slots')).toBeTruthy()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('opened by the hold (swapIndex) it is already swapping, and Close closes', () => {
    const props = mount({ swapIndex: 2 })
    expect(screen.getByRole('heading', { name: 'Swap PO for…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back to More' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('a device with its own four gets Reset under the row, which resets and closes', () => {
    const props = mount({ customized: true, slots: ['jobs', 'supplyHouses', 'po', 'inbox'] })
    fireEvent.click(screen.getByText('Reset to the role’s four'))
    expect(props.onReset).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
