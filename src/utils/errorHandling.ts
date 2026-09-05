/**
 * Error Handling and Retry Utilities
 *
 * Provides utilities for handling database operations with retries,
 * comprehensive error checking, and consistent error messages.
 *
 * Classification (v2.2836, J18-N1): every failure that passes through here is
 * sorted by CLASS, never by message text —
 *   - `network`: the fetch layer never reached the server (the browser's
 *     `TypeError: Failed to fetch` / `Load failed`, which supabase-js folds
 *     into a result error with `code: ''` and `status: 0`). Renders the
 *     offline copy; retried.
 *   - `server`: PostgREST / Postgres answered — a code (`22P02`, `42501`,
 *     `PGRST116`, `23505`, …) or an HTTP status. Renders a trade-language
 *     sentence by code family; retried only for transient codes / 5xx / 429.
 *   - `unknown`: no structure at all (a bare `new DatabaseError('…')`). Falls
 *     back to the old message tokens, minus the bare `fetch` token that used
 *     to make every `fetch…`-named operation look like an outage.
 * Before this, `Failed to fetchScheduleJobContext: invalid input syntax…`
 * contained the literal `failed to fetch`, so ~100 read operations told a
 * user with perfect wifi to check their signal and retried a permanent
 * failure four times.
 */

import {
  isFetchLayerTypeError,
  isNetworkFetchErrorMessage,
  OFFLINE_ERROR_MESSAGE,
} from '../lib/networkErrorMessage'
import { reportErrorClass } from '../lib/errorClassTelemetry'

export type DatabaseErrorKind = 'network' | 'server' | 'unknown'

/** Error half of an awaited Supabase result (`PostgrestError` is assignable). */
export type SupabaseResultError = {
  message: string
  code?: string | null
  details?: unknown
  hint?: string | null
}

export interface DatabaseErrorMeta {
  /** Explicit class; derived from `code` / `status` / the raw server message when omitted. */
  kind?: DatabaseErrorKind
  /** HTTP status of the PostgREST response (0 = fetch layer). */
  status?: number
  /** The `withSupabaseRetry` / `checkSupabaseError` operation name (`'fetch bid for preview'`). */
  operationName?: string
  /** The server's own message, before the `Failed to <operation>:` prefix was added. */
  serverMessage?: string
}

/**
 * Pure: the class of a Supabase result error. `code` wins — a PostgREST code
 * is proof the server answered, whatever the message says. A missing code
 * with `status: 0` (or a fetch-layer `TypeError:` message, when the caller
 * did not forward the status) is the network. Anything else is unknown.
 */
export function classifyResultError(e: {
  message?: string | null
  code?: string | null | number
  status?: number | null
}): DatabaseErrorKind {
  const code = e.code == null ? '' : String(e.code).trim()
  if (code) return 'server'
  if (typeof e.status === 'number' && e.status >= 400) return 'server'
  const msg = e.message ?? ''
  if (/^AbortError\b/.test(msg)) return 'unknown'
  if (e.status === 0) return 'network'
  if (/^(TypeError|FetchError|NetworkError)\b/.test(msg) || isNetworkFetchErrorMessage(msg)) return 'network'
  return 'unknown'
}

export class DatabaseError extends Error {
  readonly kind: DatabaseErrorKind
  readonly status?: number
  readonly operationName?: string
  readonly serverMessage?: string

  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
    meta: DatabaseErrorMeta = {},
  ) {
    super(message)
    this.name = 'DatabaseError'
    this.status = meta.status
    this.operationName = meta.operationName
    this.serverMessage = meta.serverMessage
    this.kind =
      meta.kind ?? classifyResultError({ message: meta.serverMessage ?? message, code, status: meta.status })
  }
}

/**
 * Builds the `DatabaseError` for a failed Supabase result: prefixed message
 * for logs (`Failed to <operation>: <server message>`), structured class,
 * code, status and operation name for rendering and retry decisions.
 */
