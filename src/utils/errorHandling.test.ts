import { beforeAll, describe, expect, it, vi } from 'vitest'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'
import {
  classifyResultError,
  DatabaseError,
  databaseErrorFromResult,
  describeClassifiedError,
  errorKindOf,
  executeDeleteChain,
  formatErrorMessage,
  formatPostgrestOrUnknownError,
  humanizeOperationName,
  isRetryableError,
  operationSubject,
  OperationTimeoutError,
  withRetry,
  withSupabaseRetry,
  type SupabaseClientResult,
} from './errorHandling'

const FAST = { initialDelay: 1, maxDelay: 2, logRetries: false }

// The [error-class] reporter writes to console.warn when an error is shown; keep the run quiet.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

/** What supabase-js returns when the browser's fetch itself rejects (no signal). */
const FETCH_LAYER_RESULT: SupabaseClientResult<never> = {
  data: null,
  error: {
    message: 'TypeError: Failed to fetch',
    details: 'TypeError: Failed to fetch\n    at PostgrestBuilder.then (…)',
    hint: '',
    code: '',
  },
  status: 0,
}

/** The J18-F1 specimen: `?jobId=bid:<uuid>` fed raw into a uuid `.eq()` filter. */
const BAD_UUID_RESULT: SupabaseClientResult<never> = {
  data: null,
  error: {
    message: 'invalid input syntax for type uuid: "bid:b3f790d9-0000-4000-8000-000000000000"',
    details: null,
    hint: null,
    code: '22P02',
  },
  status: 400,
}

const RLS_RESULT: SupabaseClientResult<never> = {
  data: null,
  error: {
    message: 'permission denied for table jobs_ledger',
    details: null,
    hint: null,
    code: '42501',
  },
  status: 403,
}

describe('classifyResultError', () => {
  it('a PostgREST code is proof the server answered, whatever the message says', () => {
    expect(classifyResultError({ message: 'TypeError: Failed to fetch', code: '22P02' })).toBe('server')
    expect(classifyResultError({ message: 'x', code: 'PGRST116', status: 406 })).toBe('server')
    expect(classifyResultError({ message: 'x', code: 23505 })).toBe('server')
  })
  it('status 0 / a fetch-layer TypeError message with no code is the network', () => {
    expect(classifyResultError({ message: 'TypeError: Failed to fetch', code: '', status: 0 })).toBe('network')
    expect(classifyResultError({ message: 'TypeError: Load failed', code: '' })).toBe('network')
    expect(classifyResultError({ message: 'FetchError: request to https://x failed', code: '' })).toBe('network')
  })
  it('an HTTP status without a body code is still a server answer', () => {
    expect(classifyResultError({ message: '<html>522</html>', status: 522 })).toBe('server')
  })
  it('no code, no status, no fetch signature is unknown — and an operation prefix is not a signature', () => {
    expect(classifyResultError({ message: 'boom' })).toBe('unknown')
    expect(classifyResultError({ message: 'Failed to fetchScheduleJobContext: invalid input syntax' })).toBe('unknown')
    expect(classifyResultError({ message: 'AbortError: The operation was aborted', code: '', status: 0 })).toBe('unknown')
  })
})

describe('a 22P02 from fetchScheduleJobContext (J18-N1 / F1)', () => {
  it('is a server error, is NOT offline, renders the broken-link sentence, and is NOT retried', async () => {
    const op = vi.fn(async () => BAD_UUID_RESULT)
    let caught: unknown
    try {
      await withSupabaseRetry(op, 'fetchScheduleJobContext', FAST)
    } catch (e) {
      caught = e
    }
    expect(op).toHaveBeenCalledTimes(1)
    expect(caught).toBeInstanceOf(DatabaseError)
    const err = caught as DatabaseError
    expect(err.kind).toBe('server')
    expect(err.code).toBe('22P02')
    expect(err.status).toBe(400)
    expect(err.operationName).toBe('fetchScheduleJobContext')
    // Developer-facing message keeps the raw operation name for the console…
    expect(err.message).toBe(`Failed to fetchScheduleJobContext: ${BAD_UUID_RESULT.error!.message}`)
    // …and the user never sees the offline copy for it.
    const shown = formatErrorMessage(err)
    expect(shown).toBe("This link points to something that doesn't exist any more.")
    expect(shown).not.toBe(OFFLINE_ERROR_MESSAGE)
    expect(isRetryableError(err)).toBe(false)
    expect(formatPostgrestOrUnknownError(err, 'fallback')).toBe(
      "This link points to something that doesn't exist any more.\nCode: 22P02",
    )
  })

  it('PGRST116 (.single() found no row) reads the same way', () => {
    const err = databaseErrorFromResult(
      { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: 'The result contains 0 rows' },
      'fetch bid for preview',
      406,
    )
    expect(formatErrorMessage(err)).toBe("This link points to something that doesn't exist any more.")
    expect(isRetryableError(err)).toBe(false)
  })
})

