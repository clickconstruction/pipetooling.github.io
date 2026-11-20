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

/** Which phone the page takes itself to be on, for the Precise Location line's words (#402). */
const browser = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => browser.kind }))

/** The map, stood in for: it reports its centre once it opens and again wherever it is flown. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { center: { lat: number; lng: number } | null; flyTo?: { lat: number; lng: number } | null; onCenterChange?: (c: { lat: number; lng: number }) => void; placing?: { hint?: string } | null; emptyWords?: string }) {
    const at = props.flyTo ?? props.center
    const { onCenterChange } = props
    useEffect(() => {
      if (at) onCenterChange?.({ lat: at.lat, lng: at.lng })
    }, [at, onCenterChange])
    return (
      <div data-testid="map-stub" data-at={at ? `${at.lat},${at.lng}` : 'nowhere'}>
        {at ? props.placing?.hint : props.emptyWords}
        <button type="button" onClick={() => at && onCenterChange?.({ lat: at.lat + 0.001, lng: at.lng })}>drag the map</button>
      </div>
    )
  },
}))

import { TaskPlaceRow } from './TaskPlaceRow'
import { ADD_TASK_PICKER_Z, ROADMAP_TASK_PICKER_Z, ROADMAP_TASK_WINDOW_Z } from '../../lib/windowLayers'

const place = (name: string, lat: number): TaskPlace => ({ name, lat, lng: -98.29, accuracyM: null, setBy: 'u1', setAt: '2026-11-10T15:00:00Z' })

afterEach(() => {
  cleanup()
  offered.places = []
  phone.fix = { lat: 29.5512, lng: -98.2874, accuracyM: 6 }
  phone.refusal = null
  office.known = true
  browser.kind = 'iphone-safari'
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
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="ok"]')?.textContent).toBe('Precise Location is on. Sure within 20 ft.'))
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).toBe('29.5512,-98.2874')
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
    await waitFor(() => expect(document.querySelector('[data-task-place-fix="poor"]')?.textContent).toBe('The signal is weak here. Your phone is only sure within 400 ft. Drag the map until the ring is on the spot.'))
    // The map still went to the reading: the phone knows about where it is.
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).toBe('29.5512,-98.2874')
  })

  it('a weak signal at a margin that proves the switch on clears the switch, and still asks for the ring (#402)', async () => {
    phone.fix = { lat: 29.5512, lng: -98.2874, accuracyM: 35 }
    render(<Harness onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-fix]')?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. Drag the map until the ring is on the spot.'))
  })

  it('a rough reading does not move the map: the sheet says the switch looks off and shows the way to it (#402)', async () => {
    // The middle of an area miles from the office the map opened on.
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).toBe('29.4,-98.5')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    const alert = await screen.findByRole('alert')
    expect(document.querySelector('[data-task-place-fix]')?.getAttribute('data-task-place-fix')).toBe('rough')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The map was not moved. Drag it until the ring is on the spot, or turn the switch on and press again.')
    // The map above gives way to what is under the press, so the steps wait behind one press of their own.
    const fold = alert.querySelector('details[data-precise-steps-fold]') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(fold.querySelector('summary')?.textContent).toBe('Show the steps')
    expect(fold.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(alert.textContent).not.toMatch(/is off/)
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).toBe('29.4,-98.5')
    // The place can still be set by the ring, with no margin from a reading that was not used.
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onChange).toHaveBeenCalledWith({ lat: 29.4, lng: -98.5, name: '', accuracyM: null })
  })

  it('moves the map once the switch is on and the press is made again, and the alert goes (#402)', async () => {
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    render(<Harness onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await screen.findByRole('alert')
    phone.fix = { lat: 29.5512, lng: -98.2874, accuracyM: 4.5 }
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(document.querySelector('[data-task-place-fix="ok"]')?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).toBe('29.5512,-98.2874')
  })

  it('with nowhere to open, a rough reading opens the map wide to be dragged, and never on the middle of the area (#402)', async () => {
    office.known = false
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    render(<Harness onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    const alert = await screen.findByRole('alert')
    // The map has just opened, so the sheet does not say it was not moved.
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The map opened wide. Zoom in and drag it until the ring is on the spot, or turn the switch on and press again.')
    await waitFor(() => expect(screen.getByTestId('map-stub').getAttribute('data-at')).not.toBe('nowhere'))
    expect(screen.getByTestId('map-stub').getAttribute('data-at')).not.toBe('29.9,-98.9')
    expect((screen.getByRole('button', { name: 'Use this place' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('names no switch on a desk, in the line or in the note (#402)', async () => {
    browser.kind = 'other'
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    render(<Harness onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    await screen.findByTestId('map-stub')
    fireEvent.click(screen.getByRole('button', { name: 'Use where I am' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This device only knows the area it is in. It is only sure within 2 miles. The map was not moved. Drag it until the ring is on the spot.')
    expect(alert.textContent).not.toMatch(/the switch/)
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

  it('the sheet opens over Add a task, and over a window that sits higher when the row is told its layer', async () => {
    const first = render(<TaskPlaceRow value={null} onChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    expect(Number(document.querySelector<HTMLElement>('[data-task-place-sheet]')!.style.zIndex)).toBe(ADD_TASK_PICKER_Z)
    first.unmount()
    // A roadmap task's windows sit far above Add a task. Their sheet has to sit above them, or it opens where nobody sees it.
    render(<TaskPlaceRow value={null} onChange={() => {}} sheetZIndex={ROADMAP_TASK_PICKER_Z} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ New place' }))
    expect(Number(document.querySelector<HTMLElement>('[data-task-place-sheet]')!.style.zIndex)).toBeGreaterThan(ROADMAP_TASK_WINDOW_Z)
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
