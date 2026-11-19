// @vitest-environment jsdom
/**
 * The Pricing Tape's two presses that send its answer to the Workbench: **Put on a row…** and
 * **Make a new row…**. The math itself is pinned in `lib/tapeCalculator.test.ts`; this pins when
 * the presses are drawn, when they are live, and what they send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))

import { getPricingTapeOpen, setPricingTapeSink } from '../../lib/bids/pricingTapeBridge'
import { TAPE_DRAG_TYPE, serializeTapeLine, type TapeDragLine } from '../../lib/bids/tapeDrag'
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

describe('BidsPricingCalculator: a line of the bid dragged in', () => {
  const PIPE: TapeDragLine = {
    label: 'Pipe',
    sub: '5 rows',
    sourceKey: 'kind:pipe',
    numbers: [
      { key: 'revenue', label: 'Revenue', value: 6200, display: '$6,200.00', hold: null },
      { key: 'count', label: 'Count', value: 300, display: '300 ft', hold: null },
      { key: 'cost', label: 'Cost', value: null, display: 'none on these rows', hold: 'These rows carry no takeoff cost yet' },
    ],
  }
  const carrying = (text: string, type = TAPE_DRAG_TYPE) => ({ dataTransfer: { types: [type], getData: (t: string) => (t === type ? text : '') } })
  const panel = () => screen.getByText('Calculator').closest('div')!.parentElement as HTMLElement
  const dropLine = (line: TapeDragLine = PIPE) => fireEvent.drop(panel(), carrying(serializeTapeLine(line)))

  it('says it is unfolded, so the Workbench can draw its grips, and says so no more once folded', () => {
    render(<BidsPricingCalculator />)
    expect(getPricingTapeOpen()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Tuck the calculator away' }))
    expect(getPricingTapeOpen()).toBe(false)
  })

  it('shows where to drop while a line is over it, and takes nothing that is not a line of the bid', () => {
    render(<BidsPricingCalculator />)
    fireEvent.dragOver(panel(), carrying('x', 'text/plain'))
    expect(screen.queryByTestId('tape-drop')).toBeNull()
    fireEvent.dragOver(panel(), carrying(serializeTapeLine(PIPE)))
    expect(screen.getByTestId('tape-drop').textContent).toBe('Drop the line here')
    fireEvent.drop(panel(), carrying('not a line'))
    expect(screen.queryByTestId('tape-drop')).toBeNull()
    expect(screen.queryByTestId('tape-ask')).toBeNull()
  })

  it('asks which number in the tape’s place, with a dead press where the line has none', () => {
    render(<BidsPricingCalculator />)
    dropLine()
    const ask = within(screen.getByTestId('tape-ask'))
    expect(ask.getByText('Pipe · 5 rows. Which number?')).toBeTruthy()
    expect((ask.getByRole('button', { name: 'Revenue $6,200.00' }) as HTMLButtonElement).disabled).toBe(false)
    expect((ask.getByRole('button', { name: 'Count 300 ft' }) as HTMLButtonElement).disabled).toBe(false)
    expect((ask.getByRole('button', { name: 'Cost none on these rows' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(ask.getByRole('button', { name: 'Never mind' }))
    expect(screen.queryByTestId('tape-ask')).toBeNull()
  })

  it('the picked number lands on the tape with its name, and × .4 = sends the rule behind the answer', () => {
    const send = vi.fn()
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send }))
    dropLine()
    fireEvent.click(within(screen.getByTestId('tape-ask')).getByRole('button', { name: 'Revenue $6,200.00' }))
    expect(screen.queryByTestId('tape-ask')).toBeNull()
    expect(screen.getByText('Pipe revenue =')).toBeTruthy()
    press('×', '.', '4', '=')
    expect(screen.getByText('Pipe revenue × 0.4 =')).toBeTruthy()
    fireEvent.click(sendNew())
    expect(send).toHaveBeenCalledWith({ value: 2480, words: 'Pipe revenue × 0.4 = 2,480', rule: { pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' } }, 'new-row')
  })

  it('a count carries no rule: the answer is sent as a plain number', () => {
    const send = vi.fn()
    render(<BidsPricingCalculator />)
    act(() => setPricingTapeSink({ send }))
    dropLine()
    fireEvent.click(within(screen.getByTestId('tape-ask')).getByRole('button', { name: 'Count 300 ft' }))
    press('×', '2', '=')
    fireEvent.click(sendNew())
    expect(send).toHaveBeenCalledWith({ value: 600, words: 'Pipe count × 2 = 600', rule: null }, 'new-row')
  })
})
