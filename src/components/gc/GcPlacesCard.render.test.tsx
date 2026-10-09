// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 9b: where the work is (G-83) on main's test state. The card's window keeps
 * every place that changed, a guess counting once kept; the opened bar's place line sets its place, says when a place is
 * a guess, and keeps nothing too long.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcPlaceLine, GcPlacesCard } from './GcPlaces'
import { PLACE_MAX, crowdedWeeks, type PlaceChange } from '../../lib/gc/schedule/places'
import { initialGcState } from '../../lib/gc/schedule/testState'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!

describe('where the work is (PR 9b)', () => {
  it('keeps every place that changed from the card’s window, a guess counting once kept, and closes', async () => {
    const onPlaces = vi.fn((_changes: PlaceChange[]) => Promise.resolve())
    render(<GcPlacesCard state={s} project={fairOaks} crowded={crowdedWeeks(s, fairOaks)} onPlaces={onPlaces} />)
    fireEvent.click(screen.getByRole('button', { name: 'Look at the places' }))
    const dialog = screen.getByRole('dialog', { name: 'Where the work is' })
    fireEvent.change(within(dialog).getByLabelText('Where Electrical · Fire alarm is'), { target: { value: 'Level 2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep these places' }))
    await waitFor(() => expect(onPlaces).toHaveBeenCalledTimes(1))
    expect(onPlaces.mock.calls[0]![0]).toEqual(expect.arrayContaining([{ lineId: 'felec-4', place: 'Level 2' }]))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Where the work is' })).toBeNull())
  })

  it('the opened bar’s line sets its place, saying a guess counts once set', async () => {
    const onPlaces = vi.fn((_changes: PlaceChange[]) => Promise.resolve())
    render(<GcPlaceLine project={fairOaks} lineId="froof-3" trade="Roofing" label="Sheet metal and flashing" onPlaces={onPlaces} />)
    expect((screen.getByLabelText('Where its work is') as HTMLInputElement).value).toBe('Roof')
    expect(screen.getByText(/^A guess from its .*\. It counts once you set it\.$/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set the place' }))
    await waitFor(() => expect(onPlaces).toHaveBeenCalledWith([{ lineId: 'froof-3', place: 'Roof' }]))
  })

  it('keeps no place too long, and draws no line for an inspection', () => {
    const onPlaces = vi.fn()
    const view = render(<GcPlaceLine project={fairOaks} lineId="froof-3" trade="Roofing" label="Sheet metal and flashing" onPlaces={onPlaces} />)
    fireEvent.change(screen.getByLabelText('Where its work is'), { target: { value: 'x'.repeat(PLACE_MAX + 1) } })
    expect((screen.getByRole('button', { name: 'Set the place' }) as HTMLButtonElement).disabled).toBe(true)
    view.unmount()
    const { container } = render(<GcPlaceLine project={fairOaks} lineId="fairoaksd-insp-roughin" trade="" label="Rough-in inspection" onPlaces={onPlaces} />)
    expect(container.querySelector('[data-place-line]')).toBeNull()
    expect(onPlaces).not.toHaveBeenCalled()
  })
})
