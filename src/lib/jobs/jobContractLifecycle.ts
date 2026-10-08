/**
 * Job-contract lifecycle kernel (Contract Desk PR 2): draft (autosaved,
 * editable) → sent (token minted, fields locked) → signed; voided is terminal
 * and "Void & redo" supersedes with a fresh draft. Pure helpers for the
 * modal, the history rows, and the audit line every signed rendering carries.
 */
import type { Database } from '../../types/database'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { esignAuditSuffix } from '../esignConsent'
import { signedRecordId } from '../signedRecordId'
import type { JobContractRenderInput } from './jobContractDocument'
import { frameAsSignerRow, framesLabel, joinSignerNames, signerFrames, signerNamesLine, type SignerFrame, type SignerFramesRow } from './jobContractSigners'

export type JobContractRow = Database['public']['Tables']['job_contracts']['Row']

export type JobContractStatus = 'draft' | 'sent' | 'signed' | 'voided'

export function jobContractStatus(row: Pick<JobContractRow, 'status' | 'voided_at'>): JobContractStatus {
  if (row.voided_at) return 'voided'
  const s = (row.status ?? '').trim()
  return s === 'sent' || s === 'signed' || s === 'voided' ? s : 'draft'
}

/** Fields stay editable (and autosave keeps writing) only while the row is a draft. */
export function jobContractIsEditable(row: Pick<JobContractRow, 'status' | 'voided_at'> | null): boolean {
  return row == null || jobContractStatus(row) === 'draft'
}

/** Live = the one row the modal works on: a draft or a sent contract that is not voided. */
export function jobContractIsLive(row: Pick<JobContractRow, 'status' | 'voided_at'>): boolean {
  const s = jobContractStatus(row)
  return s === 'draft' || s === 'sent'
}

export type JobContractChip = {
  label: string
  tone: 'draft' | 'sent' | 'signed' | 'voided'
}

export function jobContractChips(
  row: Pick<JobContractRow, 'status' | 'voided_at' | 'signer_mode' | 'send_count' | 'view_count'> & { sent_channel?: string | null } & SignerFramesRow,
): JobContractChip[] {
  const s = jobContractStatus(row)
  if (s === 'voided') return [{ label: 'voided', tone: 'voided' }]
  if (s === 'draft') return [{ label: 'draft', tone: 'draft' }]
  if (s === 'sent') {
    // v2.4186: a two-frame agreement says how many frames are filled.
    const frames = framesLabel(row)
    const framesSuffix = frames ? ` · ${frames}` : ''
    // v2.3629: handed over on paper — there is no link to open, so no sends or opens to count.
    if (row.sent_channel === 'handed') return [{ label: `handed over · awaiting signature${framesSuffix}`, tone: 'sent' }]
    // v2.3631: the PDF went by email to sign by hand — the link is only the second door.
    if (row.sent_channel === 'pdf_email') return [{ label: `PDF emailed${row.send_count > 1 ? ` ×${row.send_count}` : ''} · awaiting signature${framesSuffix}`, tone: 'sent' }]
    const opened = row.view_count > 0 ? ` · opened ${row.view_count}×` : ''
    return [{ label: `sent${row.send_count > 1 ? ` ×${row.send_count}` : ''}${opened}${framesSuffix}`, tone: 'sent' }]
  }
  return [{ label: row.signer_mode === 'paper' ? 'on file · paper' : 'signed ✓', tone: 'signed' }]
}

