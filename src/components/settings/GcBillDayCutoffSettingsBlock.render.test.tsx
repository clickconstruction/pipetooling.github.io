// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → the trades' cut-off for GC bill day (Messages cut 9): it loads the setting, saves a new
 * number of days through its function, and will not save one outside 2 to 20.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const setBillDayCutoff = vi.fn(async (days: number) => days)
vi.mock('../../lib/gc/billDay/billDayIo', () => ({
  loadBillDayCutoff: async () => 6,
  setBillDayCutoff: (days: number) => setBillDayCutoff(days),
}))

import GcBillDayCutoffSettingsBlock from './GcBillDayCutoffSettingsBlock'

describe('GcBillDayCutoffSettingsBlock', () => {
  it('loads 6, saves 8, and refuses a day outside 2 to 20', async () => {
    renderWithProviders(<GcBillDayCutoffSettingsBlock />)
    const box = screen.getByLabelText('Days before bill day') as HTMLInputElement
    await waitFor(() => expect(box.value).toBe('6'))
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(box, { target: { value: '1' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(box, { target: { value: '8' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(setBillDayCutoff).toHaveBeenCalledWith(8))
    expect(screen.getByTestId('gc-bill-day-cutoff-block').textContent).toContain('Pick 2 to 20.')
  })
})
