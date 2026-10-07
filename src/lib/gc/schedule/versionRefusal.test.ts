/**
 * The schedule's PR 5: a stale press's refusal, as PostgREST answers it, through the io's own
 * `checkSupabaseError` and back out as words and the changes since. So the first stale press on real
 * data is not the first time this path runs.
 */
import { describe, expect, it } from 'vitest'
import { checkSupabaseError, DatabaseError } from '../../../utils/errorHandling'
import { SCHEDULE_CHANGED, scheduleChangedRefusal } from './versionRefusal'

const ROBERT = '00000000-0000-0000-0000-0000000005d1'
const FIRST = 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Robert: The fixtures ship a week late.'
const SECOND = 'Plumbing · Rough-in now runs Tue Sep 15 to Fri Oct 2. Robert: The crew starts a day late.'

/** gc_schedule_bump's refusal as PostgREST sends it: a P0001, its message, and its DETAIL as `details`. */
function answer(details: string, code = 'P0001', message = SCHEDULE_CHANGED) {
  return { data: null, status: 400, error: { code, message, details, hint: null } }
}

/** What the io catches when it checks the answer. */
function thrown(result: ReturnType<typeof answer>): unknown {
  try {
    checkSupabaseError(result, 'save the move')
  } catch (e) {
    return e
  }
  throw new Error('checkSupabaseError let a refusal through')
}

describe('a stale press’s refusal, through checkSupabaseError', () => {
  it('reads back the words, the versions and every change since, oldest first', () => {
    const detail = {
      read: 1,
      version: 3,
      changes: [
        { version: 3, at: '2026-11-04T20:16:41.004+00:00', by: ROBERT, name: 'Robert Douglas', words: SECOND },
        { version: 2, at: '2026-11-04T20:14:03.512+00:00', by: ROBERT, name: 'Robert Douglas', words: FIRST },
      ],
    }
    const e = thrown(answer(JSON.stringify(detail)))
    expect(e).toBeInstanceOf(DatabaseError)
    expect((e as DatabaseError).code).toBe('P0001')
    expect((e as DatabaseError).serverMessage).toBe(SCHEDULE_CHANGED)
    expect(scheduleChangedRefusal(e)).toEqual({
      read: 1,
      version: 3,
      changes: [
        { version: 2, at: '2026-11-04T20:14:03.512+00:00', by: ROBERT, name: 'Robert Douglas', words: FIRST },
        { version: 3, at: '2026-11-04T20:16:41.004+00:00', by: ROBERT, name: 'Robert Douglas', words: SECOND },
      ],
    })
  })

  it('reads a first draft’s refusal, a name the reader may not see, and PostgREST’s own error object', () => {
    const detail = JSON.stringify({ read: null, version: 1, changes: [{ version: 1, at: '2026-11-02T14:00:00+00:00', by: ROBERT, name: null, words: 'Drew a first draft.' }] })
    const want = { read: null, version: 1, changes: [{ version: 1, at: '2026-11-02T14:00:00+00:00', by: ROBERT, name: null, words: 'Drew a first draft.' }] }
    expect(scheduleChangedRefusal(thrown(answer(detail)))).toEqual(want)
    expect(scheduleChangedRefusal(answer(detail).error)).toEqual(want)
  })

  it('keeps the changes it can read when one is not', () => {
    const detail = JSON.stringify({ read: 1, version: 3, changes: [{ version: 2, words: 'No moment.' }, { version: 3, at: '2026-11-04T20:16:41+00:00', by: null, name: null, words: SECOND }] })
    expect(scheduleChangedRefusal(thrown(answer(detail)))?.changes.map((c) => c.version)).toEqual([3])
    expect(scheduleChangedRefusal(thrown(answer('not JSON')))).toEqual({ read: null, version: null, changes: [] })
  })

  it('is null for every other refusal', () => {
    expect(scheduleChangedRefusal(thrown(answer('{}', 'P0001', 'Pick why it moved.')))).toBeNull()
    expect(scheduleChangedRefusal(thrown(answer('{}', '42501', 'new row violates row-level security policy')))).toBeNull()
    expect(scheduleChangedRefusal(thrown(answer('{}', 'P0001', 'Read-only (training) mode: changes are blocked.')))).toBeNull()
    expect(scheduleChangedRefusal(new Error(SCHEDULE_CHANGED))).toBeNull()
    expect(scheduleChangedRefusal(null)).toBeNull()
  })
})
