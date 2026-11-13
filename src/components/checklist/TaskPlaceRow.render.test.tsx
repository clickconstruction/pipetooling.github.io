// @vitest-environment jsdom
/**
 * The Place row and its sheet (punch list #328, PR 2): a press on a chip gives the task a place and a
 * second press takes it off, ＋ New place opens Where is it?, Use where I am shows what the phone
 * found before anything is kept, a wide reading asks for the ring, a refusal says what to do, and a
 * press on the sheet's backdrop closes the sheet alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import type { TaskPlace, TaskPlaceDraft } from '../../lib/tasks/taskPlace'

const offered = vi.hoisted(() => ({ places: [] as TaskPlace[] }))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({ loadRecentTaskPlaces: () => Promise.resolve(offered.places) }))
const office = vi.hoisted(() => ({ known: true }))
vi.mock('../../hooks/useOfficeAnchor', () => ({ useOfficeAnchor: () => (office.known ? { lat: 29.4, lng: -98.5, source: 'office_address', label: 'Office' } : null) }))

/** The reading the phone gives on the next Use where I am, or the words of a refusal. */
const phone = vi.hoisted(() => ({ fix: { lat: 29.5512, lng: -98.2874, accuracyM: 6 as number | null }, refusal: null as string | null }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyLocation: (onOk: (p: unknown) => void, onErr: (w: string) => void) => (phone.refusal ? onErr(phone.refusal) : onOk(phone.fix)),
}))

/** The map, stood in for: it reports its centre once it opens and again wherever it is flown. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { center: { lat: number; lng: number } | null; flyTo?: { lat: number; lng: number } | null; onCenterChange?: (c: { lat: number; lng: number }) => void; placing?: { hint?: string } | null; emptyWords?: string }) {
    const at = props.flyTo ?? props.center
    const { onCenterChange } = props
    useEffect(() => {
      if (at) onCenterChange?.({ lat: at.lat, lng: at.lng })
    }, [at, onCenterChange])
    return (
      <div data-testid="map-stub">
        {at ? props.placing?.hint : props.emptyWords}
        <button type="button" onClick={() => at && onCenterChange?.({ lat: at.lat + 0.001, lng: at.lng })}>drag the map</button>
      </div>
    )
  },
}))

import { TaskPlaceRow } from './TaskPlaceRow'

const place = (name: string, lat: number): TaskPlace => ({ name, lat, lng: -98.29, accuracyM: null, setBy: 'u1', setAt: '2026-11-10T15:00:00Z' })

afterEach(() => {
  cleanup()
  offered.places = []
  phone.fix = { lat: 29.5512, lng: -98.2874, accuracyM: 6 }
  phone.refusal = null
  office.known = true
})

function Harness({ initial = null, onChange }: { initial?: TaskPlaceDraft | null; onChange: (p: TaskPlaceDraft | null) => void }) {
  return <TaskPlaceRow value={initial} onChange={onChange} />
}

describe('TaskPlaceRow', () => {
  it('offers the places used before, and nothing is pressed by default', async () => {
    offered.places = [place('Pump house', 29.55), place('North gate', 29.56)]
    render(<Harness onChange={() => {}} />)
    const chip = await screen.findByRole('button', { name: 'Pump house' })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'North gate' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Where the work is. Leave it out for a task with no place.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove the place' })).toBeNull()
  })

  it('one press on a chip gives the task that place, and a press on the lit chip takes it off', async () => {
    offered.places = [place('Pump house', 29.55)]
    const onChange = vi.fn()
    const r = render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pump house' }))
    expect(onChange).toHaveBeenLastCalledWith({ lat: 29.55, lng: -98.29, name: 'Pump house', accuracyM: null })
    r.rerender(<Harness initial={{ lat: 29.55, lng: -98.29, name: 'Pump house', accuracyM: null }} onChange={onChange} />)
    const lit = screen.getByRole('button', { name: 'Pump house' })
    expect(lit.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('The person sees this place on the task, with directions.')).toBeTruthy()
    fireEvent.click(lit)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('with no place used yet the row is the label, ＋ New place and the plain line', async () => {
    render(<Harness onChange={() => {}} />)
    expect(await screen.findByRole('button', { name: '＋ New place' })).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('＋ New place opens Where is it?, Use where I am says what the phone found, and Use this place hands back the named place with its margin', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    expect(screen.getByRole('dialog', { name: 'Where is it?' })).toBeTruthy()
    expect((await screen.findByTestId('map-stub')).textContent).toContain('Drag the map until the ring is on the spot')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="ok"]')?.textContent).toBe('Found you. Your phone is sure within 20 ft.'))
    fireEvent.change(screen.getByLabelText('Name it, to pick it next time'), { target: { value: '  Pump house ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onChange).toHaveBeenCalledWith({ lat: 29.5512, lng: -98.2874, name: 'Pump house', accuracyM: 6 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a ring dragged off the reading is the giver\'s own call: the margin is dropped and the sheet says so', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="ok"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'drag the map' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="dragged"]')?.textContent).toBe('You moved the ring. The place is where the ring is now.'))
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onChange.mock.calls[0]![0]).toMatchObject({ accuracyM: null, name: '' })
  })

  it('a wide reading is not taken quietly: the sheet asks for the ring', async () => {
    phone.fix = { lat: 29.5512, lng: -98.2874, accuracyM: 121 }
    render(<Harness onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="poor"]')?.textContent).toBe('Your phone is only sure within 400 ft. Drag the map until the ring is on the spot.'))
  })

  it('a refusal says what to do, and the map still sets the place', async () => {
    phone.refusal = 'Location is off for this app. Drag the map by hand, or allow location in the phone’s settings.'
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    expect(document.querySelector('[data-task-place-refusal]')?.textContent).toContain('Location is off for this app.')
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    // The map opened on the office, since no place has been set yet.
    expect(onChange).toHaveBeenCalledWith({ lat: 29.4, lng: -98.5, name: '', accuracyM: null })
  })

  it('with no office on record and a refusal the map opens wide, so the giver is never left without a map to drag', async () => {
    office.known = false
    phone.refusal = 'Could not find you. Drag the map by hand.'
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    expect((await screen.findByTestId('map-stub')).textContent).toContain('Press Use where I am to start the map where you stand.')
    expect((screen.getByRole('button', { name: 'Use this place' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(screen.getByTestId('map-stub').textContent).toContain('Drag the map until the ring is on the spot'))
    // The wide view's own centre is nobody's place: the press waits for a drag.
    expect((screen.getByRole('button', { name: 'Use this place' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'drag the map' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Use this place' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onChange).toHaveBeenCalledWith({ lat: 39.501, lng: -98.35, name: '', accuracyM: null })
  })

  it('a press on the sheet\'s backdrop closes the sheet alone, never the window behind it', async () => {
    const behind = vi.fn()
    render(
      <div onClick={behind}>
        <Harness onChange={() => {}} />
      </div>,
    )
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    behind.mockClear()
    fireEvent.click(document.querySelector('[data-task-place-sheet]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(behind).not.toHaveBeenCalled()
  })

  it('a place set here and not on a chip shows as its own lit chip, and Remove the place clears it', async () => {
    const onChange = vi.fn()
    render(<Harness initial={{ lat: 29.57, lng: -98.28, name: 'Hay barn', accuracyM: 9 }} onChange={onChange} />)
    const own = await screen.findByRole('button', { name: 'Hay barn' })
    expect(own.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Remove the place' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
