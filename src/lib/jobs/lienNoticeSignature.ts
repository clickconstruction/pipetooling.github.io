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

/**
 * How a notice was signed: `type` = one press placed his name in cursive under his own sign-in;
 * `draw` = he drew it; `pen` (the pen train, migration 20261013100000) = he signed the paper as
 * printed with a pen and the office wrote it down — the row names who wrote it and how they know.
 */
export type LienSignatureMode = 'type' | 'draw' | 'pen'

/** How the office knows the leader signed the paper: they watched, he told them, or the signed page is in hand. */
export type LienPenWitnessHow = 'watched' | 'told' | 'page'

export const LIEN_PEN_WITNESS_HOWS: ReadonlyArray<{ key: LienPenWitnessHow; label: string }> = [
  { key: 'watched', label: 'I watched him sign' },
  { key: 'told', label: 'He told me he signed' },
  { key: 'page', label: 'I have the signed page in front of me' },
]

/** The ten signature columns as a row may carry them (typed here until `database.ts` is regenerated): seven from v2.5077, three from the pen train. */
export type LienDeskSignatureColumns = {
  signed_at: string | null
  signed_by: string | null
  signed_on_device_of: string | null
  signer_printed_name: string | null
  signer_signature_mode: string | null
  signer_signature_storage_path: string | null
  signed_fields_hash: string | null
  signed_recorded_by: string | null
  signed_witness_how: string | null
  signed_leader_confirmed_at: string | null
}

const SIGNATURE_KEYS: ReadonlyArray<keyof LienDeskSignatureColumns> = [
  'signed_at',
  'signed_by',
  'signed_on_device_of',
  'signer_printed_name',
  'signer_signature_mode',
  'signer_signature_storage_path',
  'signed_fields_hash',
  'signed_recorded_by',
  'signed_witness_how',
  'signed_leader_confirmed_at',
]

/** The row's mode as the kernel reads it: anything but `draw` or `pen` is a press. */
export function lienSignatureModeOf(raw: string | null | undefined): LienSignatureMode {
  return raw === 'draw' || raw === 'pen' ? raw : 'type'
}

/** The row's witness word, or null when it is not one of the three. */
export function lienPenWitnessHowOf(raw: string | null | undefined): LienPenWitnessHow | null {
  return raw === 'watched' || raw === 'told' || raw === 'page' ? raw : null
}

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

/** What the row says about a pen signature: who wrote it down, how they know, and whether the leader has confirmed it from his phone. */
export type LienPenRecord = {
  recordedByName: string | null
  how: LienPenWitnessHow
  confirmedAtIso: string | null
}

export type LienNoticeSignature = {
  mode: LienSignatureMode
  printedName: string
  /** The drawn ink as a data URL; null for a pressed or pen signature or when the file was not read. */
  pngDataUrl: string | null
  signedAtIso: string
  /** `L878-4C2E91`: printed in the frame's corner, ties the paper to the row. */
  recordId: string
  /** "Signed October 9, 2026 at 2:14 PM CT" — the frame's last line; "Signed by pen October 9, 2026" for a pen signature. */
  signedWords: string
  /** The sentence under the frame. */
  auditLine: string
  onDeviceOf: string | null
  /** The pen record; null for an electronic signature. */
  pen: LienPenRecord | null
}

