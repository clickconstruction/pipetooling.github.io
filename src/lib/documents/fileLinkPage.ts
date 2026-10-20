/**
 * Messages, cut 7d: the page a file's own link opens, `/f/<link>` (`to-dos/gc-mode/messages/files-out-mockups.html` on
 * spike/gc-mode, screen 7). The link is the office's, not Drive's: the page asks `drive-link`'s open door, which counts
 * the open and answers how to hand the file over, then forwards to it. A file in the job's Plans half opens in Drive's
 * own viewer; a Team only file comes through the function itself. A link cut off, ended, unknown or too big says so in
 * plain words.
 *
 * The open door's answer is the function's (`supabase/functions/_shared/driveLink.ts`, `OpenAnswer`). Its shape is
 * copied here and checked on read, since the page imports nothing from the edge. The words are English and Spanish, as
 * the portal pages' are, and show in English until the portal's Spanish is on (`portalShownLang`).
 */
import type { PortalLang } from '../gc/portalI18n'

/** Why a link opens nothing, as the open door says it. */
export type FileLinkOff = 'cut' | 'ended' | 'unknown' | 'tooBig'

/** The open door's answer: Drive's viewer, the function's own stream, or the reason it opens nothing. */
export type FileLinkAnswer =
  | { kind: 'drive'; url: string; name: string }
  | { kind: 'stream'; url: string; name: string }
  | { kind: 'off'; why: FileLinkOff }

const OFF: readonly FileLinkOff[] = ['cut', 'ended', 'unknown', 'tooBig']

/** A link's token as the path carries it: base64url, the function's own rule (`linkTokenShape`). */
export function fileLinkTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

/** The open door's address for a link. The office's preview flag rides along, so its look is not counted. */
export function fileLinkRequestUrl(supabaseUrl: string, token: string, preview: boolean): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/drive-link?t=${encodeURIComponent(token)}${preview ? '&preview=1' : ''}`
}

/** A place the page may send a person: an https address and nothing else. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

/** The open door's answer, checked; null when it is not one the page knows. */
export function readFileLinkAnswer(body: unknown): FileLinkAnswer | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.kind === 'off') return OFF.includes(b.why as FileLinkOff) ? { kind: 'off', why: b.why as FileLinkOff } : null
  if (b.kind !== 'drive' && b.kind !== 'stream') return null
  const url = safeUrl(b.url)
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : null
  return url && name ? { kind: b.kind, url, name } : null
}

type WordKey = 'opening' | 'from' | 'off' | 'askNew' | 'unknown' | 'tooBig' | 'failed' | 'tryAgain'

/** Every word the page says, in both languages. The Spanish waits for the portal's reader with the rest. */
export const FILE_LINK_WORDS: Readonly<Record<WordKey, Readonly<Record<PortalLang, string>>>> = {
  opening: { en: 'Opening {name}…', es: 'Abriendo {name}…' },
  from: { en: 'From {company}.', es: 'De {company}.' },
  off: { en: 'This link was turned off.', es: 'Este enlace se desactivó.' },
  askNew: { en: 'Ask {company} for a new one.', es: 'Pida uno nuevo a {company}.' },
  unknown: {
    en: 'This link does not open a file. Check that it was copied whole.',
    es: 'Este enlace no abre ningún archivo. Revise que se haya copiado completo.',
  },
  tooBig: {
    en: 'This file is too big to open from a link. Ask {company} to send it another way.',
    es: 'Este archivo es demasiado grande para abrirlo desde un enlace. Pida a {company} que lo envíe de otra forma.',
  },
  failed: { en: 'The link did not open. Try again in a minute.', es: 'El enlace no se abrió. Intente de nuevo en un minuto.' },
  tryAgain: { en: 'Try again', es: 'Intentar de nuevo' },
}

export function fileLinkWords(lang: PortalLang, key: WordKey, vars: Readonly<Record<string, string>> = {}): string {
  return FILE_LINK_WORDS[key][lang].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

/** What the page shows: the file opening, with where it goes; a link that opens nothing; or a read that failed. */
export type FileLinkView =
  | { step: 'opening'; lines: string[]; go: string }
  | { step: 'off'; lines: string[] }
  | { step: 'failed'; lines: string[]; retry: string }

/**
 * The page for an answer. Null means the read failed (no answer, or one the page does not know). A link cut off and one
 * that ended read the same, as the mock-up has them.
 */
export function fileLinkView(answer: FileLinkAnswer | null, lang: PortalLang, company: string): FileLinkView {
  const w = (key: WordKey, vars: Record<string, string> = {}) => fileLinkWords(lang, key, { company, ...vars })
  if (!answer) return { step: 'failed', lines: [w('failed')], retry: w('tryAgain') }
  if (answer.kind === 'off') {
    if (answer.why === 'unknown') return { step: 'off', lines: [w('unknown')] }
    if (answer.why === 'tooBig') return { step: 'off', lines: [w('tooBig')] }
    return { step: 'off', lines: [w('off'), w('askNew')] }
  }
  return { step: 'opening', lines: [w('opening', { name: answer.name }), w('from')], go: answer.url }
}
