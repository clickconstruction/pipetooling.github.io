/**
 * The reads after a whole-job move (v2.7305; v2.7329 the source's photo marks): both jobs read again by force, the
 * source's refile marks read again so its strip stops drawing the moved photos, and the target's photos asked to move
 * as a combine asks. A read that fails never throws.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ loaded: [] as string[], marks: [] as string[], after: [] as string[] }))
vi.mock('../supabase', () => ({ supabase: { rpc: async () => ({ data: null, error: null }) } }))
vi.mock('./onSiteStore', () => ({
  loadJob: async (id: string, opts: { force?: boolean; quiet?: boolean }) => { calls.loaded.push(`${id}${opts.force ? ' force' : ''}${opts.quiet ? ' quiet' : ''}`); if (id === 'fails') throw new Error('no signal') },
}))
vi.mock('./boxPhotoRefileIo', () => ({
  refreshRefileMarks: async (id: string) => { calls.marks.push(id); return [] },
  afterCombineBoxPhotos: async (id: string, role: string | null | undefined) => { calls.after.push(`${id} ${role}`); return 'Its 2 box photos are moving.' },
}))

import { afterOnSiteMove } from './onSiteMoveJobIo'

beforeEach(() => { calls.loaded.length = 0; calls.marks.length = 0; calls.after.length = 0 })

describe('afterOnSiteMove', () => {
  it('reads both jobs again, the source’s photo marks, and asks the target’s photos to move', async () => {
    const words = await afterOnSiteMove('from', 'to', 'assistant')
    expect(calls.loaded).toEqual(['from force quiet', 'to force quiet'])
    expect(calls.marks).toEqual(['from'])
    expect(calls.after).toEqual(['to assistant'])
    expect(words).toBe('Its 2 box photos are moving.')
  })
  it('never throws on a read that fails', async () => {
    await expect(afterOnSiteMove('fails', 'to', 'dev')).resolves.toBe('Its 2 box photos are moving.')
  })
})
