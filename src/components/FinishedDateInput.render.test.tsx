// @vitest-environment jsdom
/**
 * FinishedDateInput: the date box for a field that saves as you go. A half-typed year is
 * never handed over; a typed date waits until the box is left or Enter is pressed; a pick
 * from the calendar goes through at once; a box left unfinished goes back to what it showed.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { FinishedDateInput } from './FinishedDateInput'

afterEach(cleanup)

/** The box over a saved date the way a screen holds it: a commit becomes the saved date. */
function Box({ initial, onCommit }: { initial: string | null; onCommit: (v: string | null) => void }) {
  const [saved, setSaved] = useState(initial)
  return <FinishedDateInput aria-label="the date" value={saved} onCommit={(v) => { onCommit(v); setSaved(v) }} />
}

function mount(initial: string | null) {
  const onCommit = vi.fn()
  renderWithProviders(<Box initial={initial} onCommit={onCommit} />)
  return { box: screen.getByLabelText('the date') as HTMLInputElement, onCommit }
}

const badInput = (box: HTMLInputElement, bad: boolean) => Object.defineProperty(box, 'validity', { value: { badInput: bad }, configurable: true })

describe('FinishedDateInput', () => {
  it('a pick from the calendar (no key pressed) hands over a finished date at once; a half-typed year is held', () => {
    const { box, onCommit } = mount(null)
    // The browser hands over 0002-09-30 when the first digit of the year lands.
    fireEvent.change(box, { target: { value: '0002-09-30' } })
    expect(onCommit).not.toHaveBeenCalled()
    expect(box.value).toBe('0002-09-30')
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('2026-09-30')
    expect(box.value).toBe('2026-09-30')
  })

  it('a typed date waits for the box to be left: the year one digit at a time hands over once', () => {
    const { box, onCommit } = mount(null)
    for (const [key, value] of [['2', '0002-09-30'], ['0', '0020-09-30'], ['2', '0202-09-30'], ['6', '2026-09-30']] as const) {
      fireEvent.keyDown(box, { key })
      fireEvent.change(box, { target: { value } })
    }
    expect(onCommit).not.toHaveBeenCalled()
    expect(box.value).toBe('2026-09-30')
    fireEvent.blur(box)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('2026-09-30')
  })

  it('a day changed 25 → 15 passes through a plausible 01 and hands over only the last one', () => {
    const { box, onCommit } = mount('2026-09-25')
    fireEvent.keyDown(box, { key: '1' })
    fireEvent.change(box, { target: { value: '2026-09-01' } })
    fireEvent.keyDown(box, { key: '5' })
    fireEvent.change(box, { target: { value: '2026-09-15' } })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.blur(box)
    expect(onCommit.mock.calls).toEqual([['2026-09-15']])
  })

  it('left with the year half typed: nothing is handed over, the box goes back, and a line says why', () => {
    const { box, onCommit } = mount('2026-09-25')
    fireEvent.keyDown(box, { key: '2' })
    fireEvent.change(box, { target: { value: '0002-09-25' } })
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalled()
    expect(box.value).toBe('2026-09-25')
    expect(screen.getByText(/That date was not finished, so it was not saved/)).toBeTruthy()
  })

  it('left with a part missing (09/dd/2026): the browser reports no date — that is not a cleared box', () => {
    const { box, onCommit } = mount('2026-09-25')
    fireEvent.keyDown(box, { key: 'Backspace' })
    fireEvent.change(box, { target: { value: '' } })
    badInput(box, true)
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalled()
    expect(box.value).toBe('2026-09-25')
    expect(screen.getByText(/That date was not finished/)).toBeTruthy()
  })

  it('an empty box left with only a month typed is wiped, with nothing handed over', () => {
    const { box, onCommit } = mount(null)
    fireEvent.keyDown(box, { key: '9' })
    badInput(box, true)
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalled()
    expect(box.value).toBe('')
    expect(screen.getByText(/That date was not finished/)).toBeTruthy()
  })

  it('Enter hands over a typed date without leaving the box; leaving afterwards does not hand it over twice', () => {
    const { box, onCommit } = mount('2026-09-25')
    fireEvent.keyDown(box, { key: '6' })
    fireEvent.change(box, { target: { value: '2026-09-26' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onCommit.mock.calls).toEqual([['2026-09-26']])
    fireEvent.blur(box)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('an emptied box hands over null; the date it already shows hands over nothing', () => {
    const { box, onCommit } = mount('2026-09-25')
    // Typed away and back again.
    fireEvent.keyDown(box, { key: '6' })
    fireEvent.change(box, { target: { value: '2026-09-26' } })
    fireEvent.keyDown(box, { key: '5' })
    fireEvent.change(box, { target: { value: '2026-09-25' } })
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Backspace' })
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.blur(box)
    expect(onCommit.mock.calls).toEqual([[null]])
    expect(box.value).toBe('')
  })

  it('a click in the box after typing makes the next change a pick again', () => {
    const { box, onCommit } = mount(null)
    fireEvent.keyDown(box, { key: '9' })
    fireEvent.pointerDown(box)
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    expect(onCommit.mock.calls).toEqual([['2026-09-30']])
  })
})