export function databaseErrorFromResult(
  error: SupabaseResultError,
  operationName: string,
  status?: number,
  message: string = `Failed to ${operationName}: ${error.message}`,
): DatabaseError {
  return new DatabaseError(message, error.code ?? undefined, error.details, {
    kind: classifyResultError({ message: error.message, code: error.code, status }),
    status,
    operationName,
    serverMessage: error.message,
  })
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number
  /** Whether to log retry attempts (default: true) */
  logRetries?: boolean
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  logRetries: true,
}

/**
 * Postgres / PostgREST codes worth a second try: the server was busy or lost
 * its own connection, not wrong about the request. Statement timeouts
 * (`57014`) are deliberately absent — retrying repeats expensive work and
 * worsens the overload (pre-existing rule, kept).
 */
const TRANSIENT_SERVER_CODES: ReadonlySet<string> = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53000', // insufficient_resources
  '53100', // disk_full
  '53200', // out_of_memory
  '53300', // too_many_connections
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  'PGRST000', // could not connect to the database
  'PGRST001', // pool: connection timed out
  'PGRST002', // schema cache load failed
  'PGRST003', // request timed out acquiring a connection
])

function isTransientServerError(code: string | undefined, status: number | undefined): boolean {
  const c = (code ?? '').trim()
  if (c) return TRANSIENT_SERVER_CODES.has(c)
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500
  return false
}

/**
 * Message-token fallback for errors with no structure (a bare `Error`, a
 * `DatabaseError` built without a code). The bare `fetch` token is gone: an
 * operation named `fetch…` is not evidence of a network failure.
 */
