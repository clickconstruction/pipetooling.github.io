// @vitest-environment jsdom
/**
 * Where a photo was taken (punch list #413, step 3): the press on an opened job photo or report
 * photo. It draws only for a photo whose row keeps a point, and opens the spot in the phone's maps.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

const io = vi.hoisted(() => ({ asked: [] as Array<[string, string]>, point: null as null | { lat: number; lng: number; accuracyM: number | null } }))
vi.mock('../../lib/photos/photoTakenPointIo', () => ({
  loadPhotoTakenPoint: async (source: string, id: string) => {
    io.asked.push([source, id])
    return io.point
  },
}))
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

import { PhotoTakenHere } from './PhotoTakenHere'

const press = () => document.querySelector('[data-photo-taken-here]') as HTMLButtonElement | null

afterEach(() => {
  cleanup()
  io.asked = []
  io.point = null
  opened.length = 0
})

describe('PhotoTakenHere', () => {
  it('says where a job photo was taken and how sure the phone was, on a press 44 px tall', async () => {
    io.point = { lat: 29.5, lng: -98.2, accuracyM: 6 }
    render(<PhotoTakenHere source="job" id="p1" />)
    await waitFor(() => expect(press()).not.toBeNull())
    expect(io.asked).toEqual([['job', 'p1']])
    expect(press()!.textContent).toBe('📍Taken here · the phone was sure within 20 ft')
    expect(press()!.style.minHeight).toBe('44px')
    fireEvent.click(press()!)
    expect(opened).toEqual(['https://www.google.com/maps/search/?api=1&query=29.500000,-98.200000'])
  })

  it('says it without a margin when the phone gave none', async () => {
    io.point = { lat: 29.5, lng: -98.2, accuracyM: null }
    render(<PhotoTakenHere source="report" id="r1" />)
    await waitFor(() => expect(press()).not.toBeNull())
    expect(press()!.textContent).toBe('📍Taken here')
  })

  it('draws nothing for a photo with no point', async () => {
    render(<PhotoTakenHere source="job" id="p1" />)
    await waitFor(() => expect(io.asked).toHaveLength(1))
    expect(press()).toBeNull()
  })

  it('asks nothing for a source whose rows keep no point', () => {
    io.point = { lat: 29.5, lng: -98.2, accuracyM: 6 }
    render(<PhotoTakenHere source="box" id="b1" />)
    render(<PhotoTakenHere source="message" id="m1" />)
    expect(io.asked).toEqual([])
    expect(press()).toBeNull()
  })

  it('reads again for the next photo, and shows nothing of the last one meanwhile', async () => {
    io.point = { lat: 29.5, lng: -98.2, accuracyM: 6 }
    const view = render(<PhotoTakenHere source="job" id="p1" />)
    await waitFor(() => expect(press()).not.toBeNull())
    io.point = null
    view.rerender(<PhotoTakenHere source="job" id="p2" />)
    expect(press()).toBeNull()
    await waitFor(() => expect(io.asked).toEqual([['job', 'p1'], ['job', 'p2']]))
    expect(press()).toBeNull()
  })
})