describe('a 42501 (RLS refusal)', () => {
  it('renders the access sentence for a read, naming the thing', async () => {
    const op = vi.fn(async () => RLS_RESULT)
    await expect(withSupabaseRetry(op, 'fetchScheduleJobContext', FAST)).rejects.toThrowError(DatabaseError)
    expect(op).toHaveBeenCalledTimes(1)
    const err = databaseErrorFromResult(RLS_RESULT.error!, 'fetchScheduleJobContext', 403)
    expect(formatErrorMessage(err)).toBe("You don't have access to this schedule job context.")
    expect(isRetryableError(err)).toBe(false)
  })
  it('renders the permission sentence for a write', () => {
    const err = databaseErrorFromResult(
      { message: 'new row violates row-level security policy for table "jobs_ledger_thread_notes"', code: '42501' },
      'insert jobs_ledger_thread_note modal',
      403,
    )
    expect(formatErrorMessage(err)).toBe("You don't have permission to insert jobs ledger thread note modal.")
  })
  it('falls back to a generic subject when the error has a code but no operation', () => {
    const err = new DatabaseError('permission denied for table people', '42501')
    expect(err.kind).toBe('server')
    expect(formatErrorMessage(err)).toBe("You don't have access to this record.")
  })
})

describe('the genuine offline path (J2-F3) keeps working', () => {
  it('a fetch-layer result (code "", status 0) is network-kind, IS retried, and renders the offline copy', async () => {
    const op = vi.fn(async () => FETCH_LAYER_RESULT)
    let caught: unknown
    try {
      await withSupabaseRetry(op, 'dispatch mode day blocks', { ...FAST, maxRetries: 2 })
    } catch (e) {
      caught = e
    }
    expect(op).toHaveBeenCalledTimes(3)
    const err = caught as DatabaseError
    expect(err.kind).toBe('network')
    expect(err.status).toBe(0)
    expect(isRetryableError(err)).toBe(true)
    expect(formatErrorMessage(err)).toBe(OFFLINE_ERROR_MESSAGE)
    expect(formatPostgrestOrUnknownError(err, 'fallback')).toBe(OFFLINE_ERROR_MESSAGE)
  })

  it('a fetch-layer result whose caller did not forward status still classifies as network', () => {
    const err = databaseErrorFromResult({ message: 'TypeError: Load failed', code: '' }, 'fetch common jobs')
    expect(err.kind).toBe('network')
    expect(formatErrorMessage(err)).toBe(OFFLINE_ERROR_MESSAGE)
  })

  it('a raw TypeError from the browser fetch IS offline and IS retried', async () => {
    const op = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(withRetry(op, { ...FAST, maxRetries: 2 })).rejects.toThrowError(TypeError)
    expect(op).toHaveBeenCalledTimes(3)
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryableError(new TypeError('Load failed'))).toBe(true)
    expect(formatErrorMessage(new TypeError('Failed to fetch'))).toBe(OFFLINE_ERROR_MESSAGE)
    expect(formatPostgrestOrUnknownError(new TypeError('Load failed'), 'fallback')).toBe(OFFLINE_ERROR_MESSAGE)
  })

  it('an app TypeError without a fetch signature is not offline', () => {
    expect(formatErrorMessage(new TypeError('x is not a function'))).toBe('x is not a function')
    expect(isRetryableError(new TypeError('x is not a function'))).toBe(false)
  })
})

describe('other server errors', () => {
  it('render "Couldn\'t load <subject>: <server message>" for reads and "Failed to <op>: …" for writes', () => {
    const read = databaseErrorFromResult(
      { message: 'column bids.foo does not exist', code: '42703' },
      'fetchBidPricingVersionRefs',
      400,
    )
    expect(formatErrorMessage(read)).toBe("Couldn't load bid pricing version refs: column bids.foo does not exist")
    expect(isRetryableError(read)).toBe(false)

    const write = databaseErrorFromResult(
      { message: 'duplicate key value violates unique constraint', code: '23505' },
      'insert schedule day email',
      409,
    )
    expect(formatErrorMessage(write)).toBe('Failed to insert schedule day email: duplicate key value violates unique constraint')
    expect(write.code).toBe('23505') // callers still branch on the code (ScheduleDayEmailModal)
    expect(isRetryableError(write)).toBe(false)
  })

  it('a message that merely contains "connection" or "network" is not retried once the server has answered', () => {
    const err = databaseErrorFromResult(
      { message: 'relation "network_connections" does not exist', code: '42P01' },
      'fetch network connections',
      404,
    )
    expect(isRetryableError(err)).toBe(false)
  })
})

