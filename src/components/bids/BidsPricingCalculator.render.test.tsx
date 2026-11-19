// @vitest-environment jsdom
/**
 * The Pricing Tape's two presses that send its answer to the Workbench: **Put on a row…** and
 * **Make a new row…**. The math itself is pinned in `lib/tapeCalculator.test.ts`; this pins when
 * the presses are drawn, when they are live, and what they send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))

import { setPricingTapeSink } from '../../lib/bids/pricingTapeBridge'
import { BidsPricingCalculator } from './BidsPricingCalculator'

const press = (...keys: string[]) => {
  for (const k of keys) fireEvent.click(screen.getByRole('button', { name: k }))
}
const sendRow = () => within(screen.getByTestId('tape-send')).getByRole('button', { name: 'Put on a row…' }) as HTMLButtonElement
const sendNew = () => within(screen.getByTestId('tape-send')).getByRole('button', { name: 'Make a new row…' }) as HTMLButtonElement

beforeEach(() => {
  localStorage.clear()
  // The calculator opens unfolded.
  localStorage.setItem('pipetooling_pricing_tape_open_v1', 'true')
})
afterEach(() => {
  cleanup()
  act(() => setPricingTapeSink(null))
})

describe('BidsPricingCalculator: sending the answer to Pricing', () => {
  it('draws no send presses while no Workbench can take an answer', () => {
    render(<BidsPricingCalculator />)
    expect(screen.queryByTestId('tape-send')).toBeNull()
  })

  it('draws both presses once the Workbench sets its sink, and takes them away when it clears it', () => {
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send: vi.fn() }))
    expect(sendRow()).toBeTruthy()
    expect(sendNew()).toBeTruthy()
    act(() => setPricingTapeSink(null))
    expect(screen.queryByTestId('tape-send')).toBeNull()
  })

  it('sends a typed number as itself', () => {
    const send = vi.fn()
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send }))
    press('9', '0', '0')
    fireEvent.click(sendNew())
    expect(send).toHaveBeenCalledWith({ value: 900, words: '900', rule: null }, 'new-row')
  })

  it('right after = it sends the answer with the tape’s own line', () => {
    const send = vi.fn()
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send }))
    press('6', '2', '0', '0', '×', '.', '4', '=')
    fireEvent.click(sendRow())
    expect(send).toHaveBeenCalledWith({ value: 2480, words: '6,200 × 0.4 = 2,480', rule: null }, 'row')
  })

  it('holds both presses on a number below zero', () => {
    const send = vi.fn()
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send }))
    press('1', '−', '5', '=')
    expect(sendRow().disabled).toBe(true)
    expect(sendNew().disabled).toBe(true)
    fireEvent.click(sendNew())
    expect(send).not.toHaveBeenCalled()
  })
})
