/**
 * Where a language model's API key comes from (punch list #186, v2.5916, the Model keys card in Settings): Vault first,
 * through the service-role function `model_secret_get` of migration 20261026220000, which the owner fills from
 * Settings → Phone and texts through `model-config`; then the function's own secret for the provider
 * (`ANTHROPIC_API_KEY`, `supabase secrets set`), so a key saved in Settings wins and nothing breaks while Vault holds
 * none. One provider today, Anthropic; the list is the one place to add another. No Deno globals: the environment
 * comes in as a getter, as `quoKey.ts` takes it.
 */

export type ModelProvider = 'anthropic'

export const MODEL_PROVIDERS: readonly ModelProvider[] = ['anthropic']

/** The function secret that stands in while Vault holds no key. */
export const MODEL_ENV_KEYS: Readonly<Record<ModelProvider, string>> = { anthropic: 'ANTHROPIC_API_KEY' }

export function isModelProvider(v: unknown): v is ModelProvider {
  return typeof v === 'string' && (MODEL_PROVIDERS as readonly string[]).includes(v)
}

export type ModelKeyDb = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

export type ModelKeySource = 'vault' | 'env' | 'none'

/** The key and where it came from. `key` is '' when neither Vault nor the environment holds one. */
export async function loadModelKey(db: ModelKeyDb, envGet: (k: string) => string | undefined, provider: ModelProvider): Promise<{ key: string; source: ModelKeySource }> {
  try {
    const { data, error } = await db.rpc('model_secret_get', { p_provider: provider })
    if (!error && typeof data === 'string' && data.trim()) return { key: data.trim(), source: 'vault' }
  } catch {
    /* no Vault function yet: the environment answers */
  }
  const env = envGet(MODEL_ENV_KEYS[provider])?.trim() ?? ''
  return env ? { key: env, source: 'env' } : { key: '', source: 'none' }
}

/** What a key must look like to be kept: one run of printable characters, no spaces, long enough to be a key. */
export const MODEL_KEY_SHAPE = /^[\x21-\x7e]{16,400}$/
