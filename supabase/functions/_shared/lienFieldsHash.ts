// The hash that ties a leader's signature to a lien notice as drafted, and the rule for a notice that has no
// signature on it as it stands. Lives here (v2.7491) so notify-lien-approval and the desk read one rule: the function
// tells the leader of a notice that waits on his signature only when the desk would count it as unsigned.
// Pure: no env reads, no network. Re-exported to the client by src/lib/jobs/lienNoticeSignature.ts.

/**
 * The desk's own records kept on a notice's `fields` once it is mailed (v2.7565, punch list #370): what they promised,
 * the owner's call, the GC's written okay, each courtesy notice. None of them is on the paper the leader signed, so the
 * hash leaves them out and a record written after the mailing leaves the signature standing.
 *
 * A list of record keys, never a list of printed keys: a key this list does not name stays inside the hash, so a new
 * field on the paper still voids a signature. `runTakenBack`, `signatureCleared` and `redrawn` stay inside it on
 * purpose: each is written in the update that clears the signature, so none of them meets a standing one.
 * This file is read by Deno and cannot import the constants in `src/lib/jobs/lienCourtesyNotice.ts`;
 * `lienFieldsHash.records.test.ts` holds this list to them and to what the four writers write.
 */
export const LIEN_FIELDS_RECORD_KEYS: ReadonlyArray<string> = ['promise', 'ownerCall', 'gcAuthorizedDirectPay', 'courtesy']

/** The paper's part of `fields`: the top level without the desk's records. Anything that is not a plain object is itself. */
function withoutRecords(fields: unknown): unknown {
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) return fields
  const o = fields as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o)) if (!LIEN_FIELDS_RECORD_KEYS.includes(k)) out[k] = o[k]
  return out
}

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
 * The desk's records at the top level (`LIEN_FIELDS_RECORD_KEYS`) are left out, and only there: the same
 * word deeper in the draft is part of the paper. A draft that holds none of them hashes as it always did.
 */
export function lienFieldsHash(fields: unknown): string {
  const s = canonical(withoutRecords(fields))
  return fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0') + fnv1a(s, 0x9747b28c).toString(16).padStart(8, '0')
}

/** The three columns the rule reads, as any row may carry them. */
export type LienSignedColumns = { signed_at?: unknown; signer_printed_name?: unknown; signed_fields_hash?: unknown }

/**
 * Whether the row carries no signature that counts for the draft as it stands: never signed, signed with no name, or
 * signed and then changed (the stored hash is not the draft's). A record the desk wrote on a mailed notice is no
 * change to the paper (`LIEN_FIELDS_RECORD_KEYS`). The desk's `lienItemUnsigned` is this rule, and
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
