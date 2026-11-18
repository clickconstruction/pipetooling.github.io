import { describe, expect, it } from 'vitest'
import { DRIVE_TRASH_WORDS, isTrashAction, lienRowsUse, parseTrashAsk, trashNote } from '../../../supabase/functions/_shared/driveTrash'
import { driveFailureOf } from '../../../supabase/functions/_shared/driveFailure'
import { plainWordsFailures } from '../plainWords'

const JOB = '5b5ee5e4-3afa-4a3f-b2f9-185bb7808808'
const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'

describe('parseTrashAsk (v2.7699): the trash door takes a Pipeline job and one of its files', () => {
  it('reads a trash and an untrash', () => {
    expect(parseTrashAsk({ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: FILE })).toEqual({ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: FILE })
    expect(parseTrashAsk({ action: 'untrash', job: { jobs_ledger_id: JOB }, driveFileId: FILE })?.action).toBe('untrash')
  })

  it('serves no bid and no GC project, and no ask without a file', () => {
    expect(parseTrashAsk({ action: 'trash', job: { bid_id: JOB }, driveFileId: FILE })).toBeNull()
    expect(parseTrashAsk({ action: 'trash', job: { project_id: JOB }, driveFileId: FILE })).toBeNull()
    expect(parseTrashAsk({ action: 'trash', job: { jobs_ledger_id: 'not-a-job' }, driveFileId: FILE })).toBeNull()
    expect(parseTrashAsk({ action: 'trash', job: { jobs_ledger_id: JOB } })).toBeNull()
    expect(parseTrashAsk({ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: '../etc' })).toBeNull()
    expect(parseTrashAsk({ action: 'put', job: { jobs_ledger_id: JOB }, driveFileId: FILE })).toBeNull()
    expect(parseTrashAsk(null)).toBeNull()
  })

  it('knows its two actions apart from every other ask, so a bad trash is refused here and never read as another ask', () => {
    expect([isTrashAction({ action: 'trash' }), isTrashAction({ action: 'untrash' })]).toEqual([true, true])
    expect([isTrashAction({ action: 'put' }), isTrashAction({ action: 'delete' }), isTrashAction(null), isTrashAction('trash')]).toEqual([false, false, false, false])
  })
})

describe('lienRowsUse: a file a lien record still names is never trashed', () => {
  it('finds the file wherever a row keeps its link', () => {
    const url = `https://drive.google.com/file/d/${FILE}/view`
    expect(lienRowsUse([{ id: 'f1', document_url: url, sends: [] }], FILE)).toBe(true)
    expect(lienRowsUse([{ id: 'f1', document_url: null, sends: [{ recipient: 'owner', tracking: '9407', receipt_url: url }] }], FILE)).toBe(true)
    expect(lienRowsUse([{ id: 'i1', mailed_copies: [{ url, driveFileId: FILE, name: 'a.pdf' }] }], FILE)).toBe(true)
    expect(lienRowsUse([{ id: 'i1', fields: { paper: { saved: { link: url } } } }], FILE)).toBe(true)
  })

  it('answers no for rows that name other files, for no rows, and for no id', () => {
    expect(lienRowsUse([{ id: 'f1', document_url: 'https://drive.google.com/file/d/1ZZZZZZZZZZZZZZZZZZZZZZZZ/view', sends: [] }, null], FILE)).toBe(false)
    expect(lienRowsUse([], FILE)).toBe(false)
    expect(lienRowsUse([{ anything: FILE }], '')).toBe(false)
  })
})

describe('the door’s words', () => {
  it('leaves a note on the trashed file with who took it off and the day', () => {
    expect(trashNote('Pat Marlow', '2026-11-17')).toBe('Taken off in the app by Pat Marlow on 2026-11-17.')
    expect(trashNote(null, '2026-11-17')).toBe('Taken off in the app on 2026-11-17.')
    expect(trashNote('  ', '2026-11-17')).toBe('Taken off in the app on 2026-11-17.')
  })

  it('keeps every sentence to plain words', () => {
    for (const s of Object.values(DRIVE_TRASH_WORDS)) expect([s, plainWordsFailures(s)]).toEqual([s, []])
  })

  it('names Drive’s refusal of a trash and of a put-back, with the second try by status', () => {
    const refused = driveFailureOf(new Error('Trash failed (403): The user does not have sufficient permissions for this file.'))
    expect(refused.error).toBe('Drive did not move the file to its trash. Drive said: The user does not have sufficient permissions for this file.')
    expect(refused.retry).toBe(false)
    const busy = driveFailureOf(new Error('Trash failed (503): Error 503 (Service Unavailable)'))
    expect(busy.error).toBe('Drive did not move the file to its trash. Drive said: Error 503 (Service Unavailable)')
    expect(busy.retry).toBe(true)
    expect(driveFailureOf(new Error('Untrash failed (404): File not found: x.')).error).toBe('Drive did not put the file back. Drive said: File not found: x.')
  })
})
