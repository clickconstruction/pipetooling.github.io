// @vitest-environment jsdom
/**
 * Punch list #319 PR 6: what the customer sent, on the Job Mode card. A job with no look draws nothing; a job made
 * from a look draws its photos, its video in a player and the customer's words; a look with words and no file says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ThreadLook, ThreadLookFile } from '../../lib/firstLook/card'
import { fakeFirstLookThreadIo } from '../../test/fakeFirstLookIo'
import { JobFirstLookStrip } from './JobFirstLookStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const LOOK: ThreadLook = { id: 'L1', contact_id: 'dana', asked_by_name: 'Rosa', made_at: '2026-11-12T15:00:00.000Z', expires_at: '2026-11-19T15:00:00.000Z', opened_at: null, sent_at: '2026-11-12T15:30:00.000Z', looked_at: null, closed_at: null, place: 'Kitchen', words: 'It drips at night' }
const PHOTO: ThreadLookFile = { id: 'F1', look_id: 'L1', kind: 'photo', mime: 'image/jpeg', storage_path: 'L1/kept/F1.jpg', bytes: 1, seconds: null, finished_at: '2026-11-12T15:10:00.000Z' }
const VIDEO: ThreadLookFile = { id: 'F2', look_id: 'L1', kind: 'video', mime: 'video/mp4', storage_path: 'L1/kept/F2.mp4', bytes: 1, seconds: 12, finished_at: '2026-11-12T15:11:00.000Z' }

afterEach(cleanup)

describe('what the customer sent, on the Job Mode card (punch list #319 PR 6)', () => {
  it('a job with no look draws nothing', async () => {
    const io = fakeFirstLookThreadIo()
    const { container } = render(<JobFirstLookStrip jobId="job-1" io={io} />)
    await waitFor(() => expect(io.looksOfJob).toHaveBeenCalledWith('job-1'))
    expect(container.innerHTML).toBe('')
    expect(io.signLookFiles).not.toHaveBeenCalled()
  })

  it('draws the photos, the video and the customer’s words', async () => {
    const io = fakeFirstLookThreadIo({ looksOfJob: vi.fn(async () => ({ looks: [LOOK], files: [PHOTO, VIDEO] })) })
    render(<JobFirstLookStrip jobId="job-1" io={io} />)
    expect(await screen.findByText(/What the customer sent/)).toBeTruthy()
    expect(screen.getByText('First look, asked Nov 12 by Rosa')).toBeTruthy()
    expect((document.querySelector('[data-look-file="photo"] img') as HTMLImageElement).src).toBe('https://files.test/L1/kept/F1.jpg')
    expect((document.querySelector('[data-look-file="video"]') as HTMLVideoElement).src).toBe('https://files.test/L1/kept/F2.mp4')
    expect(screen.getByText('It drips at night')).toBeTruthy()
  })

  it('a look with words and no file says so', async () => {
    const io = fakeFirstLookThreadIo({ looksOfJob: vi.fn(async () => ({ looks: [LOOK], files: [] })) })
    render(<JobFirstLookStrip jobId="job-1" io={io} />)
    expect(await screen.findByText('They sent their words and no photo.')).toBeTruthy()
  })
})
