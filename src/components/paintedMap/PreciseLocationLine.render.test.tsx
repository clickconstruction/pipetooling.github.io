// @vitest-environment jsdom
/**
 * The Precise Location line, drawn in every state (punch list #402): finding, on, a weak signal,
 * and a rough area with the two numbers side by side and the steps for this phone alone.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PHONE_KINDS, preciseSteps } from '../../lib/paintedMap/preciseLocation'
import { PreciseLocationLine, PreciseSteps } from './PreciseLocationLine'

afterEach(cleanup)

const line = () => document.querySelector('[data-precise]') as HTMLElement
const steps = () => [...document.querySelectorAll('[data-precise-steps] li')].map((li) => li.textContent)

describe('PreciseLocationLine', () => {
  it('says it is finding you with no reading, in grey, with no tick', () => {
    render(<PreciseLocationLine accuracyM={null} kind="iphone-safari" roughHeld={false} />)
    expect(line().getAttribute('data-precise')).toBe('finding')
    expect(line().textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(screen.getByRole('status').textContent).toBe('Finding you…')
    expect(line().style.color).toBe('var(--text-muted)')
    expect(document.querySelector('[data-precise-tick]')).toBeNull()
  })

  it('says the same for a rough reading the screen is still waiting on, and shows no steps yet', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="iphone-safari" roughHeld={false} roughNote="A note." />)
    expect(line().getAttribute('data-precise')).toBe('finding')
    expect(line().textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(document.querySelector('[data-precise-steps]')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says the switch is on with a tick, in the green that reads in both themes', () => {
    render(<PreciseLocationLine accuracyM={4.5} kind="iphone-safari" roughHeld={false} weakNote="Not said." roughNote="Not said." />)
    expect(line().getAttribute('data-precise')).toBe('on')
    expect(line().textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(line().style.color).toBe('var(--text-green-700)')
    expect(line().querySelector('[data-precise-tick]')).toBeTruthy()
    // The lead is what is spoken on a change. The margin beside it moves each second and is not.
    expect(screen.getByRole('status').textContent).toBe('Precise Location is on.')
  })

  it('puts a weak signal in one amber box, with what the screen does about it', () => {
    render(<PreciseLocationLine accuracyM={35} kind="iphone-safari" roughHeld={false} weakNote="This part is drawn faint." roughNote="Not said." />)
    expect(line().getAttribute('data-precise')).toBe('weak')
    expect(line().textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. This part is drawn faint.')
    expect(line().style.color).toBe('var(--text-amber-800)')
    expect(line().style.background).toBe('var(--bg-amber-tint)')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says only that the signal is weak past 100 m, and needs no note', () => {
    render(<PreciseLocationLine accuracyM={300} kind="iphone-safari" roughHeld />)
    expect(line().textContent).toBe('The signal is weak here. Your phone is only sure within 990 ft.')
  })

  it('shows a rough reading as an alert: looks off, the two numbers, the screen’s note, this phone’s steps', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="iphone-safari" roughHeld weakNote="Not said." roughNote="A line cannot be painted from a reading that wide." />)
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-precise')).toBe('rough')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    const cells = [...alert.querySelectorAll('[data-precise-compare] dt, [data-precise-compare] dd')].map((c) => c.textContent)
    expect(cells).toEqual(['Your phone now', 'within 2 miles', 'With Precise Location on', 'within 20 ft'])
    // The number a phone is usually sure of is green: it is where the switch gets you.
    expect((alert.querySelectorAll('[data-precise-compare] dd')[1] as HTMLElement).style.color).toBe('var(--text-green-700)')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('A line cannot be painted from a reading that wide.')
    expect(steps()).toEqual(preciseSteps('iphone-safari'))
    expect(alert.querySelector('ol[data-precise-steps]')).toBeTruthy()
    expect(alert.querySelector('[data-precise-already-on]')?.textContent).toMatch(/^Already on\?/)
    expect(alert.textContent).not.toContain('Not said.')
    expect(alert.textContent).not.toMatch(/is off/)
  })

  it('gives every phone its own steps and no other phone’s', () => {
    for (const kind of PHONE_KINDS) {
      const view = render(<PreciseLocationLine accuracyM={3200} kind={kind} roughHeld />)
      expect(steps(), kind).toEqual(preciseSteps(kind))
      view.unmount()
    }
  })

  it('uses Android’s own names', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="android" roughHeld />)
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toContain('With Use precise location on')
  })

  it('names no switch on a desk: the words, one line for each kind of phone, and nothing set beside them', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="other" roughHeld roughNote="A line cannot be painted from a reading that wide." />)
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('This device only knows the area it is in.')
    expect(alert.querySelector('[data-precise-compare]')).toBeNull()
    expect(alert.textContent).toContain('This device only knows the area it is in. It is only sure within 2 miles. A line cannot be painted from a reading that wide.')
    // Not numbered: a person does one of the two, not one after the other.
    expect(alert.querySelector('ul[data-precise-steps]')).toBeTruthy()
    expect(alert.querySelector('ol')).toBeNull()
    cleanup()
    render(<PreciseLocationLine accuracyM={4.5} kind="other" roughHeld={false} />)
    expect(line().textContent).toBe('Found you. Sure within 15 ft.')
    cleanup()
    render(<PreciseLocationLine accuracyM={35} kind="other" roughHeld={false} />)
    expect(line().textContent).toBe('The signal is weak here. This device is only sure within 120 ft.')
  })
})

describe('the steps behind one press', () => {
  it('keeps the steps one press away on a sheet whose map needs the room, and says nothing less', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="iphone-safari" roughHeld roughNote="The map was not moved." foldSteps />)
    const alert = screen.getByRole('alert')
    const fold = alert.querySelector('details[data-precise-steps-fold]') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(fold.querySelector('summary')?.textContent).toBe('Show the steps')
    // The lead, the two numbers and the screen's note stay in the open.
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.parentElement).toBe(alert)
    expect(alert.querySelector('[data-precise-note]')?.parentElement).toBe(alert)
    // The steps and the line for a switch that was on all along are both behind it.
    expect([...fold.querySelectorAll('ol[data-precise-steps] li')].map((li) => li.textContent)).toEqual(preciseSteps('iphone-safari'))
    expect(fold.querySelector('[data-precise-already-on]')).toBeTruthy()
  })

  it('draws the steps in the open everywhere else', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="iphone-safari" roughHeld />)
    expect(document.querySelector('[data-precise-steps-fold]')).toBeNull()
    expect(steps()).toEqual(preciseSteps('iphone-safari'))
  })

  it('names no switch on the press, so a desk reads it the same', () => {
    render(<PreciseLocationLine accuracyM={3200} kind="other" roughHeld foldSteps />)
    expect(document.querySelector('[data-precise-steps-fold] summary')?.textContent).not.toMatch(/switch|precise/i)
  })
})

describe('PreciseSteps', () => {
  it('numbers a phone’s own steps, and ends on the line for a switch that was on all along', () => {
    render(<PreciseSteps kind="iphone-chrome" />)
    expect(document.querySelector('ol[data-precise-steps="iphone-chrome"]')).toBeTruthy()
    expect(steps()[2]).toBe('Tap Chrome.')
    expect(document.querySelector('[data-precise-already-on]')?.textContent).toBe('Already on? Step into the open and wait a moment. The phone may only be hearing a cell tower.')
  })
})
