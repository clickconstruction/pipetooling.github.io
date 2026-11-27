/**
 * The ask for a deleted ZZ test job's Drive folder (punch list #443, row 18): what is sent to `job-drive-folders`,
 * how its answers and refusals are read, and that the step after a delete never throws. Made-up ids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fn = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; body: unknown }>,
  answer: { data: null as unknown, error: null as unknown },
}))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, opts: { body?: unknown } = {}) => {
        fn.calls.push({ name, body: opts.body })
        return fn.answer
      },
    },
  },
}))

import { afterDeleteJobFolder, trashDeletedJobFolder } from './jobDriveFoldersIo'
import { JOB_FOLDER_TRASH_NOT_KNOWN } from './deletedJobFolderOffer'

const JOB = '11111111-1111-4111-8111-111111111111'
const LINK = 'https://drive.google.com/drive/folders/job-folder-id'
const zz = { job_name: 'ZZ Test walk job', customer_name: 'Ridge Builders', google_drive_link: LINK }
const trashed = { success: true, act: 'trashed', words: 'Its Drive folder went to Drive’s trash. A manager of the Shared Drive can restore it for 30 days.' }
/** A refusal as supabase-js hands it over: no data, and the function's body behind the error's context. */
const refusal = (body: unknown) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => body } } })

beforeEach(() => {
  fn.calls = []
  fn.answer = { data: trashed, error: null }
})

describe('trashDeletedJobFolder', () => {
  it('sends the job’s id and nothing else', async () => {
    expect(await trashDeletedJobFolder(JOB)).toEqual({ act: 'trashed', words: trashed.words })
    expect(fn.calls).toEqual([{ name: 'job-drive-folders', body: { trash: { job_id: JOB } } }])
  })
  it('reads an answer that nothing was left to do as an answer, not a failure', async () => {
    fn.answer = { data: { success: true, act: 'already', words: 'Its Drive folder is already in Drive’s trash.' }, error: null }
    expect(await trashDeletedJobFolder(JOB)).toEqual({ act: 'already', words: 'Its Drive folder is already in Drive’s trash.' })
  })
  it('throws the function’s own words when it refuses', async () => {
    fn.answer = refusal({ error: '1 bid still keeps this folder. It stays.', why: 'in_use' })
    await expect(trashDeletedJobFolder(JOB)).rejects.toThrow('1 bid still keeps this folder. It stays.')
  })
  it('says the take-back is not known yet when the function deployed is the one from before it', async () => {
    fn.answer = refusal({ error: 'job_id is required' })
    await expect(trashDeletedJobFolder(JOB)).rejects.toThrow(JOB_FOLDER_TRASH_NOT_KNOWN)
  })
  it('throws when the answer is nothing it can read', async () => {
    fn.answer = { data: { success: true }, error: null }
    await expect(trashDeletedJobFolder(JOB)).rejects.toThrow('Its Drive folder was not moved to the trash.')
  })
})

describe('afterDeleteJobFolder', () => {
  it('asks for a dev on a ZZ job with a link, and hands back the toast', async () => {
    expect(await afterDeleteJobFolder(JOB, zz, 'dev')).toEqual({ words: `The job is deleted. ${trashed.words}`, tone: 'success' })
    expect(fn.calls).toHaveLength(1)
  })
  it('asks nothing and says nothing for anyone else, a real job, a job with no link or no job', async () => {
    expect(await afterDeleteJobFolder(JOB, zz, 'master_technician')).toBeNull()
    expect(await afterDeleteJobFolder(JOB, zz, 'assistant')).toBeNull()
    expect(await afterDeleteJobFolder(JOB, { ...zz, job_name: 'Cedar Bend' }, 'dev')).toBeNull()
    expect(await afterDeleteJobFolder(JOB, { ...zz, google_drive_link: null }, 'dev')).toBeNull()
    expect(await afterDeleteJobFolder(JOB, null, 'dev')).toBeNull()
    expect(fn.calls).toEqual([])
  })
  it('never throws: a refusal is said with its reason', async () => {
    fn.answer = refusal({ error: 'A person added or changed 2 files in this folder by hand. It stays. Move them out, or trash it in Drive.', why: 'holds_a_persons_files' })
    expect(await afterDeleteJobFolder(JOB, zz, 'dev')).toEqual({
      words: 'The job is deleted. A person added or changed 2 files in this folder by hand. It stays. Move them out, or trash it in Drive.',
      tone: 'warning',
    })
  })
  it('never throws: a call that never arrived is said too', async () => {
    fn.answer = { data: null, error: { message: 'Failed to send a request to the Edge Function' } }
    const said = await afterDeleteJobFolder(JOB, zz, 'dev')
    expect(said?.tone).toBe('warning')
    expect(said?.words.startsWith('The job is deleted. ')).toBe(true)
  })
})
