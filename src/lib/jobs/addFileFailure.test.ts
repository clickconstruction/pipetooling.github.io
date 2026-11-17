import { describe, expect, it } from 'vitest'
import { ADD_FILE_FAILURE_WORDS, AddFileFailure, addFileCanRetry, addFileFailureOf, addFileStatusRetries } from './addFileFailure'
import { ADD_FILE_WORDS } from './jobFolderAddFile'

describe('addFileFailureOf (v2.7635): a file that did not go up says why, and whether it can go again', () => {
  it('reads no answer at all as a file that never reached the app, with the second try', () => {
    const f = addFileFailureOf(null)
    expect(f).toBeInstanceOf(AddFileFailure)
    expect(f.message).toBe(ADD_FILE_FAILURE_WORDS.lost)
    expect(f.retry).toBe(true)
  })

  it('shows the function’s own sentence and takes its answer on the second try', () => {
    const refused = addFileFailureOf({ error: 'Drive did not take the file. Drive said: quota exceeded.', retry: false, status: 502 })
    expect(refused.message).toBe('Drive did not take the file. Drive said: quota exceeded.')
    expect(refused.retry).toBe(false)
    expect(addFileFailureOf({ error: 'The app could not reach Drive.', retry: true, status: 502 }).retry).toBe(true)
  })

  it('reads the status when the function gave no answer on the second try', () => {
    expect(addFileFailureOf({ error: 'That job has no Drive folder yet.', status: 409 }).retry).toBe(false)
    expect(addFileFailureOf({ error: 'Office only.', status: 403 }).retry).toBe(false)
    expect(addFileFailureOf({ error: 'The index did not answer.', status: 500 }).retry).toBe(true)
    expect(addFileFailureOf({ error: 'Slow down.', status: 429 }).retry).toBe(true)
    expect(addFileFailureOf({ error: 'Refused in the body of a 200.', status: null }).retry).toBe(false)
    expect(addFileStatusRetries(408)).toBe(true)
    expect(addFileStatusRetries(404)).toBe(false)
    expect(addFileStatusRetries(undefined)).toBe(false)
  })

  it('never shows the old catch-all’s bare word', () => {
    for (const bare of ['failed', '', undefined]) {
      const f = addFileFailureOf({ error: bare, status: 500 })
      expect(f.message).toBe(ADD_FILE_FAILURE_WORDS.failed)
      expect(f.retry).toBe(true)
    }
    expect(addFileFailureOf({ error: 'failed', status: 500 }, 'The photo was not saved.').message).toBe('The photo was not saved.')
  })

  it('offers the second try for its own retryable failure and for nothing else', () => {
    expect(addFileCanRetry(new AddFileFailure('x', true))).toBe(true)
    expect(addFileCanRetry(new AddFileFailure('x', false))).toBe(false)
    expect(addFileCanRetry(new Error('That file is over 10 MB.'))).toBe(false)
    expect(addFileCanRetry({ retry: true })).toBe(false)
  })

  it('says the same thing as the Documents tab when the function gives no reason', () => {
    expect(ADD_FILE_FAILURE_WORDS.failed).toBe(ADD_FILE_WORDS.failed)
  })
})
