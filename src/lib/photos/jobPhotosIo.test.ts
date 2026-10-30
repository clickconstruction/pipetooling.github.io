import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ jwt: 'jwt-1' as string | null }))

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: auth.jwt ? { access_token: auth.jwt } : null } }) },
    functions: { invoke: async () => ({ data: null, error: { message: 'invoke is not the door for bytes' } }) },
  },
}))

const calls: Array<{ url: string; init: RequestInit }> = []

/** What the function answers: Drive's thumbnail or picture as image/jpeg, or a refusal. */
function answer(status: number, bytes: string, type = 'image/jpeg') {
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return { ok: status < 400, status, blob: async () => new Blob(bytes ? [bytes] : [], { type }) }
  })
}

const urlApi = URL as unknown as { createObjectURL?: unknown }
const before = urlApi.createObjectURL

beforeEach(() => {
  auth.jwt = 'jwt-1'
  calls.length = 0
  urlApi.createObjectURL = () => 'blob:photo'
})

afterEach(() => {
  urlApi.createObjectURL = before
  vi.unstubAllGlobals()
})

describe('job photo bytes (v2.6128)', () => {
  it('an image/jpeg thumbnail becomes an object URL, fetched under the caller’s sign-in', async () => {
    answer(200, 'jpeg-bytes')
    const { jobPhotoThumb } = await import('./jobPhotosIo')
    expect(await jobPhotoThumb('job-1', 'file-1')).toBe('blob:photo')
    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]!
    expect(url.endsWith('/functions/v1/job-photos')).toBe(true)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1')
    expect(JSON.parse(String(init.body))).toEqual({ action: 'thumb', job_id: 'job-1', file_id: 'file-1' })
  })

  it('the full picture comes the same way', async () => {
    answer(200, 'jpeg-bytes')
    const { jobPhotoFull } = await import('./jobPhotosIo')
    expect(await jobPhotoFull('job-1', 'file-1')).toBe('blob:photo')
    expect(JSON.parse(String(calls[0]!.init.body)).action).toBe('full')
  })

  it('a refusal and an empty answer are null, so the tile keeps its grey square', async () => {
    const { jobPhotoThumb } = await import('./jobPhotosIo')
    answer(404, '{"error":"That photo is not in the job’s folder."}', 'application/json')
    expect(await jobPhotoThumb('job-1', 'file-1')).toBeNull()
    answer(200, '')
    expect(await jobPhotoThumb('job-1', 'file-1')).toBeNull()
  })

  it('no sign-in is null without a call', async () => {
    auth.jwt = null
    answer(200, 'jpeg-bytes')
    const { jobPhotoThumb } = await import('./jobPhotosIo')
    expect(await jobPhotoThumb('job-1', 'file-1')).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