describe('isRetryableError — transient vs permanent', () => {
  it('retries transient server codes and 5xx / 429 / 408 without a code', () => {
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: '40001' }, 'op', 500))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: '40P01' }, 'op', 500))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: '53300' }, 'op', 503))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: 'PGRST001' }, 'op', 503))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: '<html>522</html>' }, 'op', 522))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: 'Too Many Requests' }, 'op', 429))).toBe(true)
    expect(isRetryableError(databaseErrorFromResult({ message: 'Request Timeout' }, 'op', 408))).toBe(true)
  })
  it('never retries permanent answers: 22P02, 42501, PGRST116, 23xxx, other 4xx', () => {
    expect(isRetryableError(databaseErrorFromResult(BAD_UUID_RESULT.error!, 'fetch x', 400))).toBe(false)
    expect(isRetryableError(databaseErrorFromResult(RLS_RESULT.error!, 'fetch x', 403))).toBe(false)
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: 'PGRST116' }, 'fetch x', 406))).toBe(false)
    expect(isRetryableError(databaseErrorFromResult({ message: 'x', code: '23503' }, 'delete x', 409))).toBe(false)
    expect(isRetryableError(databaseErrorFromResult({ message: 'Not Found' }, 'fetch x', 404))).toBe(false)
  })
  it('keeps the statement-timeout rule: 57014 is not retried even though it is transient-looking', () => {
    expect(
      isRetryableError(
        databaseErrorFromResult({ message: 'canceling statement due to statement timeout', code: '57014' }, 'fetch x', 500),
      ),
    ).toBe(false)
    expect(isRetryableError(new Error('canceling statement due to statement timeout'))).toBe(false)
  })
  it('never retries aborts', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(isRetryableError(abort)).toBe(false)
    expect(isRetryableError({ name: 'AbortError', message: 'aborted' })).toBe(false)
  })
  it('a structured PostgrestError thrown as a plain object/Error is classified by code, not text', () => {
    const thrown = Object.assign(new Error('TypeError: Failed to fetch'), { code: '22P02', status: 400 })
    expect(isRetryableError(thrown)).toBe(false)
    expect(isRetryableError({ message: 'x', code: '', status: 0 })).toBe(true)
  })
  it('unstructured errors fall back to message tokens — without the bare "fetch" token', () => {
    expect(isRetryableError(new Error('Failed to fetch bid for preview: permission denied'))).toBe(false)
    expect(isRetryableError(new Error('Failed to fetchScheduleJobContext: invalid input syntax'))).toBe(false)
    expect(isRetryableError(new Error('too many connections'))).toBe(true)
    expect(isRetryableError(new Error('deadlock detected'))).toBe(true)
    expect(isRetryableError(new DatabaseError('Persist did not return an id for this segment.'))).toBe(false)
  })
})

describe('legacy / unstructured inputs degrade gracefully', () => {
  it('a bare string with the engine signature is offline; a string with the app prefix is shown as-is', () => {
    expect(formatErrorMessage('TypeError: Failed to fetch')).toBe(OFFLINE_ERROR_MESSAGE)
    expect(formatErrorMessage('Failed to insert jobs_ledger_thread_note modal: TypeError: Load failed')).toBe(
      OFFLINE_ERROR_MESSAGE,
    )
    const prefixed = 'Failed to fetchScheduleJobContext: invalid input syntax for type uuid: "bid:…"'
    expect(formatErrorMessage(prefixed)).toBe(prefixed)
    const spaced = 'Failed to fetch bid for preview: permission denied for table bids'
    expect(formatErrorMessage(spaced)).toBe(spaced)
    expect(formatPostgrestOrUnknownError(spaced, 'fallback')).toBe(spaced)
  })
  it('a DatabaseError built the old way (message only, no code) is never offline because of its prefix', () => {
    const legacy = new DatabaseError('Failed to fetchScheduleJobContext: invalid input syntax for type uuid')
    expect(legacy.kind).toBe('unknown')
    expect(formatErrorMessage(legacy)).toBe(legacy.message)
    expect(isRetryableError(legacy)).toBe(false)
    // …but one built from the raw engine message still is (salaryScheduleSync passes r.error.message straight in).
    const rawNetwork = new DatabaseError('TypeError: Failed to fetch')
    expect(rawNetwork.kind).toBe('network')
    expect(formatErrorMessage(rawNetwork)).toBe(OFFLINE_ERROR_MESSAGE)
  })
  it('a plain result-error object with a code is never offline in formatPostgrestOrUnknownError', () => {
    expect(
      formatPostgrestOrUnknownError(
        { message: 'permission denied for table bids', code: '42501', details: '', hint: 'check RLS' },
        'fallback',
      ),
    ).toBe("You don't have access to this record.\nCode: 42501\nHint: check RLS")
    expect(formatPostgrestOrUnknownError({ message: 'TypeError: Failed to fetch', code: '', status: 0 }, 'fallback')).toBe(
      OFFLINE_ERROR_MESSAGE,
    )
  })
  it('keeps the fallback for nothing at all', () => {
    expect(formatErrorMessage(undefined, 'Nothing')).toBe('Nothing')
    expect(formatPostgrestOrUnknownError(null, 'Nothing')).toBe('Nothing')
    expect(formatErrorMessage(new Error(''), 'Nothing')).toBe('')
  })
})