function isRetryableByMessage(message: string): boolean {
  const m = message.toLowerCase()
  // Postgres statement timeouts: retrying repeats expensive work and worsens overload.
  if (
    m.includes('statement timeout') ||
    m.includes('canceling statement due to statement timeout') ||
    m.includes('query canceled')
  ) {
    return false
  }
  if (isNetworkFetchErrorMessage(m)) return true
  if (m.includes('network') || m.includes('timeout') || m.includes('connection')) return true
  if (m.includes('temporary') || m.includes('too many connections') || m.includes('deadlock')) return true
  return false
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function readCode(v: unknown): string | undefined {
  if (!isPlainObject(v) && !(v instanceof Error)) return undefined
  const code = (v as { code?: unknown }).code
  if (typeof code === 'string' && code.trim()) return code.trim()
  if (typeof code === 'number') return String(code)
  return undefined
}

function readStatus(v: unknown): number | undefined {
  if (!isPlainObject(v) && !(v instanceof Error)) return undefined
  const status = (v as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function readMessage(v: unknown): string {
  if (v instanceof Error) return v.message
  if (isPlainObject(v) && typeof v.message === 'string') return v.message
  if (typeof v === 'string') return v
  return ''
}

/**
 * Checks if an error is retryable: the network failed to reach the server, or
 * the server answered with a transient code / 5xx / 429. Permanent server
 * answers (`22P02`, `42501`, `PGRST116`, any other 4xx) are never retried.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false

  // AbortError (user navigated away, request cancelled) - never retry
  const isAbort =
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AbortError') ||
    (error instanceof Error && /abort/i.test(error.message))
  if (isAbort) return false

  if (error instanceof DatabaseError) {
    if (error.kind === 'network') return true
    if (error.kind === 'server') return isTransientServerError(error.code, error.status)
    return isRetryableByMessage(error.serverMessage ?? error.message)
  }

  if (isFetchLayerTypeError(error)) return true

  // Structured non-DatabaseError (a PostgrestError thrown via throwOnError, a raw result error object).
  const code = readCode(error)
  const status = readStatus(error)
  if (code != null || status != null) {
    const kind = classifyResultError({ message: readMessage(error), code, status })
    if (kind === 'network') return true
    if (kind === 'server') return isTransientServerError(code, status)
  }

  return isRetryableByMessage(readMessage(error) || String(error))
}

/**
 * Executes an async operation with automatic retry logic for transient failures
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => {
 *     const { data, error } = await supabase.from('users').select('*')
 *     if (error) throw new DatabaseError(error.message)
 *     return data
 *   },
 *   { maxRetries: 3, initialDelay: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // If this is the last attempt or error is not retryable, throw
      if (attempt === opts.maxRetries || !isRetryableError(error)) {
        throw error
      }

      // Exponential backoff with EQUAL JITTER: half the computed backoff is
      // fixed, half is randomized, so the delay lands in [cap/2, cap]. Without
      // jitter, many clients that fail at the same instant (e.g. a brief origin
      // blip) retry in lockstep and re-saturate the recovering origin — a
      // synchronized retry storm. See the 2026-06-04 incident: the HTTP 522
      // burst was dominated by lockstep retries of the activity heartbeat.
      const cap = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      )
      const delay = Math.round(cap / 2 + Math.random() * (cap / 2))

      if (opts.logRetries) {
        console.warn(
          `Operation failed (attempt ${attempt + 1}/${opts.maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`,
          error
        )
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Checks a Supabase operation result for errors and throws if found
 *
 * @param result - The Supabase operation result
 * @param operation - Description of the operation for error messages
 * @throws DatabaseError if the operation failed
 *
 * @example
 * ```ts
 * const result = await supabase.from('users').select('*')
 * checkSupabaseError(result, 'fetch users')
 * // Use result.data safely here
 * ```
 */
export function checkSupabaseError<T>(
  result: { data: T | null; error: SupabaseResultError | null; status?: number },
  operation: string
): asserts result is { data: T; error: null } {
  if (result.error) {
    throw databaseErrorFromResult(result.error, operation, result.status)
  }
}

/** Shape returned by awaited Supabase `.from` / `.rpc` builders (thenables). */
export type SupabaseClientResult<T> = {
  data: T | null
  error: SupabaseResultError | null
  /** HTTP status; `0` when the fetch layer failed. Forwarded into the error's class. */
  status?: number
}

/**
 * Wraps a Supabase operation with retry logic and error checking
 *
 * @param operation - Must return a thenable that resolves to `{ data, error }` (e.g. `() => supabase.from(...).select()` or `() => supabase.rpc(...)`).
 * @param operationName - Description for error messages
 * @param options - Retry configuration
 * @returns Promise resolving to the operation data
 *
 * @example
 * ```ts
 * const users = await withSupabaseRetry(
 *   () => supabase.from('users').select('*'),
 *   'fetch users'
 * )
 * const row = await withSupabaseRetry(
 *   () => supabase.rpc('my_fn', { p_id: id }),
 *   'run my_fn'
 * )
 * ```
 */
export async function withSupabaseRetry<T>(
  operation: () => PromiseLike<SupabaseClientResult<T>>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(async () => {
    const result = await operation()
    checkSupabaseError(result, operationName)
    return result.data
  }, options)
}

// ---------------------------------------------------------------------------
// Rendering: class → sentence
// ---------------------------------------------------------------------------

/** `42501` insufficient_privilege — RLS refusals arrive as this code. */
const ACCESS_DENIED_CODES: ReadonlySet<string> = new Set(['42501'])
/** `22P02` invalid uuid text (`bid:<uuid>` fed to a uuid column); `PGRST116` `.single()` found no row. */
const BROKEN_LINK_CODES: ReadonlySet<string> = new Set(['22P02', 'PGRST116'])

const LOAD_VERB_RE = /^(fetch|load|get|list|read|query|count|select)\b\s*/
const ANY_VERB_RE =
  /^(fetch|load|get|list|read|query|count|select|insert|update|upsert|delete|remove|save|create|run|call|check|set|apply|persist|sync|send)\b\s*/

/** `'fetchScheduleJobContext'` → `'fetch schedule job context'`; underscores become spaces. */
export function humanizeOperationName(operationName: string): string {
  return operationName
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** The thing an operation is about — `'fetch bid for preview'` → `'bid for preview'`; empty → `'record'`. */
export function operationSubject(operationName: string): string {
  const words = humanizeOperationName(operationName).replace(ANY_VERB_RE, '').trim()
  return words || 'record'
}

function isLoadOperation(operationName: string): boolean {
  return LOAD_VERB_RE.test(humanizeOperationName(operationName))
}

/**
 * Pure: the user-facing sentence for a classified failure. `rawMessage` is
 * what to show when there is nothing better (legacy errors with no operation
 * name).
 */
export function describeClassifiedError(input: {
  kind: DatabaseErrorKind
  code?: string
  operationName?: string
  serverMessage?: string
  rawMessage: string
}): string {
  if (input.kind === 'network') return OFFLINE_ERROR_MESSAGE
  const code = (input.code ?? '').trim()
  const op = input.operationName?.trim() || undefined
  if (input.kind === 'server' && code) {
    if (ACCESS_DENIED_CODES.has(code)) {
      if (!op) return "You don't have access to this record."
      return isLoadOperation(op)
        ? `You don't have access to this ${operationSubject(op)}.`
        : `You don't have permission to ${humanizeOperationName(op)}.`
    }
    if (BROKEN_LINK_CODES.has(code)) return "This link points to something that doesn't exist any more."
  }
  if (op && input.serverMessage != null) {
    return isLoadOperation(op)
      ? `Couldn't load ${operationSubject(op)}: ${input.serverMessage}`
      : `Failed to ${humanizeOperationName(op)}: ${input.serverMessage}`
  }
  return input.rawMessage
}

function describeDatabaseError(error: DatabaseError): string {
  return describeClassifiedError({
    kind: error.kind,
    code: error.code,
    operationName: error.operationName,
    serverMessage: error.serverMessage,
    rawMessage: error.message,
  })
}

function reportShown(kind: DatabaseErrorKind, code: string | undefined, operation: string | undefined, status?: number) {
  reportErrorClass({ kind, code: code ?? '', operation: operation ?? '', status })
}

/**
 * Formats an error for display to users
 *
 * @param error - The error to format
 * @param fallbackMessage - Fallback message if error is not descriptive
 * @returns User-friendly error message
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  // A phone with no signal fails at the fetch layer — swap the per-engine
  // TypeError text ("Load failed", "Failed to fetch", …) for plain language
  // instead of showing techs the wrapped internals (v2.1026). Decided by
  // class (v2.2836): only a network-kind error renders the offline copy.
  if (error instanceof DatabaseError) {
    reportShown(error.kind, error.code, error.operationName, error.status)
    return describeDatabaseError(error)
  }

  if (isFetchLayerTypeError(error)) {
    reportShown('network', '', '')
    return OFFLINE_ERROR_MESSAGE
  }

  if (error instanceof Error) {
    const code = readCode(error)
    if (code != null) {
      // A structured server error thrown as a plain Error (PostgrestError): never offline.
      reportShown('server', code, '', readStatus(error))
      return describeClassifiedError({ kind: 'server', code, serverMessage: error.message, rawMessage: error.message })
    }
    return isNetworkFetchErrorMessage(error.message) ? OFFLINE_ERROR_MESSAGE : error.message
  }

  if (typeof error === 'string') {
    return isNetworkFetchErrorMessage(error) ? OFFLINE_ERROR_MESSAGE : error
  }

  return fallbackMessage
}

/**
 * Thrown by {@link withOperationTimeout} when the wrapped promise doesn't
 * settle in time. Distinct class so callers can message "the server isn't
 * responding" differently from a real error response.
 */
export class OperationTimeoutError extends Error {
  constructor(operationName: string, ms: number) {
    super(`${operationName} did not respond within ${Math.round(ms / 1000)}s`)
    this.name = 'OperationTimeoutError'
  }
}

/**
 * Deadline for an await that must never hang the UI. Retries (withRetry)
 * only help when requests FAIL — when the DB freezes mid-request the fetch
 * never settles and "Saving…" spinners hang forever (the 2026-07-28
 * schedule-save incident; same class of hang as the v2.1051 auth-gate
 * watchdog). NOTE: the underlying request is not cancelled — it may still
 * land after the timeout, so callers should say "may or may not have saved".
 */
export async function withOperationTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operationName: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new OperationTimeoutError(operationName, ms)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Appended to error toasts when a full page refresh may recover (e.g. transient DB timeouts). */
export const TOAST_TRY_REFRESH_APP_HINT = 'Try refreshing the app'

export function appendToastRefreshHint(message: string): string {
  const trimmed = message.trimEnd()
  if (trimmed.endsWith(TOAST_TRY_REFRESH_APP_HINT)) return trimmed
  return `${trimmed}\n${TOAST_TRY_REFRESH_APP_HINT}`
}

/**
 * Formats Supabase PostgREST / `throw error` client errors for UI (RLS 403, constraints, etc.).
 * Includes `code`, `details`, and `hint` when present. Safe for multi-line display (`white-space: pre-wrap`).
 */
export function formatPostgrestOrUnknownError(error: unknown, fallbackMessage: string): string {
  // Same class-based mapping as formatErrorMessage: only a network-kind
  // failure reads as "no connection"; a server answer never does, whatever
  // its message says.
  if (error instanceof DatabaseError) {
    reportShown(error.kind, error.code, error.operationName, error.status)
    if (error.kind === 'network') return OFFLINE_ERROR_MESSAGE
    const parts: string[] = [describeDatabaseError(error)]
    const code = error.code?.trim()
    if (code) parts.push(`Code: ${code}`)
    const det = error.details
    if (typeof det === 'string' && det.trim()) {
      parts.push(`Details: ${det.trim()}`)
    } else if (det != null && typeof det !== 'string') {
      try {
        parts.push(`Details: ${JSON.stringify(det)}`)
      } catch {
        /* ignore */
      }
    }
    return parts.join('\n')
  }

  if (isFetchLayerTypeError(error)) {
    reportShown('network', '', '')
    return OFFLINE_ERROR_MESSAGE
  }

  if (isPlainObject(error) || error instanceof Error) {
    const message = readMessage(error).trim()
    const code = readCode(error)
    const status = readStatus(error)
    const kind = code != null || status != null ? classifyResultError({ message, code, status }) : 'unknown'
    if (kind === 'network' || (kind === 'unknown' && isNetworkFetchErrorMessage(message))) {
      reportShown('network', '', '', status)
      return OFFLINE_ERROR_MESSAGE
    }
    if (code != null) reportShown('server', code, '', status)
    const details = isPlainObject(error) && typeof error.details === 'string' ? error.details.trim() : ''
    const hint = isPlainObject(error) && typeof error.hint === 'string' ? error.hint.trim() : ''
    const parts: string[] = []
    const lead =
      kind === 'server'
        ? describeClassifiedError({ kind, code, serverMessage: message, rawMessage: message })
        : message
    if (lead) parts.push(lead)
    if (code) parts.push(`Code: ${code}`)
    if (details) parts.push(`Details: ${details}`)
    if (hint) parts.push(`Hint: ${hint}`)
    if (parts.length > 0) return parts.join('\n')
  }

  if (typeof error === 'string' && error.trim()) {
    return isNetworkFetchErrorMessage(error) ? OFFLINE_ERROR_MESSAGE : error
  }

  return fallbackMessage
}

/**
 * Executes multiple delete operations with proper error checking and rollback support
 *
 * @param operations - Array of delete operations with their descriptions
 * @returns Promise resolving when all deletes complete
 * @throws DatabaseError with details about which operation failed
 *
 * @example
 * ```ts
 * await executeDeleteChain([
 *   {
 *     operation: () => supabase.from('items').delete().eq('parent_id', id),
 *     description: 'delete child items'
 *   },
 *   {
 *     operation: () => supabase.from('parent').delete().eq('id', id),
 *     description: 'delete parent'
 *   }
 * ])
 * ```
 */
export async function executeDeleteChain(
  operations: Array<{
    operation: () => Promise<{ error: SupabaseResultError | null; status?: number }>
    description: string
  }>
): Promise<void> {
  for (let i = 0; i < operations.length; i++) {
    const item = operations[i]
    if (!item) continue

    const { operation, description } = item
    const result = await operation()

    if (result.error) {
      throw databaseErrorFromResult(
        result.error,
        description,
        result.status,
        `Failed to ${description} (step ${i + 1}/${operations.length}): ${result.error.message}`,
      )
    }
  }
}
