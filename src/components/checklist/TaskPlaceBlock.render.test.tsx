// @vitest-environment jsdom
/**
 * A task's place as the doer sees it (punch list #328, PR 3): the name on the card, and opened, a
 * picture of the spot, Directions, and How far am I? on a press. The phone is asked only on that
 * press, a refusal costs the distance alone, and with no signal the block says so and still answers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskPlace } from '../../lib/tasks/taskPlace'

const phone = vi.hoisted(() => ({ asked: 0, fix: { lat: 29.5, lng: -98.3, accuracyM: 9 as number | null }, why: null as null | 'none' | 'refused' | 'failed' }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyFix: (onOk: (p: unknown) => void, onFail: (w: string) => void) => {
    phone.asked += 1
    if (phone.why) onFail(phone.why)
    else onOk(phone.fix)
  },
}))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

/** The map, stood in for: it lists its dots, says whether it is still, and can lose its tiles. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { pins: Array<{ id: string; label: string }>; still?: boolean; onTilesFailed?: () => void }) {
    return (
      <div data-testid={props.still ? 'still-map' : 'big-map'}>
        {props.pins.map((p) => p.label).join(' | ')}
        {props.still ? <button type="button" onClick={(e) => { e.stopPropagation(); props.onTilesFailed?.() }}>lose the signal</button> : null}
      </div>
    )
  },
}))

import { TaskPlaceBlock, TaskPlaceLine, TaskSpotPhotoView } from './TaskPlaceBlock'

// About 76 m north-east of where the phone says it is.
const PLACE: TaskPlace = {
  name: 'Pump house',
  lat: 29.5 + 54 / 111195,
  lng: -98.3 + 54 / (111195 * Math.cos((29.5 * Math.PI) / 180)),
  accuracyM: 6,
  setBy: 'rosa',
  setAt: '2026-11-03T18:00:00Z',
}

afterEach(() => {
  cleanup()
  phone.asked = 0
  phone.why = null
  phone.fix = { lat: 29.5, lng: -98.3, accuracyM: 9 }
  opened.length = 0
})

describe('TaskPlaceLine', () => {
  it('wears the place\'s name, and the task\'s number once the list has a map over it', () => {
    const r = render(<TaskPlaceLine place={PLACE} />)
    expect(document.querySelector('[data-task-place-line]')?.textContent).toBe('Pump house')
    r.rerender(<TaskPlaceLine place={PLACE} number={2} />)
    expect(document.querySelector('[data-task-place-line]')?.textContent).toBe('2Pump house')
  })
})

describe('TaskPlaceBlock', () => {
  it('draws the spot, the way there and who placed it, and asks the phone nothing until a press', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName="Rosa" />)
    expect((await screen.findByTestId('still-map')).textContent).toContain('Pump house')
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'How far am I?' })).toBeTruthy()
    expect(screen.getByText('Placed by Rosa on Nov 3. Your location stays on this phone.')).toBeTruthy()
    expect(phone.asked).toBe(0)
    expect(document.querySelector('[data-task-place-far]')).toBeNull()
  })

  it('Directions opens the phone\'s maps app at the point', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(opened).toEqual([`https://www.google.com/maps/dir/?api=1&destination=${PLACE.lat.toFixed(6)},${PLACE.lng.toFixed(6)}`])
    expect(phone.asked).toBe(0)
  })

  it('How far am I? asks once and answers with the distance, the way and how sure the phone is', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName="Rosa" />)
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-far]')?.textContent).toBe('250 ft north-east of you. Your phone is sure within 30 ft.'))
    expect(phone.asked).toBe(1)
    // The picture gains a dot for the person.
    expect(screen.getByTestId('still-map').textContent).toContain('Pump house | You')
  })

  it('a refusal costs the distance alone: the words say the map and Directions still work', async () => {
    phone.why = 'refused'
    render(<TaskPlaceBlock place={PLACE} placedByName="Rosa" />)
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-no-fix]')?.textContent).toBe('Location is off for this app. The map and Directions still work. To see how far you are, allow location in the phone’s settings.'))
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy()
    expect(await screen.findByTestId('still-map')).toBeTruthy()
  })

  it('with no signal the picture does not come, the block says so, and the distance still answers', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName="Rosa" />)
    fireEvent.click(await screen.findByRole('button', { name: 'lose the signal' }))
    expect(document.querySelector('[data-task-place-no-map]')?.textContent).toBe('The map did not load. There is no signal here.')
    expect(screen.queryByTestId('still-map')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    await waitFor(() => expect(document.querySelector('[data-task-place-far]')?.textContent).toContain('250 ft north-east of you.'))
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy()
  })

  it('a press on the picture opens the same map full size, and its backdrop closes it alone', async () => {
    const behind = vi.fn()
    render(
      <div onClick={behind}>
        <TaskPlaceBlock place={PLACE} placedByName="Rosa" />
      </div>,
    )
    await screen.findByTestId('still-map')
    fireEvent.click(screen.getByRole('button', { name: 'Open the map of Pump house' }))
    expect(screen.getByRole('dialog', { name: 'Pump house' })).toBeTruthy()
    expect((await screen.findByTestId('big-map')).textContent).toContain('Pump house')
    behind.mockClear()
    fireEvent.click(document.querySelector('[data-task-place-map-sheet]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(behind).not.toHaveBeenCalled()
  })

  it('a place with no setter and no day says only where the reading goes', () => {
    render(<TaskPlaceBlock place={{ ...PLACE, setBy: null, setAt: null }} placedByName={null} />)
    expect(screen.getByText('Your location stays on this phone.')).toBeTruthy()
  })
})

describe('the giver\'s photo of the spot (PR 6)', () => {
  it('sits beside the picture from above, and a press opens it full size and closes alone', async () => {
    const behind = vi.fn()
    render(
      <div onClick={behind}>
        <TaskPlaceBlock place={PLACE} placedByName="Rosa" photoUrl="signed:p1" />
      </div>,
    )
    expect(await screen.findByTestId('still-map')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open the photo of the spot' }))
    expect(screen.getByRole('dialog', { name: 'The photo of the spot' })).toBeTruthy()
    behind.mockClear()
    fireEvent.click(document.querySelector('[data-task-spot-photo-sheet]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(behind).not.toHaveBeenCalled()
  })

  it('with no photo the block is the block it was', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName="Rosa" />)
    await screen.findByTestId('still-map')
    expect(document.querySelector('[data-task-spot-photo]')).toBeNull()
  })

  it('a picture that will not load draws nothing in its place', () => {
    render(<TaskSpotPhotoView url="signed:gone" />)
    fireEvent.error(screen.getByAltText('The spot'))
    expect(document.querySelector('[data-task-spot-photo]')).toBeNull()
  })
})
