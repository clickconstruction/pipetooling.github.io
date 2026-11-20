// @vitest-environment jsdom
/**
 * The walk panel in each state of the Precise Location line (punch list #402). While the phone is
 * read the line is always there, under the length so far. A rough reading swaps the panel for the
 * way to the switch only once the window says the readings have stayed rough. Paused or refused,
 * the phone is not read and the line says nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { fromPlane } from '../../lib/paintedMap/paintedLine'
import type { PaintedFix } from '../../lib/paintedMap/paintedTrack'
import { startWalk, walkFix, walkPause, type WalkState } from '../../lib/paintedMap/paintedWalk'
import type { WalkRefusal } from '../../lib/paintedMap/paintedWalkWords'

vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => 'iphone-safari' }))

import { PaintedWalkPanel } from './PaintedWalkPanel'

const fix = (eastM: number, atMs: number, accuracyM: number | null): PaintedFix => ({ ...fromPlane({ lat: 29.5, lng: -98.2 }, { x: eastM, y: 0 }), accuracyM, atMs })
/** A walk whose newest reading has this margin. */
const reading = (accuracyM: number | null): WalkState => walkFix(startWalk(0), fix(0, 1000, accuracyM), 1000)

const presses = { onPlace: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onTryAgain: vi.fn(), onDone: vi.fn(), onDrawInstead: vi.fn() }
const draw = (state: WalkState, more: { roughHeld?: boolean; refusal?: WalkRefusal | null; awake?: 'held' | 'cannot' | 'off' } = {}) =>
  render(<PaintedWalkPanel state={state} refusal={more.refusal ?? null} awake={more.awake ?? 'held'} roughHeld={more.roughHeld ?? false} lengthM={0} placeCount={0} hasLine={false} {...presses} />)

const panel = () => document.querySelector('[data-painted-walk]')?.getAttribute('data-painted-walk')
const line = () => document.querySelector('[data-precise]')

afterEach(() => {
  cleanup()
  Object.values(presses).forEach((p) => p.mockClear())
})

describe('PaintedWalkPanel and the Precise Location line', () => {
  it('finding: before the first reading the line says so, between the length and the presses', () => {
    draw(startWalk(0))
    expect(panel()).toBe('painting')
    expect(line()?.getAttribute('data-precise')).toBe('finding')
    expect(line()?.textContent).toBe('Finding you… This takes a few seconds in the open.')
    const order = [...document.querySelector('[data-painted-walk]')!.children].map((c) => (c.hasAttribute('data-painted-walk-readout') ? 'readout' : c.hasAttribute('data-precise') ? 'line' : 'presses'))
    expect(order).toEqual(['readout', 'line', 'presses'])
  })

  it('on: a sure reading names the switch, with no chip at the right of the length', () => {
    draw(reading(4.5))
    expect(line()?.getAttribute('data-precise')).toBe('on')
    expect(line()?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(document.querySelector('[data-painted-sure]')).toBeNull()
    expect(document.querySelector('[data-painted-walk-readout]')?.textContent).toBe('A new linestart walking')
  })

  it('weak, the switch proven: one amber box clears the switch and says the part is drawn faint', () => {
    draw(reading(35))
    expect(line()?.getAttribute('data-precise')).toBe('weak')
    expect(line()?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. This part is drawn faint. Fix it by hand when you look the line over.')
    // One box, not a chip and a box.
    expect(document.querySelectorAll('[data-painted-walk] [role="status"]')).toHaveLength(1)
  })

  it('weak, past 100 m: the switch is not named either way', () => {
    draw(reading(300))
    expect(line()?.textContent).toBe('The signal is weak here. Your phone is only sure within 990 ft. This part is drawn faint. Fix it by hand when you look the line over.')
  })

  it('rough, still waited on: the panel keeps painting’s presses and the line is still finding you', () => {
    draw(reading(3200), { roughHeld: false })
    expect(panel()).toBe('painting')
    expect(line()?.textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(screen.getByRole('button', { name: '＋ Place' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Draw it by hand instead' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rough, stayed rough: the way to the switch, why no line is painted, and drawing by hand', () => {
    draw(reading(3200), { roughHeld: true })
    expect(panel()).toBe('rough')
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('A line cannot be painted from a reading that wide.')
    expect(alert.querySelectorAll('[data-precise-steps] li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand instead' }))
    expect(presses.onDrawInstead).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(presses.onPause).toHaveBeenCalledTimes(1)
  })

  it('the window’s word alone never makes a sure reading rough', () => {
    draw(reading(4.5), { roughHeld: true })
    expect(panel()).toBe('painting')
    expect(line()?.getAttribute('data-precise')).toBe('on')
  })

  it('paused: the phone is not read, so nothing is said about its location, whatever the last reading was', () => {
    for (const m of [4.5, 35, 3200]) {
      const view = draw(walkPause(reading(m), 5000), { roughHeld: true })
      expect(panel(), `${m}`).toBe('paused-press')
      expect(line(), `${m}`).toBeNull()
      expect(screen.getByText('Paused.')).toBeTruthy()
      view.unmount()
    }
  })

  it('refused: the refusal’s own words stand alone', () => {
    draw(reading(3200), { roughHeld: true, refusal: 'refused' })
    expect(panel()).toBe('refused')
    expect(line()).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Location is off for this app')
  })

  it('keeps the note for a phone that cannot hold its screen on under the line', () => {
    draw(reading(4.5), { awake: 'cannot' })
    expect(line()?.nextElementSibling?.textContent).toMatch(/cannot hold its own screen on/)
  })
})