describe('executeDeleteChain', () => {
  it('keeps the step-numbered message and carries the class', async () => {
    let caught: unknown
    try {
      await executeDeleteChain([
        { operation: async () => ({ error: null }), description: 'delete child items' },
        { operation: async () => ({ error: { message: 'permission denied', code: '42501' }, status: 403 }), description: 'delete parent' },
      ])
    } catch (e) {
      caught = e
    }
    const err = caught as DatabaseError
    expect(err).toBeInstanceOf(DatabaseError)
    expect(err.message).toBe('Failed to delete parent (step 2/2): permission denied')
    expect(err.kind).toBe('server')
    expect(formatErrorMessage(err)).toBe("You don't have permission to delete parent.")
  })
})

describe('operation-name humanizing', () => {
  it('splits camelCase and underscores', () => {
    expect(humanizeOperationName('fetchScheduleJobContext')).toBe('fetch schedule job context')
    expect(humanizeOperationName('fetch clock_sessions for projects job schedule')).toBe(
      'fetch clock sessions for projects job schedule',
    )
  })
  it('strips the verb for the subject and never returns empty', () => {
    expect(operationSubject('fetch bid for preview')).toBe('bid for preview')
    expect(operationSubject('fetchScheduleJobContext')).toBe('schedule job context')
    expect(operationSubject('fetch')).toBe('record')
  })
  it('describeClassifiedError is pure and total', () => {
    expect(describeClassifiedError({ kind: 'network', rawMessage: 'x' })).toBe(OFFLINE_ERROR_MESSAGE)
    expect(describeClassifiedError({ kind: 'unknown', rawMessage: 'x' })).toBe('x')
    expect(describeClassifiedError({ kind: 'server', code: '42P01', rawMessage: 'raw' })).toBe('raw')
  })
})

describe('errorKindOf (class of any thrown value — feeds the offline Retry panel)', () => {
  it('reads a DatabaseError\'s kind', () => {
    expect(errorKindOf(databaseErrorFromResult({ message: 'x', code: '22P02' }, 'fetch thing', 400))).toBe('server')
    expect(errorKindOf(databaseErrorFromResult({ message: 'TypeError: Failed to fetch', code: '' }, 'clock in', 0))).toBe(
      'network',
    )
  })

  it('a fetch-layer TypeError is network; an app TypeError is unknown', () => {
    expect(errorKindOf(new TypeError('Failed to fetch'))).toBe('network')
    expect(errorKindOf(new TypeError('Load failed'))).toBe('network')
    expect(errorKindOf(new TypeError('x is not a function'))).toBe('unknown')
  })

  it('a structured PostgrestError object is decided by code / status, never message', () => {
    expect(errorKindOf({ message: 'Failed to fetch', code: '42501', details: '', hint: '' })).toBe('server')
    expect(errorKindOf({ message: 'boom', status: 522 })).toBe('server')
    expect(errorKindOf({ message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' })).toBe('network')
  })

  it('a timeout is unknown (the write may still land), as are null and plain strings without a signature', () => {
    expect(errorKindOf(new OperationTimeoutError('Clock in', 15000))).toBe('unknown')
    expect(errorKindOf(null)).toBe('unknown')
    expect(errorKindOf('boom')).toBe('unknown')
    expect(errorKindOf('TypeError: Failed to fetch')).toBe('network')
  })
})
