/**
 * Kernel for the Job Address autocomplete (v2.2338): parses the
 * address-autocomplete edge function's payload and splits each suggestion's
 * main text into [typed match, rest] so the dropdown can bold what the user
 * typed, Google-style.
 */

export type AddressSuggestion = {
  /** Street line, e.g. "1207 Kingsbury Ln". */
  main: string
  /** How many leading chars of `main` matched the typed input (0 = unknown). */
  mainMatchEnd: number
  /** Locality line, e.g. "Kingsbury, TX, USA". */
  secondary: string
  /** The full single-line address used when the suggestion is taken. */
  full: string
}

/** Minimum typed characters before the dropdown asks for suggestions. */
export const ADDRESS_SUGGEST_MIN_CHARS = 5
/** Debounce between keystrokes and the suggestion request. */
export const ADDRESS_SUGGEST_DEBOUNCE_MS = 300

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Defensive parse; [] on errors/gate refusals so the field degrades to a plain input. */
export function parseAddressSuggestions(raw: unknown): AddressSuggestion[] {
  if (raw == null || typeof raw !== 'object') return []
  const list = (raw as { suggestions?: unknown }).suggestions
  if (!Array.isArray(list)) return []
  const out: AddressSuggestion[] = []
  for (const v of list) {
    if (v == null || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const main = str(o.main).trim()
    if (main === '') continue
    const end = typeof o.mainMatchEnd === 'number' && Number.isFinite(o.mainMatchEnd) ? o.mainMatchEnd : 0
    out.push({
      main,
      mainMatchEnd: Math.max(0, Math.min(main.length, Math.round(end))),
      secondary: str(o.secondary).trim(),
      full: str(o.full).trim() || main,
    })
  }
  return out.slice(0, 5)
}

/** "1207 Kingsbury Ln" with matchEnd 9 → ["1207 King", "sbury Ln"]. */
export function splitMainForBold(s: AddressSuggestion): [string, string] {
  const n = s.mainMatchEnd
  if (n <= 0 || n >= s.main.length) return [s.main, '']
  return [s.main.slice(0, n), s.main.slice(n)]
}

/**
 * The locality shown at the row's right edge: Google's secondary text minus
 * the ", USA" tail nobody in a Texas office needs to read.
 */
export function suggestionLocality(s: AddressSuggestion): string {
  return s.secondary.replace(/,?\s*USA$/i, '')
}

/**
 * What a taken suggestion writes into the field: the full address without the
 * ", USA" tail — "1207 Kingsbury Ln, Kingsbury, TX 78638" — which is already
 * the street-comma-city shape the statement preview splits on.
 */
export function suggestionSavedAddress(s: AddressSuggestion): string {
  return s.full.replace(/,?\s*USA$/i, '').trim()
}
