// @vitest-environment jsdom
/**
 * Punch list #319 PR 5: the look's photos on the office's estimate. An estimate with no look draws nothing; one
 * started from a look draws the photos, the video in a player, the customer's words and the Drive folder.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ThreadLook, ThreadLookFile } from '../../lib/firstLook/card'
import type { FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import { EstimateFirstLookStrip } from './EstimateFirstLookStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const LOOK: ThreadLook = { id: 'L1', contact_id: 'dana', asked_by_name: 'Rosa', made_at: '2026-11-12T15:00:00.000Z', expires_at: '2026-11-19T15:00:00.000Z', opened_at: null, sent_at: '2026-11-12T15:30:00.000Z', looked_at: null, closed_at: null, place: 'Kitchen', words: 'It drips at night', drive_folder_id: 'FOLDER' }
const PHOTO: ThreadLookFile = { id: 'F1', look_id: 'L1', kind: 'photo', mime: 'image/jpeg', storage_path: 'L1/kept/F1.jpg', bytes: 1, seconds: null, finished_at: '2026-11-12T15:10:00.000Z' }
const VIDEO: ThreadLookFile = { id: 'F2', look_id: 'L1', kind: 'video', mime: 'video/mp4', storage_path: 'L1/kept/F2.mp4', bytes: 1, seconds: 12, finished_at: '2026-11-12T15:11:00.000Z' }

const fakeIo = (over: Partial<FirstLookThreadIo> = {}): FirstLookThreadIo => ({
  looks: vi.fn(async () => ({ looks: [], files: [] })),
  lookById: vi.fn(async () => ({ look: LOOK, files: [PHOTO, VIDEO] })),
  lookOfEstimate: vi.fn(async () => 'L1'),
  signLookFiles: vi.fn(async (paths: readonly string[]) => Object.fromEntries(paths.map((p) => [p, `https://files.test/${p}`]))),
  signTexted: vi.fn(async () => ({})),
  mint: vi.fn(async () => ({ id: 'L9', link: 'x' })),
  stamp: vi.fn(async () => undefined),
  ...over,
})

afterEach(cleanup)

describe('the look’s photos on an estimate (punch list #319 PR 5)', () => {
  it('an estimate with no look draws nothing', async () => {
    const io = fakeIo({ lookOfEstimate: vi.fn(async () => null) })
    const { container } = render(<EstimateFirstLookStrip estimateId="est-1" io={io} />)
    await waitFor(() => expect(io.lookOfEstimate).toHaveBeenCalledWith('est-1'))
    expect(container.innerHTML).toBe('')
    expect(io.lookById).not.toHaveBeenCalled()
  })

  it('draws the photos, the video, their words and the Drive folder', async () => {
    render(<EstimateFirstLookStrip estimateId="est-1" io={fakeIo()} />)
    expect(await screen.findByText(/Photos the customer sent · First look, asked Nov 12 by rosa/i)).toBeTruthy()
    expect((document.querySelector('[data-look-file="photo"] img') as HTMLImageElement).src).toBe('https://files.test/L1/kept/F1.jpg')
    expect((document.querySelector('[data-look-file="video"]') as HTMLVideoElement).src).toBe('https://files.test/L1/kept/F2.mp4')
    expect(screen.getByText('It drips at night')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open in Drive' }).getAttribute('href')).toBe('https://drive.google.com/drive/folders/FOLDER')
  })

  it('a look that is gone draws nothing', async () => {
    const io = fakeIo({ lookById: vi.fn(async () => null) })
    const { container } = render(<EstimateFirstLookStrip estimateId="est-1" io={io} />)
    await waitFor(() => expect(io.lookById).toHaveBeenCalledWith('L1'))
    expect(container.innerHTML).toBe('')
  })
})
