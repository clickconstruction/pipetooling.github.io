/**
 * The last box this phone scanned (punch list #294, v2.6799): kept on the device for a day, so the bare `/b` page can
 * offer *Find a part on that site* without a second scan. Browser io with the storage handed in, so the tests hand a map.
 */

export const LAST_BOX_KEY = 'pt.boxPage.last'
/** A scan is remembered this long. */
export const LAST_BOX_MS = 24 * 60 * 60_000

export type LastBox = { code: string; stencil: string; kind: string; at: number }

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function rememberLastBox(box: Omit<LastBox, 'at'>, now = Date.now(), s: Store | null = store()): void {
  try {
    s?.setItem(LAST_BOX_KEY, JSON.stringify({ ...box, at: now } satisfies LastBox))
  } catch {
    /* a phone that keeps nothing still scans */
  }
}

/** The last box scanned within a day, or null. */
export function readLastBox(now = Date.now(), s: Store | null = store()): LastBox | null {
  try {
    const raw = s?.getItem(LAST_BOX_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Partial<LastBox>
    if (typeof b.code !== 'string' || typeof b.stencil !== 'string' || typeof b.at !== 'number') return null
    if (now - b.at > LAST_BOX_MS || now < b.at) return null
    return { code: b.code, stencil: b.stencil, kind: typeof b.kind === 'string' ? b.kind : 'box', at: b.at }
  } catch {
    return null
  }
}

/** The code as a person types it into the box on the Scan a label page: capitals, the dash put in after four. */
export function typedCodeWords(raw: string): string {
  const c = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}
