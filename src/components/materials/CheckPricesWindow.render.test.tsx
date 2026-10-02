// @vitest-environment jsdom
/**
 * Render smoke for Check 20 prices (v2.4392): the list, Same, a typed price with its change, a
 * typo and a big jump caught before the save, a refused save, and what closing reports.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CheckPricesWindow } from './CheckPricesWindow'
import type { CheckItem } from '../../lib/materials/materialPriceIndex'

beforeEach(() => {
  // jsdom has no matchMedia; the window's shell asks it whether this is a phone (≤640px). Desktop here.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => cleanup())

const items: CheckItem[] = [
  { priceId: 'p-toilet', partId: 'toilet', houseId: 'moore', partName: 'ETWS-1490-CM-BS', houseName: 'Moore Supply', price: 1993.1, lastCheckedDay: '2026-04-14', spendShare: 0.031 },
  { priceId: 'p-tank', partId: 'tank', houseId: 'reece', partName: 'EXPANSION TANK', houseName: 'Reece', price: 83.8, lastCheckedDay: '2026-06-12', spendShare: 0.02 },
  { priceId: 'p-new', partId: 'new', houseId: 'reece', partName: 'NEW PART', houseName: 'Reece', price: 10, lastCheckedDay: null, spendShare: 0.01 },
]

function setup(over: Partial<Parameters<typeof CheckPricesWindow>[0]> = {}) {
  const props = {
    items,
    onConfirm: vi.fn(async () => ({ ok: true as const })),
    onSave: vi.fn(async () => ({ ok: true as const })),
    onClose: vi.fn(),
    ...over,
  }
  render(<CheckPricesWindow {...props} />)
  return props
}

const rowOf = (name: string) => screen.getByText(name).closest('li') as HTMLElement

describe('CheckPricesWindow', () => {
  it('lists each part with its house, price and last check, and counts none checked yet', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Check 3 prices' })).toBeTruthy()
    expect(rowOf('ETWS-1490-CM-BS').textContent).toContain('Moore Supply · $1,993.10 · last checked Apr 14')
    expect(rowOf('NEW PART').textContent).toContain('no check on record')
    expect(screen.getByText('0 of 3 checked')).toBeTruthy()
  })

  it('Same confirms the price and counts it, with its share of your bid spend', async () => {
    const p = setup()
    fireEvent.click(within(rowOf('ETWS-1490-CM-BS')).getByRole('button', { name: 'Same' }))
    await screen.findByText('✓ Same as before')
    expect(p.onConfirm).toHaveBeenCalledWith('p-toilet')
    expect(p.onSave).not.toHaveBeenCalled()
    expect(screen.getByText('1 of 3 checked')).toBeTruthy()
    expect(screen.getByText('3% of your bid spend')).toBeTruthy()
  })

  it('a typed price shows its change, turns Same into Save, and saves the number', async () => {
    const p = setup()
    const row = rowOf('EXPANSION TANK')
    fireEvent.change(within(row).getByRole('textbox', { name: 'Today’s price for EXPANSION TANK' }), { target: { value: '$86.67' } })
    expect(row.textContent).toContain('Up 3.4% from $83.80.')
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
    await screen.findByText('✓ Saved at $86.67')
    expect(p.onSave).toHaveBeenCalledWith('p-tank', 86.67)
  })

  it('Enter saves too', async () => {
    const p = setup()
    const input = within(rowOf('EXPANSION TANK')).getByRole('textbox')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(p.onSave).toHaveBeenCalledWith('p-tank', 80))
  })

  it('a typo holds the save and says what a price looks like', () => {
    const p = setup()
    const row = rowOf('EXPANSION TANK')
    fireEvent.change(within(row).getByRole('textbox'), { target: { value: '8o.5' } })
    expect(row.textContent).toContain('Type a price like 12.50.')
    expect((within(row).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(p.onSave).not.toHaveBeenCalled()
  })

  it('warns on a big jump before the save', () => {
    setup()
    const row = rowOf('EXPANSION TANK')
    fireEvent.change(within(row).getByRole('textbox'), { target: { value: '838' } })
    expect(row.textContent).toContain('That is a big change from $83.80. Check the size and the pack before you save.')
    expect(row.textContent).not.toContain('Up ')
  })

  it('a refused save says why and keeps the typed price to try again', async () => {
    setup({ onSave: vi.fn(async () => ({ ok: false as const, message: 'This account can’t change prices.' })) })
    const row = rowOf('EXPANSION TANK')
    fireEvent.change(within(row).getByRole('textbox'), { target: { value: '86' } })
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
    await within(row).findByText('Couldn’t save: This account can’t change prices.')
    expect((within(row).getByRole('textbox') as HTMLInputElement).value).toBe('86')
    expect(screen.getByText('0 of 3 checked')).toBeTruthy()
  })

  it('closing says whether anything was written', async () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Finish later' }))
    expect(p.onClose).toHaveBeenLastCalledWith(false)
    fireEvent.click(within(rowOf('NEW PART')).getByRole('button', { name: 'Same' }))
    await screen.findByText('✓ Same as before')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(p.onClose).toHaveBeenLastCalledWith(true)
  })
})
