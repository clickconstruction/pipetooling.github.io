// The hash that ties a leader's signature to a lien notice as drafted, and the rule for a notice that has no
// signature on it as it stands. Lives here (v2.7491) so notify-lien-approval and the desk read one rule: the function
// tells the leader of a notice that waits on his signature only when the desk would count it as unsigned.
// Pure: no env reads, no network. Re-exported to the client by src/lib/jobs/lienNoticeSignature.ts.

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const o = v as Record<string, unknown>
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
}

function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * The draft's `fields` as one short hash: canonical JSON (keys sorted, `undefined` dropped) through
 * two FNV-1a passes, sixteen hex characters. It detects an edit after signing; it is not a secret.
 */
export function lienFieldsHash(fields: unknown): string {
  const s = canonical(fields)
  return fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0') + fnv1a(s, 0x9747b28c).toString(16).padStart(8, '0')
}

/** The three columns the rule reads, as any row may carry them. */
export type LienSignedColumns = { signed_at?: unknown; signer_printed_name?: unknown; signed_fields_hash?: unknown }

/**
 * Whether the row carries no signature that counts for the draft as it stands: never signed, signed with no name, or
 * signed and then changed (the stored hash is not the draft's). The desk's `lienItemUnsigned` is this rule, and
 * `lienFieldsHash.shared.test.ts` holds the two to one answer.
 */
export function lienRowUnsigned(row: LienSignedColumns | null | undefined, fields: unknown): boolean {
  const r = row ?? {}
  const at = typeof r.signed_at === 'string' ? r.signed_at : ''
  const name = typeof r.signer_printed_name === 'string' ? r.signer_printed_name.trim() : ''
  if (!at || !name) return true
  const signed = typeof r.signed_fields_hash === 'string' ? r.signed_fields_hash.trim() : ''
  return signed !== '' && signed !== lienFieldsHash(fields)
}
