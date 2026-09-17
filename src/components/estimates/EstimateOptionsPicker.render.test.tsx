// @vitest-environment jsdom
/**
 * v2.3555: the picker draws choices as radio cards and add-ons as checkbox cards, in two
 * groups; every tap reports the key and the parent owns the set. A pure-choice estimate keeps
 * the v2.2457 words; an all-add-on estimate has one group and plain prices.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import EstimateOptionsPicker from './EstimateOptionsPicker'
import type { EstimateOption } from '../../lib/estimates/estimateOptions'

const line = (description: string, amount_cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, cents: number, kind: EstimateOption['kind'], recommended = false): EstimateOption => ({
  key,
  name,
  description: '',
  recommended,
  kind,
  line_items: [line(name, cents)],
})

const mixed = [opt('repair', 'Repair', 185000, 'choice'), opt('replace', 'Replace 50-gal', 340000, 'choice', true), opt('soft', 'Water softener', 195000, 'add_on'), opt('bibs', 'Hose bibs (2)', 39000, 'add_on')]
const allAddOns = [opt('kitchen', 'Kitchen rough-in', 420000, 'add_on', true), opt('bath', 'Hall bath', 365000, 'add_on')]
const pureChoice = [opt('repair', 'Repair', 185000, 'choice'), opt('replace', 'Replace 50-gal', 340000, 'choice', true)]

afterEach(() => cleanup())

describe('EstimateOptionsPicker (add-ons)', () => {
  it('a mixed estimate: radio choices under Choose one, checkbox add-ons under Add to it with a + price', () => {
    const onToggle = vi.fn()
    render(<EstimateOptionsPicker options={mixed} selectedKeys={['replace', 'bibs']} onToggle={onToggle} />)
    const choices = screen.getByTestId('estimate-options-choices')
    const addOns = screen.getByTestId('estimate-options-add-ons')
    expect(within(choices).getAllByRole('radio')).toHaveLength(2)
    expect(within(addOns).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(choices).getByText('Choose one')).toBeTruthy()
    expect(within(addOns).getByText(/Add to it/)).toBeTruthy()
    expect(within(choices).getByRole('radio', { name: 'Replace 50-gal' }).getAttribute('aria-checked')).toBe('true')
    expect(within(choices).getByRole('radio', { name: 'Repair' }).getAttribute('aria-checked')).toBe('false')
    expect(within(addOns).getByRole('checkbox', { name: 'Hose bibs (2)' }).getAttribute('aria-checked')).toBe('true')
    expect(within(addOns).getByRole('checkbox', { name: 'Water softener' }).getAttribute('aria-checked')).toBe('false')
    expect(within(addOns).getByText('+ $1,950.00')).toBeTruthy()
    expect(within(addOns).getAllByText('Add-on')).toHaveLength(2)
    fireEvent.click(within(addOns).getByRole('checkbox', { name: 'Water softener' }))
    fireEvent.click(within(choices).getByRole('radio', { name: 'Repair' }))
    expect(onToggle.mock.calls.map((c) => c[0])).toEqual(['soft', 'repair'])
  })

  it('an all-add-on estimate: one group, plain prices, no Add-on badge, keyboard toggles', () => {
    const onToggle = vi.fn()
    render(<EstimateOptionsPicker options={allAddOns} selectedKeys={[]} onToggle={onToggle} />)
    expect(screen.queryByTestId('estimate-options-choices')).toBeNull()
    const group = screen.getByTestId('estimate-options-add-ons')
    expect(within(group).getByText(/Pick what you want done/)).toBeTruthy()
    expect(within(group).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(group).getByText('$4,200.00')).toBeTruthy()
    expect(within(group).queryByText(/\+ \$/)).toBeNull()
    expect(within(group).queryByText('Add-on')).toBeNull()
    expect(within(group).getByText('Recommended')).toBeTruthy()
    fireEvent.keyDown(within(group).getByRole('checkbox', { name: 'Hall bath' }), { key: ' ' })
    expect(onToggle).toHaveBeenCalledWith('bath')
  })

  it('a pure-choice estimate keeps the v2.2457 heading and radio cards only; read-only ignores taps', () => {
    const onToggle = vi.fn()
    render(<EstimateOptionsPicker options={pureChoice} selectedKeys={['replace']} onToggle={onToggle} readOnly />)
    expect(screen.getByText('Choose your option')).toBeTruthy()
    expect(screen.queryByTestId('estimate-options-add-ons')).toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    fireEvent.click(screen.getByRole('radio', { name: 'Repair' }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('fewer than two options render nothing', () => {
    const { container } = render(<EstimateOptionsPicker options={[pureChoice[0]!]} selectedKeys={[]} onToggle={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
