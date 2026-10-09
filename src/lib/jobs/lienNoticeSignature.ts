import type { FilingSignature } from '../jobsDocuments/lienFilingDocuments'
import { signedRecordId } from '../signedRecordId'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * The leader's electronic signature on a lien notice (v2.5077, lien desk signing PR 1). The
 * desk item carries it in seven columns (migration 20261010020000); this kernel turns the row
 * into what the papers print and says when the signature no longer counts.
 *
 * What makes it a signature is the record, not the mark: a symbol adopted with intent (the press
 * of Sign and approve ▸), the leader's own act (his sign-in, or his hand on the office's screen,
 * which the row says), bound to this notice as drafted (`signed_fields_hash`), kept with the
 * packet as sent. The cursive face is only how the name looks.
 *
 * - `lienFieldsHash`: the hash of the draft's `fields` — stable across key order.
 * - `lienNoticeSignatureFromRow`: the row's signature, or null when unsigned or when the draft
 *   changed after signing (the hash no longer matches): the run then holds the notice.
 * - `lienSignatureAuditLine`: the sentence under the frame — how, who, when, whose screen.
 */

/** The seven signature columns as a row may carry them (typed here until `database.ts` is regenerated). */
export type LienDeskSignatureColumns = {
  signed_at: string | null
  signed_by: string | null
  signed_on_device_of: string | null
  signer_printed_name: string | null
  signer_signature_mode: string | null
  signer_signature_storage_path: string | null
  signed_fields_hash: string | null
}

const SIGNATURE_KEYS: ReadonlyArray<keyof LienDeskSignatureColumns> = [
  'signed_at',
  'signed_by',
  'signed_on_device_of',
  'signer_printed_name',
  'signer_signature_mode',
  'signer_signature_storage_path',
  'signed_fields_hash',
]

/** The signature columns off any row shape; a column the row lacks reads as null. */
export function signatureColumnsOf(row: unknown): LienDeskSignatureColumns {
  const r = (row ?? {}) as Record<string, unknown>
  const out = {} as Record<keyof LienDeskSignatureColumns, string | null>
  for (const k of SIGNATURE_KEYS) {
    const v = r[k]
    out[k] = typeof v === 'string' ? v : null
  }
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
 */
export function lienFieldsHash(fields: unknown): string {
  const s = canonical(fields)
  return fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0') + fnv1a(s, 0x9747b28c).toString(16).padStart(8, '0')
}

export type LienNoticeSignature = {
  mode: 'type' | 'draw'
  printedName: string
  /** The drawn ink as a data URL; null for a pressed signature or when the file was not read. */
  pngDataUrl: string | null
  signedAtIso: string
  /** `L878-4C2E91`: printed in the frame's corner, ties the paper to the row. */
  recordId: string
  /** "Signed October 9, 2026 at 2:14 PM CT" — the frame's last line. */
  signedWords: string
  /** The sentence under the frame. */
  auditLine: string
  onDeviceOf: string | null
}

export function lienSignedRecordId(jobNumber: string, itemId: string): string {
  return signedRecordId('L', jobNumber, itemId)
}

/** "October 9, 2026" and "2:14 PM" in the app's calendar. */
export function lienSignatureWhen(iso: string): { day: string; clock: string } {
  const when = new Date(iso)
  return {
    day: new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'long', day: 'numeric', year: 'numeric' }).format(when),
    clock: new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(when),
  }
}

/**
 * "Placed by Robert Douglas with one press under his own sign-in to ClickTooling on October 9, 2026
 * at 2:14 PM CT." / "Drawn by Robert Douglas in ClickTooling on …, on Taunya’s screen."
 */
export function lienSignatureAuditLine(sig: { mode: 'type' | 'draw'; printedName: string; signedAtIso: string }, onDeviceOf?: string | null): string {
  const { day, clock } = lienSignatureWhen(sig.signedAtIso)
  const device = (onDeviceOf ?? '').trim()
  const name = sig.printedName.trim() || 'the leader'
  const opener = sig.mode === 'draw' ? `Drawn by ${name} in ClickTooling` : `Placed by ${name} with one press under his own sign-in to ClickTooling`
  return `${opener} on ${day} at ${clock} CT${device ? `, on ${device}’s screen` : ''}.`
}

/** The signature stands only while the draft is what he signed. */
export function lienSignatureStale(row: Pick<LienDeskSignatureColumns, 'signed_at' | 'signed_fields_hash'>, fieldsHash: string): boolean {
  if (!row.signed_at) return false
  const signed = (row.signed_fields_hash ?? '').trim()
  return signed !== '' && signed !== fieldsHash
}

/**
 * The row's signature for the papers, or null: unsigned, no name to print, or the draft changed
 * after signing (the run holds those; the leader signs again).
 */
export function lienNoticeSignatureFromRow(
  row: LienDeskSignatureColumns,
  opts: { jobNumber: string; itemId: string; fieldsHash: string; onDeviceName?: string | null; pngDataUrl?: string | null },
): LienNoticeSignature | null {
  const name = (row.signer_printed_name ?? '').trim()
  if (!row.signed_at || !name) return null
  if (lienSignatureStale(row, opts.fieldsHash)) return null
  const mode: 'type' | 'draw' = row.signer_signature_mode === 'draw' ? 'draw' : 'type'
  const onDeviceOf = row.signed_on_device_of ? (opts.onDeviceName ?? '').trim() || null : null
  const { day, clock } = lienSignatureWhen(row.signed_at)
  return {
    mode,
    printedName: name,
    pngDataUrl: mode === 'draw' ? (opts.pngDataUrl ?? null) : null,
    signedAtIso: row.signed_at,
    recordId: lienSignedRecordId(opts.jobNumber, opts.itemId),
    signedWords: `Signed ${day} at ${clock} CT`,
    auditLine: lienSignatureAuditLine({ mode, printedName: name, signedAtIso: row.signed_at }, onDeviceOf),
    onDeviceOf,
  }
}

/** The renderers' shape of the signature. */
export function toFilingSignature(sig: LienNoticeSignature): FilingSignature {
  return { mode: sig.mode, printedName: sig.printedName, pngDataUrl: sig.pngDataUrl, signedWords: sig.signedWords, recordId: sig.recordId, auditLine: sig.auditLine }
}

/** The patch that clears a signature (v2.5082): a draft saved after signing, a pull-back, an undo — the leader signs again. */
export const LIEN_DESK_SIGNATURE_CLEAR: LienDeskSignatureColumns = {
  signed_at: null,
  signed_by: null,
  signed_on_device_of: null,
  signer_printed_name: null,
  signer_signature_mode: null,
  signer_signature_storage_path: null,
  signed_fields_hash: null,
}

/** The chip's word on a ready notice (v2.5082): signed, with the instant, or unsigned — stale counts as unsigned. */
export function lienChipSigned(row: LienDeskSignatureColumns, fieldsHash: string): { at: string } | 'unsigned' {
  if (!row.signed_at || !(row.signer_printed_name ?? '').trim() || lienSignatureStale(row, fieldsHash)) return 'unsigned'
  return { at: row.signed_at }
}
