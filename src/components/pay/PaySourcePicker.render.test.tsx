// @vitest-environment jsdom
/** Render smoke for the method picker (v2.3717): a pill toggles, Cash App alone opens the id box. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PaySourcePicker } from './PaySourcePicker'

describe('PaySourcePicker', () => {
  it('offers the five kinds, toggles a pill, and shows the id box for Cash App only', () => {
    const onKind = vi.fn()
    const { rerender } = render(<PaySourcePicker kind={null} onKind={onKind} cashAppId="" onCashAppId={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cash App', 'Mercury', 'Apple Pay', 'Client direct', 'Other'])
    expect(screen.queryByPlaceholderText('#D-3V3MVPKVP')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cash App' }))
    expect(onKind).toHaveBeenLastCalledWith('cashapp')
    rerender(<PaySourcePicker kind="cashapp" onKind={onKind} cashAppId="" onCashAppId={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cash App' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByPlaceholderText('#D-3V3MVPKVP')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cash App' }))
    expect(onKind).toHaveBeenLastCalledWith(null)
    rerender(<PaySourcePicker kind="mercury" onKind={onKind} cashAppId="" onCashAppId={() => {}} />)
    expect(screen.queryByPlaceholderText('#D-3V3MVPKVP')).toBeNull()
  })
})
