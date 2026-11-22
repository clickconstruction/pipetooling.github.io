// @vitest-environment jsdom
/**
 * The shot-tile engine under both its hosts (punch list #244, the fold of v2.6453): the Job photos window's shots keep
 * the time the camera fired, as a report's have since v2.6375; a report form takes one shot a press under its own test
 * id; and a send lost to the signal keeps the shot on the phone only for the host's own error class.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SendShotInput, ShotIo } from '../lib/photos/jobPhotoNotesIo'
import type { KeptPhotosStore } from '../lib/offline/keptPhotos'
import type { ShotTileBase } from '../lib/photos/shotTiles'

vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
vi.mock('../lib/photos/shrink', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/photos/shrink')>()
  return {
    ...real,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})
const camera = vi.hoisted(() => ({ time: null as string | null }))
vi.mock('../lib/photos/photoTakenAt', () => ({
  readTakenAt: (_file: Blob, uploadedMs: number) => Promise.resolve(camera.time ?? new Date(uploadedMs).toISOString()),
}))

/** The phone, stood in for (punch list #413, step 3): each ask is counted, and a test sets what it answers. */
const phone = vi.hoisted(() => ({ reads: 0, answer: { ok: false, why: 'none' } as unknown }))
vi.mock('../lib/paintedMap/paintedSpotIo', () => ({
  readSpotNow: () => {
    phone.reads += 1
    return Promise.resolve(phone.answer)
  },
  readSpotSoon: (reading: Promise<unknown>) => reading,
}))

import { useShotTileEngine, useShotTiles } from './useShotTiles'

const sent: SendShotInput[] = []
let refuseWith: Error | null = null
const io: ShotIo = {
  send: (input) => {
    if (refuseWith) return Promise.reject(refuseWith)
    sent.push(input)
    return Promise.resolve({ storagePath: `${input.jobId}/${input.id}.jpg` })
  },
  discard: () => Promise.resolve(),
}
// A store that holds bytes, so a shot lost to the signal can be kept.
const held = new Map<string, Blob>()
const bytes: KeptPhotosStore = {
  keep: (id: string, blob: Blob) => {
    held.set(id, blob)
    return Promise.resolve(true)
  },
  read: (id: string) => Promise.resolve(held.get(id) ?? null),
  drop: (ids: ReadonlyArray<string>) => {
    for (const id of ids) held.delete(id)
    return Promise.resolve()
  },
  sweep: () => Promise.resolve(),
}

function photo(name: string, lastModified: number) {
  return new File([new Uint8Array(4_200_000)], name, { type: 'image/jpeg', lastModified })
}

function pick(testId: string, files: File[]) {
  fireEvent.change(screen.getByTestId(testId), { target: { files } })
}