/** Theme-token chip colors per tone — shared by the modal history and Documents rows. */
export function jobContractChipColors(tone: JobContractChip['tone']): {
  background: string
  color: string
  border?: string
} {
  switch (tone) {
    case 'sent':
      return { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
    case 'signed':
      return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'voided':
      return { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  }
}

/** The customer's page. The token is the credential; the origin is whatever domain the office is on. */
export function jobContractSigningUrl(origin: string, rawToken: string): string {
  return `${origin.replace(/\/$/, '')}/contract/sign?t=${encodeURIComponent(rawToken)}`
}

export function formatContractStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/**
 * A paper filed with its *Signed on* date keeps `signed_at` as that day at noon UTC
 * (`fileSignedJobContract`): a day, not a moment. Read as a time it says 7:00 AM CT, which nobody
 * recorded (v2.4876). Keyed on the stamp's shape, not on `paper_signed_on`: older paper rows carry
 * a `paper_signed_on` beside a real `signed_at`, and those keep their time.
 */
export function isSignedOnDayMarker(iso: string | null | undefined): boolean {
  return /T12:00:00(?:\.0+)?(?:Z|\+00(?::?00)?)$/.test(iso ?? '')
}

/** "Sep 30, 2026": the day of a stamp in the app's zone. */
function formatContractDay(iso: string): string | null {
  const ymd = calendarYmdInAppTzFromIso(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)))
}

/** When it was signed, as a banner reads it: the day alone for a *Signed on* day, else the stamp with its time (v2.4876). */
export function formatContractSignedStamp(iso: string | null | undefined): string | null {
  if (iso && isSignedOnDayMarker(iso)) return formatContractDay(iso)
  return formatContractStamp(iso)
}

/** The one-line electronic-signature audit under every signed rendering. */
export function jobContractSignatureAuditLine(row: {
  signed_at: string | null
  signer_printed_name: string | null
  signer_mode: string | null
  signer_consented_at: string | null
  /** v2.3100: the consent ledger row, when the caller loaded it — adds "consent v1 (en)" after the statutes. */
  esign_consent?: { version: number; lang: string } | null
}): string | null {
  if (!row.signed_at) return null
  const stamp = formatContractStamp(row.signed_at)
  const who = (row.signer_printed_name ?? '').trim()
  if (row.signer_mode === 'paper') {
    // v2.4876: a *Signed on* day is the day they signed; a real stamp is when the office recorded it.
    if (isSignedOnDayMarker(row.signed_at)) {
      const day = formatContractDay(row.signed_at)
      return `Signed on paper${who ? ` by ${who}` : ''}${day ? ` on ${day}` : ''}`
    }
    return `Signed on paper${who ? ` by ${who}` : ''}${stamp ? ` · recorded ${stamp} CT` : ''}`
  }
  return `Signed electronically${who ? ` by ${who}` : ''} (${signedHowWord(row.signer_mode)})${stamp ? ` · ${stamp} CT` : ''}${
    row.signer_consented_at ? ` · consent recorded${esignAuditSuffix(row.esign_consent ?? null)}` : ''
  }`
}

function signedHowWord(mode: string | null | undefined): string {
  return mode === 'draw' ? 'drawn' : mode === 'in_person' ? 'in person' : 'typed'
}

/**
 * The names a paper record's *Signed on paper* line carries (v2.4657): every filled frame filed
 * from the paper. That is the first frame, and the second when it was filed with it. A second
 * frame signed through the link before the paper came back keeps its own mark.
 */
function paperSignerNames(row: SignerFramesRow): string {
  return joinSignerNames(
    signerFrames(row)
      .filter((f) => f.mode === 'paper' && f.signedAt && (f.printedName ?? '').trim())
      .map((f) => f.printedName),
  )
}

/**
 * The agreement's audit line in a list — the window's History, Documents, the Job window's
 * Documents tab (v2.4590): every signer named. One frame reads `jobContractSignatureAuditLine`
 * unchanged (that one stays the line under ONE signature block); two frames name both and each
 * way they signed: *(typed and drawn)*. A paper record names the frames filed from the paper
 * (v2.4657): *Signed on paper by Sam Owner and Alex Owner*.
 */
