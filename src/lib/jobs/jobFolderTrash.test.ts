import { describe, expect, it, vi } from 'vitest'
import { TAKE_OFF_FILE_WORDS, driveFileIdOfUrl, fileTakenOffWords } from './jobFolderTrash'
import { AddFileFailure, ADD_FILE_FAILURE_WORDS } from './addFileFailure'
import { plainWordsFailures } from '../plainWords'

vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { takeFileToTrash, trashJobFolderFile, untrashJobFolderFile } from './jobFolderTrashIo'
import { supabase } from '../supabase'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>
const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'

describe('jobFolderTrash (v2.7699): the words and the id', () => {
  it('reads a Drive file’s id out of its link, and nothing out of any other link', () => {
    expect(driveFileIdOfUrl(`https://drive.google.com/file/d/${FILE}/view`)).toBe(FILE)
    expect(driveFileIdOfUrl(`https://drive.google.com/file/d/${FILE}`)).toBe(FILE)
    expect(driveFileIdOfUrl(`https://drive.google.com/open?id=${FILE}`)).toBe(FILE)
    expect(driveFileIdOfUrl(`https://docs.google.com/document/d/${FILE}/edit#heading`)).toBe(FILE)
    expect(driveFileIdOfUrl(`https://example.com/file/d/${FILE}/view`)).toBeNull()
    expect(driveFileIdOfUrl('https://drive.google.com/drive/folders')).toBeNull()
    expect([driveFileIdOfUrl(''), driveFileIdOfUrl(null), driveFileIdOfUrl(undefined)]).toEqual([null, null, null])
  })

  it('says where the file is after its link came off', () => {
    expect(fileTakenOffWords({ where: 'trash' })).toBe('Taken off. The file is in Drive’s trash.')
    expect(fileTakenOffWords({ where: 'drive', why: 'A lien record still uses it.', retry: false })).toBe('Taken off. The file stays in Drive. A lien record still uses it.')
    expect(fileTakenOffWords({ where: 'trash' }, 'replace')).toBe('The old one went to Drive’s trash.')
    expect(fileTakenOffWords({ where: 'drive', why: 'A lien record still uses it.', retry: false }, 'replace')).toBe('The old one stays in Drive. A lien record still uses it.')
  })

  it('keeps every sentence to plain words', () => {
    const said = [TAKE_OFF_FILE_WORDS.askTail, TAKE_OFF_FILE_WORDS.inTrash, TAKE_OFF_FILE_WORDS.staysLead, TAKE_OFF_FILE_WORDS.replaced, TAKE_OFF_FILE_WORDS.replacedStaysLead, TAKE_OFF_FILE_WORDS.putBackFailed, TAKE_OFF_FILE_WORDS.lost, TAKE_OFF_FILE_WORDS.noReason]
    for (const s of said) expect([s, plainWordsFailures(s)]).toEqual([s, []])
    expect([TAKE_OFF_FILE_WORDS.putBack, TAKE_OFF_FILE_WORDS.tryAgain]).toEqual(['Put it back', 'Try again'])
  })
})

describe('jobFolderTrashIo: the calls, and the file’s fate told without a throw', () => {
  it('asks the function for the job and the file, by action', async () => {
    invoke.mockResolvedValue({ data: { trashed: true, url: `https://drive.google.com/file/d/${FILE}/view` }, error: null })
    await trashJobFolderFile('job-1', FILE)
    expect(invoke).toHaveBeenLastCalledWith('drive-link', { body: { action: 'trash', job: { jobs_ledger_id: 'job-1' }, driveFileId: FILE } })
    expect(await untrashJobFolderFile('job-1', FILE)).toEqual({ url: `https://drive.google.com/file/d/${FILE}/view` })
    expect(invoke).toHaveBeenLastCalledWith('drive-link', { body: { action: 'untrash', job: { jobs_ledger_id: 'job-1' }, driveFileId: FILE } })
  })

  it('answers the trash, a refusal with its reason, and a busy Drive with the second try', async () => {
    expect(await takeFileToTrash('job-1', FILE, async () => {})).toEqual({ where: 'trash' })
    const used = async () => {
      throw new AddFileFailure('A lien record still uses it.', false)
    }
    expect(await takeFileToTrash('job-1', FILE, used)).toEqual({ where: 'drive', why: 'A lien record still uses it.', retry: false })
    const busy = async () => {
      throw new AddFileFailure('Drive did not move the file to its trash. Drive said: Error 503 (Service Unavailable)', true)
    }
    expect(await takeFileToTrash('job-1', FILE, busy)).toEqual({ where: 'drive', why: 'Drive did not move the file to its trash. Drive said: Error 503 (Service Unavailable)', retry: true })
  })

  it('says the app could not be reached, never that a file did not reach it', async () => {
    const lost = async () => {
      throw new AddFileFailure(ADD_FILE_FAILURE_WORDS.lost, true)
    }
    expect(await takeFileToTrash('job-1', FILE, lost)).toEqual({ where: 'drive', why: TAKE_OFF_FILE_WORDS.lost, retry: true })
  })

  it('asks nothing for a link that is not a Drive file’s', async () => {
    const trash = vi.fn(async () => {})
    expect(await takeFileToTrash('job-1', null, trash)).toBeNull()
    expect(trash).not.toHaveBeenCalled()
  })

  it('reads the function’s refusal off the call itself', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx', context: { status: 409, json: async () => ({ error: 'A lien record still uses it.', why: 'in_use', retry: false }) } } })
    expect(await takeFileToTrash('job-1', FILE)).toEqual({ where: 'drive', why: 'A lien record still uses it.', retry: false })
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx', context: { status: 500, json: async () => ({}) } } })
    expect(await takeFileToTrash('job-1', FILE)).toEqual({ where: 'drive', why: TAKE_OFF_FILE_WORDS.noReason, retry: true })
  })
})
