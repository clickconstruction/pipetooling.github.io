// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShotIo } from '../lib/photos/jobPhotoNotesIo'

vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
vi.mock('../lib/photos/shrink', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/photos/shrink')>()
  return {
    ...real,
    shrinkReportPhoto: (file: File) =>
      file.name === 'huge.jpg'
        ? Promise.resolve({ blob: new Blob([new Uint8Array(3_000_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file })
        : Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})

import { useShotTiles } from './useShotTiles'

let urls = 0
const sent: string[] = []
const discarded: string[] = []
let failNext = false

const io: ShotIo = {
  send: (input) => {
    if (failNext) {
      failNext = false
      return Promise.reject(new Error('The bucket refused it.'))
    }
    sent.push(input.id)
    return Promise.resolve({ storagePath: `${input.jobId}/${input.id}.jpg` })
  },
  discard: (photos) => {
    discarded.push(...photos.map((p) => p.id))
    return Promise.resolve()
  },
}

function Host({ open = true, jobId = 'job-1', cameraFirst = false }: { open?: boolean; jobId?: string | null; cameraFirst?: boolean }) {
  const host = useShotTiles({ open, jobId, authUserId: 'user-1', byName: 'Carla Nguyen', cameraFirst, io })
  return (
    <div>
      <input {...host.inputProps} />
      <button type="button" onClick={() => host.openCamera()}>
        Add a photo
      </button>
      <output data-testid="count">{host.tiles.length}</output>
      <output data-testid="ready">{host.ready.length}</output>
      <output data-testid="inflight">{String(host.inFlight)}</output>
      <output data-testid="multiple">{String(host.inputProps.multiple)}</output>
      <output data-testid="capture">{host.inputProps.capture ?? 'none'}</output>
      <output data-testid="line">{host.lastShrink ?? ''}</output>
      <ul>
        {host.tiles.map((t) => (
          <li key={t.id} data-testid={`tile-${t.status}`}>
            <span data-testid="words">{t.description}</span>
            <span data-testid="why">{t.failWhy ?? ''}</span>
            <button type="button" onClick={() => host.setDescription(t.id, `words for ${t.id.slice(0, 4)}`)}>
              type
            </button>
            <button type="button" onClick={() => host.useWordsForTheRest(t.id)}>
              rest
            </button>
            <button type="button" onClick={() => host.retry(t.id)}>
              Retry
            </button>
            <button type="button" onClick={() => host.remove(t.id)}>
              Remove
            </button>
            <button type="button" onClick={() => host.clear([t.id])}>
              clear
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => host.drop()}>
        drop
      </button>
    </div>
  )
}

function pick(files: File[]) {
  const input = screen.getByTestId('shot-input') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

describe('useShotTiles', () => {
  beforeEach(() => {
    urls = 0
    sent.length = 0
    discarded.length = 0
    failNext = false
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('two files at a desk become two tiles that shrink, send and read ready; the input takes several and no capture', async () => {
    render(<Host />)
    expect(screen.getByTestId('multiple').textContent).toBe('true')
    expect(screen.getByTestId('capture').textContent).toBe('none')
    pick([new File([new Uint8Array(4_200_000)], 'a.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(3_800_000)], 'b.jpg', { type: 'image/jpeg' })])
    expect(screen.getByTestId('count').textContent).toBe('2')
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('2'))
    expect(screen.getByTestId('inflight').textContent).toBe('false')
    expect(sent).toHaveLength(2)
    expect(screen.getByTestId('line').textContent).toContain('→')
  })

  it('on a phone the input carries capture and takes one shot a press', () => {
    render(<Host cameraFirst />)
    expect(screen.getByTestId('capture').textContent).toBe('environment')
    expect(screen.getByTestId('multiple').textContent).toBe('false')
  })

  it('a send that fails keeps the tile with its reason and Retry sends it again', async () => {
    failNext = true
    render(<Host />)
    pick([new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.getByTestId('tile-failed')).toBeTruthy())
    expect(screen.getByTestId('why').textContent).toBe('The bucket refused it.')
    fireEvent.click(screen.getByText('Retry'))
    await waitFor(() => expect(screen.getByTestId('tile-sent')).toBeTruthy())
    expect(sent).toHaveLength(1)
  })

  it('a shot over the cap after the shrink fails with the reason and is never sent', async () => {
    render(<Host />)
    pick([new File([new Uint8Array(100)], 'huge.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.getByTestId('tile-failed')).toBeTruthy())
    expect(screen.getByTestId('why').textContent).toContain('over 2 MB')
    expect(sent).toHaveLength(0)
  })

  it('the words: typed on one tile, Use these words for the rest fills the others with none', async () => {
    render(<Host />)
    pick([new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(100)], 'b.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('2'))
    fireEvent.click(screen.getAllByText('type')[0]!)
    const [first] = screen.getAllByTestId('words').map((e) => e.textContent)
    expect(first).toMatch(/^words for /)
    expect(screen.getAllByTestId('words')[1]!.textContent).toBe('')
    fireEvent.click(screen.getAllByText('rest')[0]!)
    expect(screen.getAllByTestId('words')[1]!.textContent).toBe(first)
  })

  it('Remove on a sent tile discards it; drop discards every sent tile; clear takes them off without discarding', async () => {
    render(<Host />)
    pick([new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(100)], 'b.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(100)], 'c.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('3'))
    fireEvent.click(screen.getAllByText('Remove')[0]!)
    expect(discarded).toHaveLength(1)
    expect(screen.getByTestId('count').textContent).toBe('2')
    fireEvent.click(screen.getAllByText('clear')[0]!)
    expect(discarded).toHaveLength(1)
    expect(screen.getByTestId('count').textContent).toBe('1')
    fireEvent.click(screen.getByText('drop'))
    expect(discarded).toHaveLength(2)
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('with no job the send fails in words and nothing goes to the bucket', async () => {
    render(<Host jobId={null} />)
    pick([new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.getByTestId('tile-failed')).toBeTruthy())
    expect(screen.getByTestId('why').textContent).toBe('A photo goes on a job.')
    expect(sent).toHaveLength(0)
  })
})