export function jobContractSignersAuditLine(row: Parameters<typeof jobContractSignatureAuditLine>[0] & SignerFramesRow): string | null {
  const frames = signerFrames(row)
  if (row.signer_mode === 'paper') return jobContractSignatureAuditLine({ ...row, signer_printed_name: paperSignerNames(row) || row.signer_printed_name })
  if (frames.length < 2) return jobContractSignatureAuditLine(row)
  if (!row.signed_at) return null
  const filled = frames.filter((f) => f.signedAt && (f.printedName ?? '').trim())
  const who = signerNamesLine(row)
  const hows = [...new Set(filled.map((f) => signedHowWord(f.mode)))]
  const stamp = formatContractStamp(row.signed_at)
  const consented = filled.length > 0 && filled.every((f) => f.consentedAt)
  return `Signed electronically${who ? ` by ${who}` : ''} (${hows.join(' and ') || 'typed'})${stamp ? ` · ${stamp} CT` : ''}${
    consented ? ` · consent recorded${esignAuditSuffix(row.esign_consent ?? null)}` : ''
  }`
}

type SignatureBlock = NonNullable<JobContractRenderInput['signature']>

/**
 * The signature blocks a printed agreement draws (v2.4590), read by every print path (the record's
 * Print, Open full size, a sent row opened from Documents): the first frame, and a second when the
 * office named a second signer — each signed with its own stamp, or left open for a pen. One frame
 * reads exactly as before. A paper record draws one *Signed on paper* block: the signatures are on
 * the scan. Its name and line carry every frame filed from the paper (v2.4657), and a second frame
 * signed through the link before the paper came back draws its own block. `record` adds the record
 * id and the stamp beside the name (the record's print).
 */
export function jobContractSignatureBlocks(
  row: Pick<JobContractRow, 'id' | 'signed_at' | 'signer_printed_name' | 'signer_mode' | 'signer_consented_at'> & SignerFramesRow,
  opts: { signatureUrl?: string | null; coSignatureUrl?: string | null; record?: { jobNumber: string } | null } = {},
): { signature: SignatureBlock | null; coSignerName: string | null; coSignature: SignatureBlock | null } {
  const paper = row.signer_mode === 'paper'
  const stamps = (at: string | null): Pick<SignatureBlock, 'recordId' | 'whenLabel'> => {
    if (!opts.record) return {}
    // v2.4876: a *Signed on* day prints as the day; only a real stamp carries a time.
    const day = isSignedOnDayMarker(at)
    const when = formatContractSignedStamp(at)
    return { recordId: signedRecordId('J', opts.record.jobNumber || '0', row.id), whenLabel: when ? (day ? when : `${when} CT`) : null }
  }
  const frames = signerFrames(row)
  const block = (f: SignerFrame, imageUrl: string | null): SignatureBlock | null =>
    f.signedAt && (f.printedName ?? '').trim()
      ? { printedName: (f.printedName ?? '').trim(), auditLine: jobContractSignatureAuditLine(frameAsSignerRow(f)) ?? '', imageUrl, ...stamps(f.signedAt), paper: false }
      : null
  if (frames.length < 2 || paper) {
    // A second frame signed through the link before the paper came back is its own signature (v2.4657).
    const linkSigned = paper ? frames.find((f) => f.key === 'co' && f.mode !== 'paper') : undefined
    const coSignature = linkSigned ? block(linkSigned, opts.coSignatureUrl ?? null) : null
    return {
      signature: row.signed_at
        ? {
            printedName: (paper ? paperSignerNames(row) : '') || (row.signer_printed_name ?? ''),
            auditLine: (paper ? jobContractSignersAuditLine(row) : jobContractSignatureAuditLine(row)) ?? '',
            imageUrl: opts.signatureUrl ?? null,
            ...stamps(row.signed_at),
            paper,
          }
        : null,
      coSignerName: coSignature ? linkSigned!.expectedName : null,
      coSignature,
    }
  }
  const [primary, co] = frames as [SignerFrame, SignerFrame]
  return { signature: block(primary, opts.signatureUrl ?? null), coSignerName: co.expectedName, coSignature: block(co, opts.coSignatureUrl ?? null) }
}
