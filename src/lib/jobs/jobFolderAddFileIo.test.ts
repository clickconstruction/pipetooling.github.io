import { describe, expect, it, vi } from 'vitest'
import { ADD_FILE_FAILURE_WORDS as ADD_FILE_WORDS } from './addFileFailure'

vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { addFileFailureFrom, putJobFolderFile } from './jobFolderAddFileIo'
import { supabase } from '../supabase'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>
const refusal = (status: number, body: unknown) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } } })

describe('addFileFailureFrom (v2.7635): what one invoke result says went wrong', () => {
  it('answers null when the call went through', async () => {
    expect(await addFileFailureFrom({ data: { driveFileId: 'f1', url: 'https://drive.google.com/file/d/f1/view' }, error: null })).toBeNull()
  })

  it('reads the function’s sentence and its answer on the second try off a refused call', async () => {
    const f = await addFileFailureFrom(refusal(502, { error: 'Drive did not take the file. Drive said: Backend Error', why: 'drive', retry: true }))
    expect(f?.message).toBe('Drive did not take the file. Drive said: Backend Error')
    expect(f?.retry).toBe(true)
    const no = await addFileFailureFrom(refusal(409, { error: 'That job has no Drive folder yet.' }))
    expect(no?.message).toBe('That job has no Drive folder yet.')
    expect(no?.retry).toBe(false)
  })

  it('replaces the old catch-all’s bare word and offers the second try', async () => {
    const f = await addFileFailureFrom(refusal(500, { error: 'failed' }))
    expect(f?.message).toBe(ADD_FILE_WORDS.failed)
    expect(f?.retry).toBe(true)
  })

  it('reads an error with no body as a call nothing answered', async () => {
    const f = await addFileFailureFrom({ data: null, error: { message: 'Failed to send a request to the Edge Function', context: {} } })
    expect(f?.message).toBe(ADD_FILE_WORDS.lost)
    expect(f?.retry).toBe(true)
  })

  it('reads a body that is not JSON as a failure with no reason, with the second try', async () => {
    const f = await addFileFailureFrom({ data: null, error: { message: 'x', context: { status: 502, json: async () => Promise.reject(new Error('not json')) } as never } })
    expect(f?.message).toBe(ADD_FILE_WORDS.failed)
    expect(f?.retry).toBe(true)
  })
})

describe('putJobFolderFile throws the failure it read', () => {
  it('throws the function’s sentence, marked for the second try', async () => {
    invoke.mockResolvedValueOnce(refusal(502, { error: 'The app could not reach Drive.', retry: true }))
    const file = new File([new Uint8Array([1, 2, 3])], 'receipt.jpg', { type: 'image/jpeg' })
    await expect(putJobFolderFile('job-1', 'sent', file)).rejects.toMatchObject({ name: 'AddFileFailure', message: 'The app could not reach Drive.', retry: true })
  })

  it('hands back the file’s id and link when it went up', async () => {
    invoke.mockResolvedValueOnce({ data: { driveFileId: 'f9', url: 'https://drive.google.com/file/d/f9/view' }, error: null })
    const file = new File([new Uint8Array([1])], 'receipt.jpg', { type: 'image/jpeg' })
    expect(await putJobFolderFile('job-1', 'sent', file)).toEqual({ driveFileId: 'f9', url: 'https://drive.google.com/file/d/f9/view' })
  })
})
