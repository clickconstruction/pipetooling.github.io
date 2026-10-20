/**
 * Where Docsmit's secrets come from (the Docsmit train, PR 9): Vault first, through the service-role
 * functions in migration 20261013160000, then the function's own environment (`supabase secrets set`),
 * so a connection set from Settings → Developer wins and nothing breaks where Vault is not set up yet.
 * No Deno globals: the environment comes in as a getter.
 */
import { docsmitConfigFromEnv, type DocsmitConfig } from './docsmitClient.ts'

export const DOCSMIT_SECRET_NAMES = ['DOCSMIT_EMAIL', 'DOCSMIT_PASSWORD_SHA512', 'DOCSMIT_SOFTWARE_ID', 'DOCSMIT_BASE_URL'] as const
export type DocsmitSecretName = (typeof DOCSMIT_SECRET_NAMES)[number]

export type MailConfigDb = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

/** Vault's value for each name (null when unset or Vault is not there), as the functions read it. */
export async function readVaultSecrets(db: MailConfigDb): Promise<Partial<Record<DocsmitSecretName, string>>> {
  const out: Partial<Record<DocsmitSecretName, string>> = {}
  for (const name of DOCSMIT_SECRET_NAMES) {
    try {
      const { data, error } = await db.rpc('mail_secret_get', { p_name: name.toLowerCase() })
      if (!error && typeof data === 'string' && data.trim()) out[name] = data.trim()
    } catch {
      /* no Vault yet: the environment answers */
    }
  }
  return out
}

/** The config the client needs, and where each value came from. Null when any of the three required is missing. */
export async function loadDocsmitConfig(db: MailConfigDb, envGet: (k: string) => string | undefined): Promise<{ config: DocsmitConfig | null; source: Record<DocsmitSecretName, 'vault' | 'env' | 'none'> }> {
  const vault = await readVaultSecrets(db)
  const source = {} as Record<DocsmitSecretName, 'vault' | 'env' | 'none'>
  const get = (k: string): string | undefined => {
    const name = k as DocsmitSecretName
    if (vault[name]) {
      source[name] = 'vault'
      return vault[name]
    }
    const v = envGet(k)
    source[name] = v && v.trim() ? 'env' : 'none'
    return v
  }
  const config = docsmitConfigFromEnv(get)
  for (const n of DOCSMIT_SECRET_NAMES) if (!source[n]) source[n] = 'none'
  return { config, source }
}
