/**
 * Sign it again (v2.7502). An approved notice carries the leader's signature, and the office or the
 * leader wants a different one on it: his name in the cursive face in place of a drawing, or a clean
 * drawing in place of a poor one. The press takes the signature off and leaves the approval alone.
 * The desk's own rules then do the rest: the notice reads unsigned, the signing line returns, the
 * Board counts it as waiting on the leader, and the run holds it.
 *
 * Pure: when the press is offered, every word a person reads, and the line the notice keeps of who
 * cleared which signature. `clearLienSignatureToSignAgain` (lienDeskSignIo.ts) writes it.
 */
import { shortDay } from './lienFootChip'
import { lienChipSigned, lienFieldsHash, lienSignatureModeOf, signatureColumnsOf, type LienSignatureMode } from './lienNoticeSignature'

/** Kept on the item's `fields` as `signatureCleared`: the latest clear only. The drawing's file stays in storage, and this names it. */
export type LienSignatureCleared = {
  /** When the signature came off (an instant). */
  at: string
  by: string | null
  byName: string | null
  /** The signature that came off: when it was placed, whose it was, the name it printed, how, and its stored drawing or signed page. */
  signedAt: string | null
  signedBy: string | null
  signerName: string | null
  mode: LienSignatureMode | null
  storagePath: string | null
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function signatureClearedOf(fields: unknown): LienSignatureCleared | null {
  if (!fields || typeof fields !== 'object') return null
  const v = (fields as { signatureCleared?: unknown }).signatureCleared
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  const at = text(c.at)
  if (!at) return null
  return { at, by: text(c.by), byName: text(c.byName), signedAt: text(c.signedAt), signedBy: text(c.signedBy), signerName: text(c.signerName), mode: text(c.mode) ? lienSignatureModeOf(text(c.mode)) : null, storagePath: text(c.storagePath) }
}

/** The line for a row's signature as it stands, cleared now by this person. */
export function signatureClearedRecord(row: unknown, by: { userId: string | null; userName: string | null }, atIso: string): LienSignatureCleared {
  const s = signatureColumnsOf(row)
  return { at: atIso, by: by.userId, byName: text(by.userName), signedAt: s.signed_at, signedBy: s.signed_by, signerName: text(s.signer_printed_name), mode: s.signed_at ? lienSignatureModeOf(s.signer_signature_mode) : null, storagePath: s.signer_signature_storage_path }
}

/** The item's fields with the line set; every other field is kept. */
export function fieldsWithSignatureCleared(fields: unknown, cleared: LienSignatureCleared): Record<string, unknown> {
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
  return { ...base, signatureCleared: { ...cleared } }
}

type SignAgainRow = { status?: string | null; printed_at?: string | null; voided_at?: string | null }

/**
 * A row whose signature the write may clear: approved, not printed, not set aside, and carrying a signature.
 * The write filters on the same rule. A printed notice goes back to Approved · to print first.
 */
export function canClearSignatureRow(row: (SignAgainRow & { signed_at?: string | null }) | null | undefined): boolean {
  return Boolean(row) && row!.status === 'approved' && !row!.printed_at && !row!.voided_at && Boolean(row!.signed_at)
}

/**
 * Whether the press is drawn: the lien office or a leader, on a notice the write may clear whose signature
 * stands (one the draft has outgrown already reads unsigned, and its signing line is back). Left out while
 * the leader's own Not me / Not what I signed is drawn for the same signature: that press clears it too.
 */
export function signAgainOffered(input: { item: (SignAgainRow & { fields: unknown }) | null | undefined; office: boolean; leader: boolean; disownOffered?: boolean }): boolean {
  const { item } = input
  if (!item || !(input.office || input.leader) || input.disownOffered) return false
  const sig = signatureColumnsOf(item)
  return canClearSignatureRow({ ...item, signed_at: sig.signed_at }) && lienChipSigned(sig, lienFieldsHash(item.fields)) !== 'unsigned'
}

export const LIEN_SIGN_AGAIN_LABEL = 'Sign it again…'
export const LIEN_SIGN_AGAIN_HINT = 'Take this signature off so the leader can sign the notice again. The approval stands'
export const LIEN_SIGN_AGAIN_CONFIRM_LABEL = 'Clear the signature'

/** How the notice gets signed next, as the person pressing will see it. */
export type LienSignAgainHow =
  /** The leader on his own screen: his signing box opens in the footer. */
  | 'self'
  /** Another screen on a job with a master: he signs on his own screen, or here with his code or his hand. */
  | 'here_or_his_screen'
  /** No master on the job to sign here: the leader signs under his own sign-in. */
  | 'his_screen'

export function signAgainHow(input: { leader: boolean; otherScreen: boolean }): LienSignAgainHow {
  if (input.leader && !input.otherScreen) return 'self'
  return input.otherScreen ? 'here_or_his_screen' : 'his_screen'
}

function first(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/** "Halden Yard, job 4120" / "job 4120" / "this job". */
export function signAgainJobWords(jobNumber: string | null | undefined, jobName: string | null | undefined): string {
  const number = (jobNumber ?? '').trim()
  const name = (jobName ?? '').trim()
  if (name && number) return `${name}, job ${number}`
  return name || (number ? `job ${number}` : 'this job')
}

/**
 * The confirm, asked before anything changes. `signerName` is the name on the signature; `ownSignature` is true
 * when the person pressing is the one who signed. `leaderName` is the job's master as the desk knows him.
 */
export function signAgainConfirmWords(input: { jobWords: string; signedAtIso: string | null; signerName: string | null; ownSignature: boolean; how: LienSignAgainHow; leaderName: string | null }): { title: string; message: string; confirmLabel: string } {
  const day = input.signedAtIso ? shortDay(input.signedAtIso) : ''
  const whose = input.ownSignature ? 'Your' : `${(input.signerName ?? '').trim() || 'The leader'}’s`
  const leader = first(input.leaderName) || 'The leader'
  const lines = [
    `${whose} signature${day ? ` from ${day}` : ''} comes off this notice.`,
    'The approval stands.',
    input.how === 'self' ? 'The run holds the notice until you sign it again.' : 'The run holds the notice until it is signed again.',
    input.how === 'self' ? 'The signing box opens here for you.' : input.how === 'here_or_his_screen' ? `${leader} signs it on his own screen, or here with his code or his hand.` : `${leader} signs it on his own screen.`,
    'The notice keeps a line saying who cleared it and when.',
  ]
  return { title: `Sign the notice again for ${input.jobWords}?`, message: lines.join(' '), confirmLabel: LIEN_SIGN_AGAIN_CONFIRM_LABEL }
}

/** The words after the clear. */
export function signAgainDoneWords(input: { how: LienSignAgainHow; leaderName: string | null }): string {
  if (input.how === 'self') return 'Cleared. The signing box is open. Sign the notice again.'
  return `Cleared. The notice waits for ${first(input.leaderName) || 'the leader'} to sign it again.`
}

/** The words when the row moved on before the press landed: nothing was written. */
export const LIEN_SIGN_AGAIN_GONE = 'Nothing was cleared. The notice changed since this screen read it. It may have printed, or its signature is already off.'

function modeWords(mode: LienSignatureMode | null): string {
  return mode === 'draw' ? 'a drawn signature' : mode === 'pen' ? 'a pen signature' : mode === 'code' ? 'a signature by code' : 'a signature'
}

/** The line under the paper while the notice waits to be signed again: "Signature cleared Nov 16 by Dana. It was a drawn signature by Avery Stone from Nov 16." */
export function signatureClearedWords(c: LienSignatureCleared | null): string | null {
  if (!c) return null
  const was = c.signedAt ? ` It was ${modeWords(c.mode)}${c.signerName ? ` by ${c.signerName}` : ''} from ${shortDay(c.signedAt)}.` : ''
  return `Signature cleared ${shortDay(c.at)}${c.byName ? ` by ${c.byName}` : ''}.${was}`
}