function WindowHost() {
  const host = useShotTiles({ open: true, jobId: 'job-1', authUserId: 'user-1', byName: 'Carla Nguyen', cameraFirst: false, io, kept: bytes })
  return (
    <div>
      <input {...host.inputProps} />
      <ul>
        {host.tiles.map((t) => (
          <li key={t.id} data-testid={`tile-${t.status}`}>
            {t.takenAt}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReportModeHost({ sendErrorName = 'ReportPhotoSendError' }: { sendErrorName?: string }) {
  const host = useShotTileEngine<ShotTileBase & { questionId: string | null }>({
    open: true,
    jobId: 'job-1',
    authUserId: 'user-1',
    byName: 'Luis Ortega',
    cameraFirst: false,
    io,
    kept: bytes,
    tile: (base) => ({ ...base, questionId: null }),
    multiple: false,
    sendErrorName,
    noJobWords: 'Photos ride on a job’s report.',
    pickedAt: () => new Date().toISOString(),
    testId: 'report-camera-input',
  })
  return (
    <div>
      <input {...host.inputProps} />
      <output data-testid="multiple">{String(host.inputProps.multiple)}</output>
      <ul>
        {host.tiles.map((t) => (
          <li key={t.id} data-testid={`tile-${t.status}`}>
            {t.failWhy ?? ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

describe('useShotTileEngine', () => {
  beforeEach(() => {
    sent.length = 0
    held.clear()
    refuseWith = null
    camera.time = null
    phone.reads = 0
    phone.answer = { ok: false, why: 'none' }
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('a job photo keeps the time the camera fired, as a report’s does', async () => {
    camera.time = '2026-10-30T15:42:10.000Z'
    render(<WindowHost />)
    pick('shot-input', [photo('IMG_4471.jpg', Date.parse('2026-11-02T09:00:00.000Z'))])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]!.takenAt).toBe('2026-10-30T15:42:10.000Z')
    expect((await screen.findByTestId('tile-sent')).textContent).toBe('2026-10-30T15:42:10.000Z')
  })

  it('a job photo with no camera time keeps the file’s own, as before', async () => {
    render(<WindowHost />)
    pick('shot-input', [photo('IMG_4472.jpg', Date.parse('2026-11-02T09:00:00.000Z'))])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]!.takenAt).toBe('2026-11-02T09:00:00.000Z')
  })

  it('a report form takes one shot a press under its own test id', async () => {
    render(<ReportModeHost />)
    expect(screen.getByTestId('multiple').textContent).toBe('false')
    pick('report-camera-input', [photo('a.jpg', Date.now() - 1000), photo('b.jpg', Date.now() - 1000)])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(1)
  })

  it('keeps a shot on the phone when the host’s own send error says no signal', async () => {
    refuseWith = Object.assign(new Error('The phone has no signal.'), { name: 'ReportPhotoSendError', kind: 'network' })
    render(<ReportModeHost />)
    pick('report-camera-input', [photo('a.jpg', Date.now() - 1000)])
    expect(await screen.findByTestId('tile-kept')).toBeTruthy()
    expect(held.size).toBe(1)
  })

  it('fails the shot with Retry when the no-signal error is another io’s', async () => {
    refuseWith = Object.assign(new Error('The phone has no signal.'), { name: 'PhotoSendError', kind: 'network' })
    render(<ReportModeHost />)
    pick('report-camera-input', [photo('a.jpg', Date.now() - 1000)])
    expect((await screen.findByTestId('tile-failed')).textContent).toBe('The phone has no signal.')
    expect(held.size).toBe(0)
  })
})

/**
 * Where the phone was when a shot was taken (punch list #413, step 3). The Job photos window and a report read the
 * phone once on a pick, and a shot of this moment sends its row with that reading. A host that keeps no point asks
 * the phone nothing.
 */
describe('a shot keeps where the phone was', () => {
  beforeEach(() => {
    sent.length = 0
    held.clear()
    refuseWith = null
    camera.time = null
    phone.reads = 0
    phone.answer = { ok: true, fix: { lat: 29.5004, lng: -98.2004, accuracyM: 6.4 } }
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('reads the phone once for a pick of several, and each fresh shot sends that reading', async () => {
    render(<WindowHost />)
    pick('shot-input', [photo('a.jpg', Date.now()), photo('b.jpg', Date.now())])
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(phone.reads).toBe(1)
    expect(sent.map((s) => s.takenPoint)).toEqual([{ lat: 29.5004, lng: -98.2004, accuracyM: 6 }, { lat: 29.5004, lng: -98.2004, accuracyM: 6 }])
  })

  it('a shot the camera took hours ago keeps no point: it is not of where the phone is now', async () => {
    camera.time = new Date(Date.now() - 6 * 60 * 60_000).toISOString()
    render(<WindowHost />)
    pick('shot-input', [photo('old.jpg', Date.now())])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]!.takenPoint).toBeNull()
  })

  it('a rough reading, or none, is kept by nobody, and the shot still sends', async () => {
    phone.answer = { ok: true, fix: { lat: 31, lng: -99, accuracyM: 3200 } }
    render(<WindowHost />)
    pick('shot-input', [photo('a.jpg', Date.now())])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]!.takenPoint).toBeNull()
    phone.answer = { ok: false, why: 'refused' }
    pick('shot-input', [photo('b.jpg', Date.now())])
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]!.takenPoint).toBeNull()
  })

  it('a host that keeps no point asks the phone nothing', async () => {
    render(<ReportModeHost />)
    pick('report-camera-input', [photo('a.jpg', Date.now())])
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(phone.reads).toBe(0)
    expect(sent[0]!.takenPoint).toBeNull()
  })
})