/** "Taunya, who watched him sign" / "the office, who was told by him that he had signed" / "Taunya, who has the signed page". */
export function lienPenWitnessWords(how: LienPenWitnessHow, recordedByName: string | null | undefined): string {
  const who = (recordedByName ?? '').trim() || 'the office'
  const tail = how === 'watched' ? 'who watched him sign' : how === 'told' ? 'who was told by him that he had signed' : 'who has the signed page'
  return `${who}, ${tail}`
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
 * at 2:14 PM CT." / "Drawn by Robert Douglas in ClickTooling on …, on Taunya’s screen." / "Signed by
 * pen by Robert Douglas on October 9, 2026, on the paper as printed. Recorded by Taunya, who watched
 * him sign. Confirmed by Robert Douglas from his own sign-in on October 12, 2026."
 */
export function lienSignatureAuditLine(sig: { mode: LienSignatureMode; printedName: string; signedAtIso: string }, onDeviceOf?: string | null, pen?: Pick<LienPenRecord, 'recordedByName' | 'how'> & { confirmedAtIso?: string | null }): string {
  const { day, clock } = lienSignatureWhen(sig.signedAtIso)
  const device = (onDeviceOf ?? '').trim()
  const name = sig.printedName.trim() || 'the leader'
  if (sig.mode === 'pen') {
    const how = pen?.how ?? 'told'
    const confirmed = pen?.confirmedAtIso ? ` Confirmed by ${name} from his own sign-in on ${lienSignatureWhen(pen.confirmedAtIso).day}.` : ''
    return `Signed by pen by ${name} on ${day}, on the paper as printed. Recorded by ${lienPenWitnessWords(how, pen?.recordedByName)}.${confirmed}`
  }
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
  opts: { jobNumber: string; itemId: string; fieldsHash: string; onDeviceName?: string | null; pngDataUrl?: string | null; recordedByName?: string | null },
): LienNoticeSignature | null {
  const name = (row.signer_printed_name ?? '').trim()
  if (!row.signed_at || !name) return null
  if (lienSignatureStale(row, opts.fieldsHash)) return null
  const mode = lienSignatureModeOf(row.signer_signature_mode)
  const onDeviceOf = mode !== 'pen' && row.signed_on_device_of ? (opts.onDeviceName ?? '').trim() || null : null
  const pen: LienPenRecord | null = mode === 'pen' ? { recordedByName: (opts.recordedByName ?? '').trim() || null, how: lienPenWitnessHowOf(row.signed_witness_how) ?? 'told', confirmedAtIso: row.signed_leader_confirmed_at } : null
  const { day, clock } = lienSignatureWhen(row.signed_at)
  return {
    mode,
    printedName: name,
    pngDataUrl: mode === 'draw' ? (opts.pngDataUrl ?? null) : null,
    signedAtIso: row.signed_at,
    recordId: lienSignedRecordId(opts.jobNumber, opts.itemId),
    signedWords: mode === 'pen' ? `Signed by pen ${day}` : `Signed ${day} at ${clock} CT`,
    auditLine: lienSignatureAuditLine({ mode, printedName: name, signedAtIso: row.signed_at }, onDeviceOf, pen ?? undefined),
    onDeviceOf,
    pen,
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
  signed_recorded_by: null,
  signed_witness_how: null,
  signed_leader_confirmed_at: null,
}

/** The chip's word on a ready notice (v2.5082): signed, with the instant (and, the pen train, how and whether the leader confirmed), or unsigned — stale counts as unsigned. */
export function lienChipSigned(row: LienDeskSignatureColumns, fieldsHash: string): { at: string; mode: LienSignatureMode; recordedBy: string | null; confirmedAt: string | null } | 'unsigned' {
  if (!row.signed_at || !(row.signer_printed_name ?? '').trim() || lienSignatureStale(row, fieldsHash)) return 'unsigned'
  const mode = lienSignatureModeOf(row.signer_signature_mode)
  return { at: row.signed_at, mode, recordedBy: mode === 'pen' ? row.signed_recorded_by : null, confirmedAt: mode === 'pen' ? row.signed_leader_confirmed_at : null }
}

/** A pen record the leader has not yet confirmed from his own sign-in (the pen train, PR 3): his row on the desk, and nothing waits on it. */
export function lienPenAwaitsConfirm(row: LienDeskSignatureColumns, fieldsHash: string): boolean {
  const s = lienChipSigned(row, fieldsHash)
  return s !== 'unsigned' && s.mode === 'pen' && !s.confirmedAt
}

/**
 * The signature as the run shows it the moment after a drawing is recorded from the run window
 * (v2.5086): the window keeps its own list of notices, so it dresses the signed one from what it
 * just wrote rather than waiting on the desk's re-read.
 */
export function lienNoticeSignatureAfterSigning(args: { mode: LienSignatureMode; printedName: string; pngDataUrl: string | null; signedAtIso: string; jobNumber: string; itemId: string; onDeviceName: string | null; pen?: Pick<LienPenRecord, 'recordedByName' | 'how'> | null }): LienNoticeSignature {
  const { day, clock } = lienSignatureWhen(args.signedAtIso)
  const onDeviceOf = args.mode === 'pen' ? null : (args.onDeviceName ?? '').trim() || null
  const pen: LienPenRecord | null = args.mode === 'pen' ? { recordedByName: (args.pen?.recordedByName ?? '').trim() || null, how: args.pen?.how ?? 'told', confirmedAtIso: null } : null
  return {
    mode: args.mode,
    printedName: args.printedName,
    pngDataUrl: args.mode === 'draw' ? args.pngDataUrl : null,
    signedAtIso: args.signedAtIso,
    recordId: lienSignedRecordId(args.jobNumber, args.itemId),
    signedWords: args.mode === 'pen' ? `Signed by pen ${day}` : `Signed ${day} at ${clock} CT`,
    auditLine: lienSignatureAuditLine({ mode: args.mode, printedName: args.printedName, signedAtIso: args.signedAtIso }, onDeviceOf, pen ?? undefined),
    onDeviceOf,
    pen,
  }
}
