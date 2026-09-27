// @vitest-environment jsdom
/**
 * Step 3 of the Estimates map (v2.3870): the line-item catalog modal moved out of the page whole.
 * This smoke pins the seam — closed renders nothing; open lists the catalog and the filter narrows
 * it; a pick hands the entry to the parent; Escape and the close control call `onClose`; the Edit
 * tab shows only to the catalog's editors.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { EstimateLineItemCatalogModal } from './EstimateLineItemCatalogModal'
import { renderSettled, renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
})

const items = [
  { id: 'a', line_item: 'Water heater', description: '50 gal gas', quantity: 1, unit_price_cents: 185_000, amount_cents: 185_000 },
  { id: 'b', line_item: 'Pretest', description: 'hydrostatic', quantity: 2, unit_price_cents: 45_000, amount_cents: 90_000 },
]

function props(over: Partial<Parameters<typeof EstimateLineItemCatalogModal>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    catalogLineItems: items,
    onReloadCatalog: vi.fn(async () => {}),
    canManage: false,
    onInsert: vi.fn(),
    ...over,
  }
}

describe('EstimateLineItemCatalogModal', () => {
  it('renders nothing while closed', () => {
    const { container } = renderWithProviders(<EstimateLineItemCatalogModal {...props({ open: false })} />)
    expect(container.textContent).toBe('')
  })

  it('open: lists the catalog, the filter narrows it, and a pick hands the entry to the parent', async () => {
    const onInsert = vi.fn()
    await renderSettled(<EstimateLineItemCatalogModal {...props({ onInsert })} />, { loaded: () => screen.findByText('Water heater') })
    expect(screen.getByText('Pretest')).toBeTruthy()
    const filter = screen.getByPlaceholderText('Filter…')
    fireEvent.change(filter, { target: { value: 'hydro' } })
    expect(screen.queryByText('Water heater')).toBeNull()
    expect(screen.getByText('Pretest')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Pretest/ }))
    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(onInsert.mock.calls[0]?.[0]?.id).toBe('b')
  })

  it('Escape closes through the parent; the Edit tab shows only to editors', async () => {
    const onClose = vi.fn()
    await renderSettled(<EstimateLineItemCatalogModal {...props({ canManage: true, onClose })} />, { loaded: () => screen.findByText('Water heater') })
    expect(screen.getByRole('button', { name: 'Edit book' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    await renderSettled(<EstimateLineItemCatalogModal {...props({ canManage: false })} />, { loaded: () => screen.findByText('Water heater') })
    expect(screen.queryByRole('button', { name: 'Edit book' })).toBeNull()
  })
})
