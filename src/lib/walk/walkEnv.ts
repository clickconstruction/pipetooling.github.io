/**
 * The walk's keys (punch list #142, v2.6030; `docs/WALK_KIT.md` § Found on the first walks, item 1). The driver reads
 * the main checkout's `.env` and lays `.env.local` over it, as Vite does for the app, so the two keys a checkout keeps
 * in `.env` need no copying by hand; and a key that is still missing names itself and the files that were read. Pure:
 * the driver hands in each file's text, or null for a file that is not there.
 */

/** The three keys the walk needs, in the order the error names them. */
export const WALK_ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_DEV_LOGIN_SECRET'] as const
export type WalkEnvKey = (typeof WALK_ENV_KEYS)[number]

/** The files, in the order they are laid: a value in a later file wins. */
export const WALK_ENV_FILES = ['.env', '.env.local'] as const

export interface EnvFile {
  /** The file as the error names it: its path. */
  name: string
  /** Its text, or null when it is not there. */
  text: string | null
}

export interface LayeredEnv {
  env: Record<string, string>
  /** The files that were there, in the order laid. */
  read: string[]
  /** The files that were not. */
  notFound: string[]
}

/** `KEY=value` lines, the quotes around a value dropped; a comment, a blank line or an empty value sets nothing. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    const value = m[2]!.replace(/^(["'])(.*)\1$/, '$2')
    if (value) out[m[1]!] = value
  }
  return out
}

/** The files laid in order: a later file's value wins, and an empty value sets nothing, so a stub line hides no key. */
export function layerEnv(files: readonly EnvFile[]): LayeredEnv {
  const env: Record<string, string> = {}
  const read: string[] = []
  const notFound: string[] = []
  for (const f of files) {
    if (f.text === null) {
      notFound.push(f.name)
      continue
    }
    read.push(f.name)
    Object.assign(env, parseEnvText(f.text))
  }
  return { env, read, notFound }
}

/** The keys with no value, in the order asked. */
export function missingKeys(env: Readonly<Record<string, string>>, keys: readonly string[] = WALK_ENV_KEYS): string[] {
  return keys.filter((k) => !env[k])
}

const list = (items: readonly string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/**
 * Why the walk cannot start: which key is missing, which files were read and which were not there. Null when every
 * key has a value.
 */
export function missingKeyWords(layered: LayeredEnv, keys: readonly string[] = WALK_ENV_KEYS): string | null {
  const missing = missingKeys(layered.env, keys)
  if (!missing.length) return null
  const files = [layered.read.length ? `read ${list(layered.read)}` : null, layered.notFound.length ? `${list(layered.notFound)} not found` : null]
    .filter((b): b is string => b !== null)
    .join('; ')
  return `${list(missing)} ${missing.length === 1 ? 'is' : 'are'} missing (${files}). The walk needs ${list(keys)}, in the main checkout’s ${list([...WALK_ENV_FILES]).replace(' and ', ' or ')}.`
}
