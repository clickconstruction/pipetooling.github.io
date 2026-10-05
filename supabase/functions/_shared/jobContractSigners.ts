/**
 * A second signer on a job contract (v2.4184, the Contract window PR 4): one agreement, two
 * frames. The first frame keeps the row's signer_* columns; the second has co_signer_*. Either
 * may sign first; the row reads signed only when every frame is filled. Pure: the chips, the
 * pill, the window, the paper and the customer's page all read the frames from here, and every
 * line that names who signed reads `signerNamesLine` (v2.4590).
 *
 * TWINS, byte-identical: `src/lib/jobs/jobContractSigners.ts` (the app) and
 * `supabase/functions/_shared/jobContractSigners.ts` (the customer portal, the signed copy's
 * email). `src/lib/jobs/jobContractSigners.sharedParity.test.ts` fails when they differ; edit
 * one, copy it over the other. No imports, so Deno and Vite read the same file.
 */

export type SignerFrameKey = 'primary' | 'co'

export type SignerFramesRow = {
  recipient_name?: string | null
  signer_printed_name?: string | null
  signer_mode?: string | null
  signer_consented_at?: string | null
  signed_at?: string | null
  co_signer_name?: string | null
  co_signer_email?: string | null
  co_signed_at?: string | null
  co_signer_printed_name?: string | null
  co_signer_mode?: string | null
  co_signer_consented_at?: string | null
}

export type SignerFrame = {
  key: SignerFrameKey
  /** Who the office expects in this frame (the recipient, or the named second signer). */
  expectedName: string
  /** Filled: the frame has a signature. */
  signedAt: string | null
  printedName: string | null
  mode: string | null
  consentedAt: string | null
}

/** The frames a row carries: one, or two when the office named a second signer. */
export function signerFrames(row: SignerFramesRow): SignerFrame[] {
  const primary: SignerFrame = {
    key: 'primary',
    expectedName: (row.recipient_name ?? '').trim(),
    // The first frame's own stamp is its consent time; signed_at is the agreement's (both frames).
    signedAt: row.signer_printed_name && row.signer_consented_at ? row.signer_consented_at : row.signed_at ?? null,
    printedName: row.signer_printed_name ?? null,
    mode: row.signer_mode ?? null,
    consentedAt: row.signer_consented_at ?? null,
  }
  const coName = (row.co_signer_name ?? '').trim()
  if (!coName) return [primary]
  return [
    primary,
    {
      key: 'co',
      expectedName: coName,
      signedAt: row.co_signed_at ?? null,
      printedName: row.co_signer_printed_name ?? null,
      mode: row.co_signer_mode ?? null,
      consentedAt: row.co_signer_consented_at ?? null,
    },
  ]
}

/** How many frames are filled, of how many; null when the row has one frame (nothing to count). */
export function framesProgress(row: SignerFramesRow): { done: number; of: number; waitingOn: string[] } | null {
  const frames = signerFrames(row)
  if (frames.length < 2) return null
  const filled = frames.filter((f) => Boolean(f.signedAt && f.printedName))
  return { done: filled.length, of: frames.length, waitingOn: frames.filter((f) => !(f.signedAt && f.printedName)).map((f) => f.expectedName || 'the second signer') }
}

/** "1 of 2 signed" for a chip or a pill; '' with one frame. */
export function framesLabel(row: SignerFramesRow): string {
  const p = framesProgress(row)
  return p ? `${p.done} of ${p.of} signed` : ''
}

/** The frames still open on a row out for signature, in the order the page offers them. */
export function openFrames(row: SignerFramesRow): SignerFrame[] {
  return signerFrames(row).filter((f) => !(f.signedAt && f.printedName))
}

function frameFilled(f: SignerFrame): boolean {
  return Boolean(f.signedAt && (f.printedName ?? '').trim())
}

/** The printed names of the frames that are filled, in frame order (v2.4590). */
export function signedNames(row: SignerFramesRow): string[] {
  return signerFrames(row)
    .filter(frameFilled)
    .map((f) => (f.printedName ?? '').trim())
}

/** "Sam Owner", "Sam Owner and Alex Owner"; '' with no names. The one way a line joins signers. */
export function joinSignerNames(names: ReadonlyArray<string | null | undefined>): string {
  const list = names.map((n) => (n ?? '').trim()).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/**
 * Who signed, for the words after "signed by": every filled frame's printed name (v2.4590).
 * A one-frame row reads its printed name as it always did; '' when nobody has signed.
 */
export function signerNamesLine(row: SignerFramesRow): string {
  return joinSignerNames(signedNames(row))
}

/** "Sam Owner signed · waiting on Alex Owner" while a two-frame agreement is part signed; '' otherwise. */
export function framesWaitingLine(row: SignerFramesRow): string {
  const p = framesProgress(row)
  if (!p || p.done === 0 || p.done === p.of) return ''
  return `${signerNamesLine(row)} signed · waiting on ${joinSignerNames(p.waitingOn)}`
}

/** The audit-line shape for one frame (jobContractSignatureAuditLine reads signer_* names). */
export function frameAsSignerRow(f: SignerFrame): { signed_at: string | null; signer_printed_name: string | null; signer_mode: string | null; signer_consented_at: string | null } {
  return { signed_at: f.signedAt, signer_printed_name: f.printedName, signer_mode: f.mode, signer_consented_at: f.consentedAt }
}
