import type { ContractBookExportEntry } from './contractRichTextDocument'

export type { ContractBookExportEntry }

/** localStorage key prefix — same-origin handoff for the Contract Book "Preview" new tab. */
export const CONTRACT_BOOK_PREVIEW_STORAGE_PREFIX = 'cbpreview:'

/** Discard handoffs older than this so a stale/bookmarked preview tab shows the expired state. */
export const CONTRACT_BOOK_PREVIEW_TTL_MS = 60 * 60 * 1000

type ContractPreviewEnvelopeV1 = {
  v: 1
  writtenAt: number
  payload: ContractBookExportEntry
}

export function contractBookPreviewStorageKey(id: string): string {
  return `${CONTRACT_BOOK_PREVIEW_STORAGE_PREFIX}${id}`
}

/** Serialize an entry into a versioned, timestamped envelope for localStorage. */
export function serializeContractPreviewEntry(entry: ContractBookExportEntry): string {
  const envelope: ContractPreviewEnvelopeV1 = {
    v: 1,
    writtenAt: Date.now(),
    payload: {
      document_name: entry.document_name,
      book_body_html: entry.book_body_html,
      book_body_format: entry.book_body_format,
    },
  }
  return JSON.stringify(envelope)
}

/**
 * Parse a stored envelope back into an entry. Returns `null` on missing input,
 * non-JSON, wrong shape, or an expired `writtenAt` (older than the TTL).
 */
export function parseContractPreviewEntry(raw: string | null): ContractBookExportEntry | null {
  if (raw == null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const top = parsed as Record<string, unknown>
  if (top.v !== 1) return null
  if (typeof top.writtenAt !== 'number' || !Number.isFinite(top.writtenAt)) return null
  if (Date.now() - top.writtenAt > CONTRACT_BOOK_PREVIEW_TTL_MS) return null
  const p = top.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const rec = p as Record<string, unknown>
  if (typeof rec.document_name !== 'string') return null
  if (rec.book_body_html !== null && typeof rec.book_body_html !== 'string') return null
  if (typeof rec.book_body_format !== 'string') return null
  return {
    document_name: rec.document_name,
    book_body_html: rec.book_body_html as string | null,
    book_body_format: rec.book_body_format,
  }
}

/** Remove all Contract Book preview handoff keys (try/catch: private-mode / quota safe). */
export function clearContractPreviewKeys(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(CONTRACT_BOOK_PREVIEW_STORAGE_PREFIX)) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Write an entry under a fresh key (clearing any prior preview keys first) and
 * return the storage key, or `null` on failure (no localStorage / quota /
 * private mode). Used by the "Preview" button to hand the entry to the new tab.
 */
export function writeContractPreviewEntry(entry: ContractBookExportEntry): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    clearContractPreviewKeys()
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const key = contractBookPreviewStorageKey(id)
    localStorage.setItem(key, serializeContractPreviewEntry(entry))
    return key
  } catch {
    return null
  }
}
