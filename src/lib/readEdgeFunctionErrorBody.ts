import { FunctionsHttpError } from '@supabase/functions-js'

/**
 * Edge Functions return JSON `{ error: string }` on 4xx/5xx, but `functions.invoke` surfaces a generic
 * `FunctionsHttpError` message. Read the body when possible for user-visible detail.
 */
export async function readEdgeFunctionErrorBody(err: unknown): Promise<string | null> {
  if (!(err instanceof FunctionsHttpError) || !(err.context instanceof Response)) {
    return null
  }
  try {
    const ct = err.context.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return null
    const j = (await err.context.clone().json()) as Record<string, unknown>
    if (typeof j.error === 'string' && j.error.trim().length > 0) {
      return j.error.trim()
    }
  } catch {
    return null
  }
  return null
}
