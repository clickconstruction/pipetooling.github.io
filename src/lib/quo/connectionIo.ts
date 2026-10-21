/**
 * The Quo connection's reads and its one write (v2.5718, `quo/connection.ts`), all through the `quo-config` function
 * as the signed-in owner or dev: the key's status (never the key), the key into Vault, and Quo's two lists for the
 * pickers. One interface, so the cards' smokes hand it a fake. A refusal's own words come back as the error, so the
 * card can show "Only the owner or a dev sets the Quo connection." instead of a status code.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { supabase } from '../supabase'
import { parseQuoDirectory, parseQuoKeyStatus, type QuoDirectory, type QuoKeyStatus } from './connection'

export interface QuoConnectionIo {
  status(): Promise<QuoKeyStatus>
  /** Resolves with the status once the key is in Vault. Rejects with words a person can act on. */
  save(key: string): Promise<QuoKeyStatus>
  /** Quo's members and numbers. Rejects with words when there is no key or Quo did not answer. */
  directory(): Promise<QuoDirectory>
}

/** The function's words for a refusal: its JSON `error` when the body has one, else the client's message. */
async function refusalWords(data: unknown, error: unknown, fallback: string): Promise<string> {
  const d = data as { error?: unknown } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  const body = await readEdgeFunctionErrorBody(error)
  if (body) return body
  // The function not reachable (not deployed yet, or no signal): the fallback's plain words, not the client's.
  if ((error as { name?: unknown } | null)?.name === 'FunctionsFetchError') return fallback
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') return (error as { message: string }).message
  return fallback
}

export function supabaseQuoConnectionIo(client: SupabaseClient<Database> = supabase): QuoConnectionIo {
  const call = async (body: Record<string, unknown>, fallback: string): Promise<Record<string, unknown>> => {
    const { data, error } = await client.functions.invoke('quo-config', { body })
    const d = (data ?? null) as Record<string, unknown> | null
    if (error || !d || d.ok !== true) throw new Error(await refusalWords(d, error, fallback))
    return d
  }
  return {
    async status() {
      return parseQuoKeyStatus(await call({ action: 'status' }, 'Could not read the Quo connection.'))
    },
    async save(key) {
      return parseQuoKeyStatus(await call({ action: 'set', key: key.trim() }, 'Could not save the key.'))
    },
    async directory() {
      const d = parseQuoDirectory(await call({ action: 'directory' }, 'Quo did not answer.'))
      if (!d) throw new Error('Quo did not answer.')
      return d
    },
  }
}
