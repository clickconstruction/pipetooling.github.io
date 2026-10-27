/**
 * The Model keys card's reads and writes (punch list #186, v2.5916), all through the `model-config` function as the
 * signed-in owner or dev: the key's status (never the key), the key into Vault, the key forgotten. One interface, so
 * the card's smoke hands it a fake. A refusal's own words come back as the error.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { supabase } from '../supabase'
import { parseModelKeyStatus, type ModelKeyStatus, type ModelProvider } from './modelKeys'

export interface ModelKeysIo {
  status(provider: ModelProvider): Promise<ModelKeyStatus>
  /** Resolves with the status once the key is in Vault. Rejects with words a person can act on. */
  save(provider: ModelProvider, key: string): Promise<ModelKeyStatus>
  forget(provider: ModelProvider): Promise<ModelKeyStatus>
}

async function refusalWords(data: unknown, error: unknown, fallback: string): Promise<string> {
  const d = data as { error?: unknown } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  const body = await readEdgeFunctionErrorBody(error)
  if (body) return body
  if ((error as { name?: unknown } | null)?.name === 'FunctionsFetchError') return fallback
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') return (error as { message: string }).message
  return fallback
}

export function supabaseModelKeysIo(client: SupabaseClient<Database> = supabase): ModelKeysIo {
  const call = async (body: Record<string, unknown>, fallback: string): Promise<ModelKeyStatus> => {
    const { data, error } = await client.functions.invoke('model-config', { body })
    const d = (data ?? null) as Record<string, unknown> | null
    if (error || !d || d.ok !== true) throw new Error(await refusalWords(d, error, fallback))
    return parseModelKeyStatus(d)
  }
  return {
    status: (provider) => call({ action: 'status', provider }, 'Could not read the model keys.'),
    save: (provider, key) => call({ action: 'set', provider, key: key.trim() }, 'Could not save the key.'),
    forget: (provider) => call({ action: 'forget', provider }, 'Could not forget the key.'),
  }
}
