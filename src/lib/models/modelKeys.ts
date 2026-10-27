/**
 * The Model keys card in Settings (punch list #186, v2.5916): Settings → Phone and texts → **Model keys**, under the
 * Quo connection, where the owner or a dev pastes a language model's API key, which `model-config` keeps in Vault.
 * The card shows only the key's last four characters, when it was saved and by whom, and what the key is used for.
 * One provider today, Anthropic, for the drafts the app offers (`report-draft`). Pure: the words, the status as the
 * function answers it, and what is wrong with a pasted key.
 */
import { whenWords } from '../messages/thread'

export type ModelProvider = 'anthropic'

export interface ModelKeyStatus {
  provider: ModelProvider
  set: boolean
  source: 'vault' | 'env' | 'none'
  last4: string | null
  savedAt: string | null
  savedBy: string | null
}

export const NO_MODEL_KEY: ModelKeyStatus = { provider: 'anthropic', set: false, source: 'none', last4: null, savedAt: null, savedBy: null }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** The status as the function answers it. Words that are not its shape read as no key. */
export function parseModelKeyStatus(json: unknown): ModelKeyStatus {
  if (!json || typeof json !== 'object') return NO_MODEL_KEY
  const o = json as Record<string, unknown>
  const source = o.source === 'vault' || o.source === 'env' ? o.source : 'none'
  const set = o.set === true && source !== 'none'
  return {
    provider: 'anthropic',
    set,
    source: set ? source : 'none',
    last4: set && source === 'vault' ? text(o.last4) || null : null,
    savedAt: set && source === 'vault' ? text(o.saved_at) || null : null,
    savedBy: set && source === 'vault' ? text(o.saved_by) || null : null,
  }
}

/** What is wrong with a pasted key before it is sent, or null. */
export function modelKeyProblem(key: string): string | null {
  const k = key.trim()
  if (!k) return 'Paste the key first.'
  if (/\s/.test(k)) return 'The key has a space in it. Paste it again.'
  if (k.length < 16) return 'That is too short to be a key.'
  if (k.length > 400) return 'That is too long to be a key.'
  return null
}

/** The key's line: "Key ending in 4f2a is saved." / "A key is set on the server." / "No key yet." */
export function maskedModelKeyWords(status: ModelKeyStatus): string {
  if (!status.set) return 'No key yet.'
  if (status.source === 'env') return 'A key is set on the server. Paste one here to use yours instead.'
  return status.last4 ? `Key ending in ${status.last4} is saved.` : 'A key is saved.'
}

/** "Saved yesterday by Robert." or '' */
export function modelKeySavedWords(status: ModelKeyStatus, nowIso: string): string {
  if (!status.set || status.source !== 'vault' || !status.savedAt) return ''
  const by = status.savedBy ? ` by ${status.savedBy}` : ''
  return `Saved ${whenWords(status.savedAt, nowIso)}${by}.`
}

export const MODEL_KEYS_TITLE = 'Model keys'
export const MODEL_KEYS_INTRO = 'A language model drafts what a person then reads and presses. Today that is the field report a tech talks through. Nothing is written without the press.'
export const MODEL_KEYS_WHERE = 'Get an API key from Anthropic at console.anthropic.com. Paste it here. It is kept in the vault and never shown again.'
export const MODEL_KEYS_COST = 'Each drafted report costs about a cent on Claude Opus 5.5. The form says what each one cost.'
export const MODEL_KEY_LABEL = 'Anthropic API key'
export const MODEL_KEY_SAVE = 'Save the key'
export const MODEL_KEY_FORGET = 'Forget the key'
export const MODEL_KEY_SAVED_TOAST = 'Saved. The report form can draft from a voice note now.'
export const MODEL_KEY_FORGOT_TOAST = 'The key is gone. The report form puts the words into Notes as said.'
export const MODEL_KEYS_NOT_ALLOWED = 'Only the owner or a dev sets the model keys.'
