// @vitest-environment jsdom
/**
 * Render tests for the PartFormModal refresh (v2.1325): searchable Part Type +
 * supply-house pickers, the always-a-trailing-blank price row fast-entry
 * contract, remove buttons out of the tab order, and the optional
 * "Save & add another" button.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PartFormModal } from './PartFormModal'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

const supplyHouses = [
  { id: 'sh1', name: 'Ferguson', website_url: null },
  { id: 'sh2', name: 'Winsupply', website_url: null },
] as unknown as SupplyHouse[]

const partTypes = [
  { id: 'pt1', service_type_id: 'st1', name: 'PVC fittings', category: null },
  { id: 'pt2', service_type_id: 'st1', name: 'Copper pipe', category: null },
]

const serviceTypes = [{ id: 'st1', name: 'Plumbing', description: null }]

function makeProps(overrides: Partial<Parameters<typeof PartFormModal>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    selectedServiceTypeId: 'st1',
    supplyHouses,
    partTypes,
    serviceTypes,
    ...overrides,
  }
}

describe('PartFormModal (add mode)', () => {
  it('renders searchable comboboxes for Part Type and the seeded blank price row', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    // 2 comboboxes: Part Type + one supply house (single seeded blank price row)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.getAllByLabelText('Remove price')).toHaveLength(1)
  })

  it('opens the Part Type picker with a type-to-filter search', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    const [partTypeTrigger] = screen.getAllByRole('combobox')
    fireEvent.click(partTypeTrigger!)
    const search = screen.getByPlaceholderText('Search…')
    fireEvent.change(search, { target: { value: 'cop' } })
    expect(screen.getByRole('option', { name: 'Copper pipe' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'PVC fittings' })).toBeNull()
  })

  it('the search takes over the box on open (in-place input, no second search field)', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    const [partTypeTrigger] = screen.getAllByRole('combobox')
    fireEvent.click(partTypeTrigger!)
    // searchReplacesTrigger: exactly one search input, rendered in the trigger's slot
    expect(screen.getAllByPlaceholderText('Search…')).toHaveLength(1)
    expect(screen.queryByText('No part type')).toBeTruthy()
  })

  it('appends a blank price row as soon as the last row gets content', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    const price = screen.getByLabelText('Price')
    fireEvent.change(price, { target: { value: '8.42' } })
    // The filled row plus a fresh trailing blank
    expect(screen.getAllByLabelText('Remove price')).toHaveLength(2)
    expect(screen.getAllByLabelText('Price')).toHaveLength(2)
  })

  it('keeps remove buttons out of the tab order (tab flows row to row)', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    for (const btn of screen.getAllByLabelText('Remove price')) {
      expect(btn.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('removing the only filled row leaves a single blank row', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '8.42' } })
    const [firstRemove] = screen.getAllByLabelText('Remove price')
    fireEvent.click(firstRemove!)
    expect(screen.getAllByLabelText('Remove price')).toHaveLength(1)
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('')
  })

  it('shows "Save & add another" only when the callback is provided', () => {
    const { unmount } = renderWithProviders(
      <PartFormModal {...makeProps({ onSaveAndAddAnother: vi.fn() })} />,
    )
    expect(screen.getByRole('button', { name: 'Save & add another' })).toBeTruthy()
    unmount()
    renderWithProviders(<PartFormModal {...makeProps()} />)
    expect(screen.queryByRole('button', { name: 'Save & add another' })).toBeNull()
  })
})

describe('PartFormModal addModeSaveLabel (v2.1392)', () => {
  it('add mode shows the custom primary label when provided', () => {
    renderWithProviders(<PartFormModal {...makeProps({ addModeSaveLabel: 'Save & add' })} />)
    expect(screen.getByRole('button', { name: 'Save & add' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('edit mode ignores the custom label — the button stays "Save"', () => {
    const editingPart = {
      id: 'p1',
      name: 'Copper elbow',
      service_type_id: 'st1',
      part_type_id: null,
      manufacturer: null,
      notes: null,
      part_types: null,
    } as unknown as Parameters<typeof PartFormModal>[0]['editingPart']
    renderWithProviders(<PartFormModal {...makeProps({ addModeSaveLabel: 'Save & add', editingPart })} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save & add' })).toBeNull()
  })

  it('without the prop, add mode keeps the plain "Save" label', () => {
    renderWithProviders(<PartFormModal {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })
})
