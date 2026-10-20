// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Pay by card's switch for GC customers (O8c): it loads off, says what turning it on does,
 * and a press saves the new value through the setting's own io.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const setGcCardBillOn = vi.fn(async (_on: boolean) => {})
vi.mock('../../lib/gc/cardBillSetting', () => ({
  fetchGcCardBillOn: async () => false,
  setGcCardBillOn: (on: boolean) => setGcCardBillOn(on),
}))

import GcCardBillSettingsBlock from './GcCardBillSettingsBlock'

describe('GcCardBillSettingsBlock', () => {
  it('loads off, says what it does, and saves the owner’s press', async () => {
    renderWithProviders(<GcCardBillSettingsBlock />)
    const box = screen.getByLabelText('Let GC customers pay a certified bill by card') as HTMLInputElement
    await waitFor(() => expect(box.disabled).toBe(false))
    expect(box.checked).toBe(false)
    const block = screen.getByTestId('gc-card-bill-block')
    expect(block.textContent).toContain('The card adds a 3% fee, and the bill then takes cards only.')
    expect(block.textContent).toContain('Only the customer turns a bill to card.')
    fireEvent.click(box)
    await waitFor(() => expect(setGcCardBillOn).toHaveBeenCalledWith(true))
    expect(box.checked).toBe(true)
  })
})
