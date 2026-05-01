/**
 * Error Handling and Retry Utilities
 * 
 * Provides utilities for handling database operations with retries,
 * comprehensive error checking, and consistent error messages.
 */

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
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
 * Checks if an error is retryable (transient network/database errors)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false
  
  // AbortError (user navigated away, request cancelled) - never retry
  const isAbort =
    (error instanceof Error && error.name === 'AbortError') ||
    (error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AbortError') ||
    (error instanceof Error && /abort/i.test(error.message))
  if (isAbort) return false
  
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  // Postgres statement timeouts: retrying repeats expensive work and worsens overload.
  if (
    errorMessage.includes('statement timeout') ||
    errorMessage.includes('canceling statement due to statement timeout') ||
    errorMessage.includes('query canceled')
  ) {
    return false
  }
  
  // Network errors
  if (errorMessage.includes('network') || 
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch')) {
    return true
  }
  
  // Database temporary errors
  if (errorMessage.includes('temporary') ||
      errorMessage.includes('too many connections') ||
      errorMessage.includes('deadlock')) {
    return true
  }
  
  return false
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
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      )
      
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
  result: { data: T | null; error: { message: string; code?: string; details?: string } | null },
  operation: string
): asserts result is { data: T; error: null } {
  if (result.error) {
    throw new DatabaseError(
      `Failed to ${operation}: ${result.error.message}`,
      result.error.code,
      result.error.details
    )
  }
}

/** Shape returned by awaited Supabase `.from` / `.rpc` builders (thenables). */
export type SupabaseClientResult<T> = {
  data: T | null
  error: { message: string; code?: string; details?: string } | null
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

/**
 * Formats an error for display to users
 * 
 * @param error - The error to format
 * @param fallbackMessage - Fallback message if error is not descriptive
 * @returns User-friendly error message
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (error instanceof DatabaseError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return fallbackMessage
}

/** Appended to error toasts when a full page refresh may recover (e.g. transient DB timeouts). */
export const TOAST_TRY_REFRESH_APP_HINT = 'Try refreshing the app'

export function appendToastRefreshHint(message: string): string {
  const trimmed = message.trimEnd()
  if (trimmed.endsWith(TOAST_TRY_REFRESH_APP_HINT)) return trimmed
  return `${trimmed}\n${TOAST_TRY_REFRESH_APP_HINT}`
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Formats Supabase PostgREST / `throw error` client errors for UI (RLS 403, constraints, etc.).
 * Includes `code`, `details`, and `hint` when present. Safe for multi-line display (`white-space: pre-wrap`).
 */
export function formatPostgrestOrUnknownError(error: unknown, fallbackMessage: string): string {
  if (error instanceof DatabaseError) {
    const parts: string[] = [error.message]
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

  if (isPlainObject(error)) {
    const message = typeof error.message === 'string' ? error.message.trim() : ''
    const code = typeof error.code === 'string' ? error.code.trim() : ''
    const details = typeof error.details === 'string' ? error.details.trim() : ''
    const hint = typeof error.hint === 'string' ? error.hint.trim() : ''
    const parts: string[] = []
    if (message) parts.push(message)
    if (code) parts.push(`Code: ${code}`)
    if (details) parts.push(`Details: ${details}`)
    if (hint) parts.push(`Hint: ${hint}`)
    if (parts.length > 0) return parts.join('\n')
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
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
    operation: () => Promise<{ error: { message: string; code?: string; details?: string } | null }>
    description: string
  }>
): Promise<void> {
  for (let i = 0; i < operations.length; i++) {
    const item = operations[i]
    if (!item) continue
    
    const { operation, description } = item
    const result = await operation()
    
    if (result.error) {
      throw new DatabaseError(
        `Failed to ${description} (step ${i + 1}/${operations.length}): ${result.error.message}`,
        result.error.code,
        result.error.details
      )
    }
  }
}
