// @vitest-environment jsdom
/**
 * The Job photos window (punch list #244, PR 3): the empty state names the press; the grid draws the rows with their
 * words, the chips with counts, the search and its empty state; two chosen files become tiles with their boxes, the
 * press counts them and writes the words; a read that fails offers Retry; a tile opens the viewer with the words as its
 * title and Edit the words for the office.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ role: 'assistant', profileName: 'Carla Nguyen' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../hooks/useJobLineProgress', () => ({
  useJobLineProgress: () => ({
    lines: [
      { fixtureId: 'f1', name: 'Rough In', drawPaid: false },
      { fixtureId: 'f2', name: 'Top Out', drawPaid: false },
    ],
  }),
}))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
const pressed: unknown[] = []
vi.mock('../../lib/offline/pressThroughOutbox', () => ({
  pressThroughOutbox: (args: unknown) => {
    pressed.push(args)
    return Promise.resolve({ kind: 'queued', press: { id: 'p1' } })
  },
}))
vi.mock('../../lib/photos/shrink', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/photos/shrink')>()
  return {
    ...real,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})

import { JobPhotosWindow, type JobPhotosWindowIo } from './JobPhotosWindow'

let noSignal = false

const job = { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge Townhomes Phase 2', job_address: '2208 Live Oak Dr', google_drive_link: 'https://drive.google.com/drive/folders/1JobFolderIdAbCdEfGhIj', job_pictures_link: null }

const base: UploadedPhotoRow = {
  source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
  caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'someone-else', by_name: 'Carla Nguyen', direction: null, channel: null,
  taken_at: new Date().toISOString(), bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: new Date().toISOString(), fail_why: null, status: null,
  job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge Townhomes Phase 2', customer_name: 'Ridgeway Builders', bid_number: null,
}
const report: UploadedPhotoRow = { ...base, source: 'report', id: 'r1', caption: 'Rough In', by_name: 'Mateo Ruiz', taken_at: '2026-10-29T20:15:00.000Z', drive_file_id: 'd-2', report_id: 'rep-1' }

function makeIo(over: Partial<JobPhotosWindowIo> & { rowsAnswer?: UploadedPhotoRow[] | Error } = {}): JobPhotosWindowIo & { added: unknown[]; sent: string[]; edited: unknown[]; threads: string[] } {
  const added: unknown[] = []
  const sent: string[] = []
  const edited: unknown[] = []
  const threads: string[] = []
  let answer = over.rowsAnswer ?? []
  const io: JobPhotosWindowIo & { added: unknown[]; sent: string[]; edited: unknown[]; threads: string[] } = {
    added,
    sent,
    edited,
    threads,
    rows: () => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)),
    drive: {
      list: () => Promise.resolve({ folder: { kind: 'pictures' as const, url: 'https://drive.google.com/drive/folders/1Pics' }, photos: [{ id: 'd-9', name: 'IMG_4471.jpg', mime: 'image/jpeg', bytes: 2_000_000, modified: '2026-11-01T13:48:00.000Z', from: 'pictures' as const }], capped: false, waiting: 0 }),
      thumb: () => Promise.resolve(null),
      full: () => Promise.resolve(null),
    } as unknown as JobPhotosWindowIo['drive'],
    photos: { list: () => Promise.resolve({ rows: [], more: false }), waiting: () => Promise.resolve(0), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) },
    shots: {
      send: (input) => {
        if (noSignal) return Promise.reject(Object.assign(new Error('The phone has no signal.'), { name: 'PhotoSendError', kind: 'network' }))
        sent.push(input.id)
        return Promise.resolve({ storagePath: `job-1/${input.id}.jpg` })
      },
      discard: () => Promise.resolve(),
    },
    add: (writes) => {
      added.push(...writes)
      answer = [...(Array.isArray(answer) ? answer : []), ...writes.map((w, i) => ({ ...base, id: w.id, caption: w.description || w.stageName || 'Job photo', stage_name: w.stageName ?? '', drive_file_id: null, storage_path: `job-1/${w.id}.jpg`, taken_at: new Date(Date.now() + i).toISOString() }))]
      return Promise.resolve({ added: writes.length, failed: [], failedIds: [] })
    },
    editWords: (id, input) => {
      edited.push({ id, ...input })
      return Promise.resolve()
    },
    links: () => Promise.resolve({ google_drive_link: job.google_drive_link, job_pictures_link: null }),
    thread: (_jobId, _by, body) => {
      threads.push(body)
      return Promise.resolve(true)
    },
    ...over,
  }
  return io
}

function pick(files: File[]) {
  fireEvent.change(screen.getByTestId('shot-input'), { target: { files } })
}

describe('JobPhotosWindow', () => {
  beforeEach(() => {
    noSignal = false
    pressed.length = 0
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('a job with no photo names the press, and the folder note when there is no folder', async () => {
    const io = makeIo({ drive: { list: () => Promise.resolve({ folder: { kind: 'none', url: null }, photos: [], capped: false, waiting: 0 }), thumb: () => Promise.resolve(null), full: () => Promise.resolve(null) } as unknown as JobPhotosWindowIo['drive'] })
    renderWithProviders(<JobPhotosWindow job={{ ...job, google_drive_link: null }} onClose={() => {}} io={io} />)
    expect(await screen.findByText('No photos on this job yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy()
    expect(screen.getByText(/This job has no Drive folder yet/)).toBeTruthy()
    expect(screen.queryByLabelText('Find a photo on this job')).toBeNull()
  })

  it('the grid draws the rows with their words, the hand-added file, the chips with counts, and the search with its empty state', async () => {
    const io = makeIo({ rowsAnswer: [base, report] })
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={io} />)
    expect(await screen.findByText('Cracked flange under the second lav')).toBeTruthy()
    expect(screen.getByText('IMG_4471.jpg')).toBeTruthy()
    expect(screen.getByText(/Mateo Ruiz · Report/)).toBeTruthy()
    const chips = screen.getByRole('group', { name: 'Which photos' })
    expect(within(chips).getByText('All · 3')).toBeTruthy()
    expect(within(chips).getByText('Reports · 1')).toBeTruthy()
    expect(within(chips).getByText('Job photos · 2')).toBeTruthy()
    expect(screen.getByText(/3 photos · In Drive: Customer Pictures · 1 was put in the folder by hand/)).toBeTruthy()
    expect(screen.getByText('Open the folder ↗')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Find a photo on this job'), { target: { value: 'flange gasket' } })
    expect(await screen.findByText('No photos on this job match ‘flange gasket’.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(await screen.findByText('IMG_4471.jpg')).toBeTruthy()
    fireEvent.click(within(chips).getByText('Reports · 1'))
    expect(screen.queryByText('IMG_4471.jpg')).toBeNull()
    expect(screen.getByText('Rough In')).toBeTruthy()
  })

  it('two chosen files become tiles with their boxes; the press counts them, writes the words and the stage, and the tiles land in the grid', async () => {
    const io = makeIo()
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={io} />)
    await screen.findByRole('button', { name: 'Add a photo' })
    pick([new File([new Uint8Array(4_200_000)], 'a.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(3_800_000)], 'b.jpg', { type: 'image/jpeg' })])
    expect(await screen.findByText(/2 new photos · shrunk to 1600 px/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Add 2 photos to the job')).toBeTruthy())
    const boxes = document.querySelectorAll<HTMLTextAreaElement>('textarea[data-shot-words]')
    expect(boxes).toHaveLength(2)
    fireEvent.change(boxes[0]!, { target: { value: 'Meter location, behind the east fence gate' } })
    fireEvent.click(screen.getByText('Use these words for the rest'))
    expect(boxes[1]!.value).toBe('Meter location, behind the east fence gate')
    fireEvent.click(screen.getAllByRole('button', { name: 'Rough In' })[0]!)
    fireEvent.click(screen.getByText('Add 2 photos to the job'))
    await waitFor(() => expect(io.added).toHaveLength(2))
    expect(io.added[0]).toMatchObject({ description: 'Meter location, behind the east fence gate', fixtureId: 'f1', stageName: 'Rough In', caption: 'Meter location, behind the east fence gate' })
    expect(io.added[1]).toMatchObject({ description: 'Meter location, behind the east fence gate', fixtureId: null })
    expect(await screen.findByText('2 photos added to the job')).toBeTruthy()
    await waitFor(() => expect(io.threads).toEqual(['Added 2 photos: Meter location, behind the east fence gate; Meter location, behind the east fence gate']))
    await waitFor(() => expect(document.querySelectorAll('[data-job-photo-tile]')).toHaveLength(3))
    expect(document.querySelectorAll('textarea[data-shot-words]')).toHaveLength(0)
  })

  it('a read that fails says why and Retry reads again', async () => {
    const io = makeIo({ rowsAnswer: new TypeError('Failed to fetch') })
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={io} />)
    expect(await screen.findByText(/did not read|Failed to fetch|signal|connection/i)).toBeTruthy()
    io.rows = () => Promise.resolve([base])
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByText('Cracked flange under the second lav')).toBeTruthy()
  })

  it('a tile opens the viewer with the words as its title, and the office may edit the words', async () => {
    const io = makeIo({ rowsAnswer: [base] })
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={io} />)
    await screen.findByText('Cracked flange under the second lav')
    await settle()
    fireEvent.click(document.querySelector('[data-job-photo-tile="n1"]')!)
    const dialogs = await screen.findAllByRole('dialog')
    const viewer = dialogs[dialogs.length - 1]!
    expect(within(viewer).getAllByText('Cracked flange under the second lav').length).toBeGreaterThan(0)
    fireEvent.click(within(viewer).getByRole('button', { name: 'Edit the words' }))
    const box = (await screen.findByTestId('edit-words-box', {}, { timeout: 2000 }).catch(() => null)) ?? (document.querySelector('textarea[data-edit-words]') as HTMLTextAreaElement)
    expect((box as HTMLTextAreaElement).value).toBe('Cracked flange under the second lav')
    fireEvent.change(box, { target: { value: 'Cracked flange, unit 204' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the words' }))
    await waitFor(() => expect(io.edited).toEqual([{ id: 'n1', description: 'Cracked flange, unit 204', stageName: 'Rough In' }]))
    expect(await screen.findByText('Cracked flange, unit 204')).toBeTruthy()
  })

  it('with no signal the shot is kept on the phone and the press goes through the outbox with its words (PR 5)', async () => {
    noSignal = true
    const io = makeIo()
    renderWithProviders(<JobPhotosWindow job={job} onClose={() => {}} io={io} />)
    await screen.findByRole('button', { name: 'Add a photo' })
    pick([new File([new Uint8Array(100)], 'a.jpg', { type: 'image/jpeg' })])
    expect(await screen.findByText('Kept on the phone. It goes when the signal is back.')).toBeTruthy()
    fireEvent.change(document.querySelector<HTMLTextAreaElement>('textarea[data-shot-words]')!, { target: { value: 'Meter location' } })
    const press = await screen.findByText('Add 1 photo to the job')
    fireEvent.click(press)
    expect(await screen.findByText('Kept on the phone. The photos go to the job when the signal is back.')).toBeTruthy()
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toMatchObject({ kind: 'job-photos', payload: { jobLedgerId: 'job-1', photos: [{ sent: false, description: 'Meter location', caption: 'Meter location' }] }, door: '/jobs?jobDetail=job-1' })
    expect(io.added).toHaveLength(0)
    expect(document.querySelectorAll('textarea[data-shot-words]')).toHaveLength(0)
  })
})
