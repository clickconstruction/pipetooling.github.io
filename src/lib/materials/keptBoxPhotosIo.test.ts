import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('./onSiteStore', () => ({ refreshJob: vi.fn() }))
vi.mock('./photoBlobs', () => ({ getPhotoBlob: vi.fn() }))
vi.mock('./photoUpload', () => ({ sendBoxPhoto: vi.fn() }))

import { sendKeptBoxPhotos, type KeptBoxPhotoRow, type KeptBoxPhotosIo } from './keptBoxPhotosIo'

const row = (id: string, job = 'j1'): KeptBoxPhotoRow => ({ id, job_id: job, container_id: 'a1', file_name: `${id}.jpg` })
const bytes = new Blob(['x'], { type: 'image/jpeg' })

function io(over: Partial<KeptBoxPhotosIo> = {}): KeptBoxPhotosIo & { marked: string[]; refreshed: string[] } {
  const marked: string[] = []
  const refreshed: string[] = []
  return {
    online: () => true,
    waiting: async () => [row('p1'), row('p2'), row('p3', 'j2')],
    blob: async () => bytes,
    send: async (r) => ({ storagePath: `${r.job_id}/${r.id}.jpg` }),
    mark: async (id, path) => void marked.push(`${id}:${path}`),
    sent: (jobId) => void refreshed.push(jobId),
    ...over,
    marked,
    refreshed,
  }
}

describe('kept box photos send by themselves', () => {
  it('sends each shot this phone holds, marks its row and reads each job again once', async () => {
    const i = io()
    expect(await sendKeptBoxPhotos('u1', i)).toEqual({ sent: 3, left: 0 })
    expect(i.marked).toEqual(['p1:j1/p1.jpg', 'p2:j1/p2.jpg', 'p3:j2/p3.jpg'])
    expect(i.refreshed).toEqual(['j1', 'j2'])
  })

  it('leaves a row whose bytes are on another phone', async () => {
    const i = io({ blob: async (id) => (id === 'p2' ? null : bytes) })
    expect(await sendKeptBoxPhotos('u1', i)).toEqual({ sent: 2, left: 0 })
    expect(i.marked.map((m) => m.split(':')[0])).toEqual(['p1', 'p3'])
  })

  it('asks nothing with no signal', async () => {
    const waiting = vi.fn()
    expect(await sendKeptBoxPhotos('u1', io({ online: () => false, waiting }))).toEqual({ sent: 0, left: 0 })
    expect(waiting).not.toHaveBeenCalled()
  })

  it('keeps a shot whose send failed for the next pass, and goes on to the rest', async () => {
    const i = io({ send: async (r) => { if (r.id === 'p1') throw new Error('The photo did not send.'); return { storagePath: `${r.job_id}/${r.id}.jpg` } } })
    expect(await sendKeptBoxPhotos('u1', i)).toEqual({ sent: 2, left: 1 })
    expect(i.marked.map((m) => m.split(':')[0])).toEqual(['p2', 'p3'])
  })

  it('never throws when the rows do not read', async () => {
    expect(await sendKeptBoxPhotos('u1', io({ waiting: async () => { throw new Error('no') } }))).toEqual({ sent: 0, left: 0 })
  })
})
