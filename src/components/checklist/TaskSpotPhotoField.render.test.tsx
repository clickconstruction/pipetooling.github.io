// @vitest-environment jsdom
/**
 * Photo of the spot, the giver's field (punch list #328, PR 6): an empty tile that says what it is
 * for, a pick handed up once it is shrunk, and the picture with its two presses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const shotHost = vi.hoisted(() => ({ shot: null as null | { id: string; blob: Blob; previewUrl: string }, shrinking: false, error: null as string | null, picked: [] as string[] }))
vi.mock('../../hooks/useTaskShot', () => ({
  useTaskShot: () => ({
    shot: shotHost.shot,
    shrinking: shotHost.shrinking,
    kept: false,
    error: shotHost.error,
    pick: (file: File) => {
      shotHost.picked.push(file.name)
      return Promise.resolve()
    },
    clear: () => {},
    markKept: () => {},
  }),
}))

import { TaskSpotPhotoField } from './TaskSpotPhotoField'

afterEach(() => {
  cleanup()
  shotHost.shot = null
  shotHost.shrinking = false
  shotHost.error = null
  shotHost.picked = []
})

describe('TaskSpotPhotoField', () => {
  it('empty, it is one tile that says what the photo is for and that it is optional', () => {
    render(<TaskSpotPhotoField value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '＋ Add a photo' })).toBeTruthy()
    expect(screen.getByText('What the spot looks like. Leave it out for a task that needs none.')).toBeTruthy()
  })

  it('a file picked goes to the shrink, and the shrunk picture is handed up once', async () => {
    const onChange = vi.fn()
    const r = render(<TaskSpotPhotoField value={null} onChange={onChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'spot.jpg', { type: 'image/jpeg' })] } })
    expect(shotHost.picked).toEqual(['spot.jpg'])
    const blob = new Blob(['y'])
    shotHost.shot = { id: 'p1', blob, previewUrl: 'blob:preview' }
    r.rerender(<TaskSpotPhotoField value={null} onChange={onChange} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: 'new', id: 'p1', blob, previewUrl: 'blob:preview' }))
    r.rerender(<TaskSpotPhotoField value={{ kind: 'new', id: 'p1', blob, previewUrl: 'blob:preview' }} onChange={onChange} />)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('with a picture it shows it, says the person will see it, and Remove the photo hands up none', () => {
    const onChange = vi.fn()
    render(<TaskSpotPhotoField value={{ kind: 'saved', path: 'item/x/p1.jpg', previewUrl: 'signed:p1' }} onChange={onChange} />)
    expect((screen.getByAltText('The photo of the spot') as HTMLImageElement).getAttribute('src')).toBe('signed:p1')
    expect(screen.getByText('The person sees this photo on the task, beside the place.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Take another' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove the photo' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('a saved picture that will not sign still reads as there', () => {
    render(<TaskSpotPhotoField value={{ kind: 'saved', path: 'item/x/p1.jpg', previewUrl: null }} onChange={() => {}} />)
    expect(screen.getByText('Photo saved')).toBeTruthy()
  })

  it('while the phone reads the pick the tile says so, and a pick that does not read says why', () => {
    shotHost.shrinking = true
    const r = render(<TaskSpotPhotoField value={null} onChange={() => {}} />)
    expect((screen.getByRole('button', { name: 'Reading the photo…' }) as HTMLButtonElement).disabled).toBe(true)
    shotHost.shrinking = false
    shotHost.error = 'The photo did not read.'
    r.rerender(<TaskSpotPhotoField value={null} onChange={() => {}} />)
    expect(screen.getByRole('alert').textContent).toBe('The photo did not read.')
  })
})
