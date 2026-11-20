// @vitest-environment jsdom
/**
 * The place panel under **Put the dot where I am** (punch list #402, call 5). One reading, asked
 * for by the press: the Precise Location line says how it did. A rough reading says the dot was not
 * moved and shows the way to the switch. With no reading taken on this visit the panel says nothing
 * of the phone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const browser = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => browser.kind }))
vi.mock('../../hooks/useTaskShot', () => ({ useTaskShot: () => ({ shot: null, shrinking: false, kept: false, error: null, pick: async () => {}, clear: () => {}, markKept: () => {} }) }))

import { PaintedPlacePanel } from './PaintedPlacePanel'

const presses = { onUseWhereIAm: vi.fn(), onSave: vi.fn(), onRemove: vi.fn(), onCancel: vi.fn() }
const draw = (more: { accuracyM?: number | null; roughAccuracyM?: number | null; movedOffReading?: boolean; finding?: boolean } = {}) =>
  render(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={more.accuracyM ?? null} roughAccuracyM={more.roughAccuracyM ?? null} movedOffReading={more.movedOffReading ?? false} finding={more.finding ?? false} busy={false} canRemove={false} {...presses} />)

const fix = () => document.querySelector('[data-painted-place-fix]')
const HINT = 'Drag the blue dot onto the spot, or press the map to bring it there. Your phone is read once, on that press, and not followed.'

afterEach(() => {
  cleanup()
  browser.kind = 'iphone-safari'
  Object.values(presses).forEach((p) => p.mockClear())
})

describe('PaintedPlacePanel and one reading of the phone', () => {
  it('says how the press works before any reading, and nothing of the phone', () => {
    draw()
    expect(screen.getByText(HINT)).toBeTruthy()
    expect(document.querySelector('[data-precise]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    expect(presses.onUseWhereIAm).toHaveBeenCalledTimes(1)
  })

  it('holds the press while the phone is read', () => {
    draw({ finding: true })
    expect((screen.getByRole('button', { name: 'Finding you…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a sure reading: the switch is on, with the tick', () => {
    draw({ accuracyM: 4.5 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('read')
    expect(fix()?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(fix()?.querySelector('[data-precise-tick]')).toBeTruthy()
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('a weak reading: one amber box, and a drag the rest of the way', () => {
    draw({ accuracyM: 35 })
    expect(fix()?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. Drag the dot onto the spot.')
    cleanup()
    draw({ accuracyM: 300 })
    expect(fix()?.textContent).toBe('The signal is weak here. Your phone is only sure within 990 ft. Drag the dot onto the spot.')
  })

  it('a rough reading: the dot was not moved, why, and the steps for this phone', () => {
    draw({ roughAccuracyM: 3200 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('rough')
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press again.')
    expect([...alert.querySelectorAll('ol[data-precise-steps] li')].map((li) => li.textContent)).toEqual(['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', 'Tap Safari Websites.', 'Turn on Precise Location.', 'Come back to this screen.'])
    // The press stays live: turning the switch on and pressing again is one of the two ways on.
    expect((screen.getByRole('button', { name: 'Put the dot where I am' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('brings a rough reading’s words into view, since nothing on the map moved to show the press did anything', () => {
    const seen: Array<string | null> = []
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.getAttribute('data-painted-place-fix'))
    }
    try {
      const view = draw({ accuracyM: 4.5 })
      expect(seen).toEqual([])
      view.rerender(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={4.5} roughAccuracyM={3200} movedOffReading={false} finding={false} busy={false} canRemove={false} {...presses} />)
      expect(seen).toEqual(['rough'])
      // The same rough answer drawn again does not pull the panel about.
      view.rerender(<PaintedPlacePanel place={null} photoUrl={null} accuracyM={4.5} roughAccuracyM={3200} movedOffReading={false} finding busy={false} canRemove={false} {...presses} />)
      expect(seen).toEqual(['rough'])
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('a rough reading wins over an earlier good one: the newest press is what is spoken of', () => {
    draw({ accuracyM: 4.5, roughAccuracyM: 3200 })
    expect(fix()?.getAttribute('data-painted-place-fix')).toBe('rough')
    expect(document.querySelectorAll('[data-precise]')).toHaveLength(1)
  })

  it('on Android the switch has Android’s name', () => {
    browser.kind = 'android'
    draw({ roughAccuracyM: 3200 })
    expect(screen.getByRole('alert').querySelector('b')?.textContent).toBe('Precise location looks off.')
    expect(screen.getByRole('alert').textContent).toContain('Turn on Use precise location.')
  })

  it('on a desk no switch is named, in the line or in the note', () => {
    browser.kind = 'other'
    draw({ roughAccuracyM: 3200 })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This device only knows the area it is in. It is only sure within 2 miles. The dot was not moved. Drag it onto the spot by hand.')
    expect(alert.textContent).not.toMatch(/the switch/)
    cleanup()
    draw({ accuracyM: 4.5 })
    expect(fix()?.textContent).toBe('Found you. Sure within 15 ft.')
  })

  it('says the dot was moved by hand once it is off its reading', () => {
    draw({ movedOffReading: true })
    expect(screen.getByRole('status').textContent).toBe('You moved the dot. The place is where the dot is now.')
    expect(document.querySelector('[data-precise]')).toBeNull()
  })
})
