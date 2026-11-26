// @vitest-environment jsdom
/**
 * The Bridge's rule line (punch list #321, finding 275): one press on the ? opens the long reading, and the next
 * shuts it. Before, the focus or the pointer's arrival opened it and the same press's click toggled it shut.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeRule } from './BridgeRule'

afterEach(cleanup)

const press = () => screen.getByRole('button', { name: 'Why this rule' })
const reading = () => screen.queryByTestId('bridge-rule-popover')

describe('BridgeRule: the ? beside the rule line', () => {
  it('a tap opens the reading: the focus it gives and the click that follows are one press', () => {
    renderWithProviders(<BridgeRule />)
    expect(reading()).toBeNull()
    expect(press().getAttribute('aria-expanded')).toBe('false')
    fireEvent.focus(press())
    fireEvent.click(press())
    expect(reading()).not.toBeNull()
    expect(press().getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(press())
    expect(reading()).toBeNull()
    expect(press().getAttribute('aria-expanded')).toBe('false')
  })

  it('a click by a mouse opens it too: the pointer’s arrival and the click are one press', () => {
    renderWithProviders(<BridgeRule />)
    fireEvent.mouseEnter(screen.getByTestId('bridge-rule'))
    expect(reading()).not.toBeNull()
    fireEvent.click(press())
    expect(reading()).not.toBeNull()
    fireEvent.click(press())
    expect(reading()).toBeNull()
    // The pointer leaving shuts a pressed reading, as it always did.
    fireEvent.click(press())
    expect(reading()).not.toBeNull()
    fireEvent.mouseLeave(screen.getByTestId('bridge-rule'))
    expect(reading()).toBeNull()
  })

  it('a look alone still opens it for a mouse and a keyboard, and it shuts when the look ends', () => {
    renderWithProviders(<BridgeRule />)
    fireEvent.mouseEnter(screen.getByTestId('bridge-rule'))
    expect(reading()).not.toBeNull()
    fireEvent.mouseLeave(screen.getByTestId('bridge-rule'))
    expect(reading()).toBeNull()
    fireEvent.focus(press())
    expect(reading()).not.toBeNull()
    fireEvent.blur(press())
    expect(reading()).toBeNull()
  })

  it('Escape and a press outside shut a pressed reading, and a press inside the reading does not', () => {
    renderWithProviders(<BridgeRule />)
    fireEvent.click(press())
    fireEvent.pointerDown(reading()!)
    expect(reading()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(reading()).toBeNull()
    fireEvent.click(press())
    expect(reading()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(reading()).toBeNull()
  })
})
