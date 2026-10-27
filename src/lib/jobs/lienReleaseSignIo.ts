import type { EstimateAcceptSubmitPayload } from '../../components/estimates/EstimateAcceptBody'
import { buildLienWaiverPdfBlob, type LienWaiverFields, type LienWaiverFormType, type LienWaiverSignature } from '../jobsDocuments/lienWaiverRelease'
import { lienReleaseSignatureAuditLine } from './lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import { validateReportSignatureDataUrlForSubmit } from '../reportSignatureField'
import { supabase } from '../supabase'
import { isMissingRpcError } from '../customers/customersListBundle'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { trimSignatureInk } from '../signatureInkTrim'

/**
 * Signing a lien release, the one write shared by the sign modal and the leader's Waivers to sign
 * seat (v2.4276; the loop itself is v2.2619). Order: the drawn PNG is uploaded best-effort, the row
 * is stamped `signed` (the legal record), then the signed PDF is stored best-effort — every
 * rendering regenerates from the row's snapshot when the bytes are missing.
 *
 * `signer` is who signs — the signed-in user, or the leader present at someone else's screen
 * (`onDevice`: the signed-in user, named on the audit line). A present leader draws; a typed name
 * is refused here so no caller can slip one through.
 */
export type SignLienReleaseArgs = {
  releaseId: string
  formType: LienWaiverFormType
  fields: LienWaiverFields
  payload: EstimateAcceptSubmitPayload
  signer: { userId: string | null }
  /** The signed-in user when the signer is someone else at this screen; null when the signer signs for themselves. */
  onDevice: { userId: string | null; name: string | null } | null
}

export type SignLienReleaseResult = { ok: true; signedAtIso: string } | { ok: false; message: string }

export async function signLienRelease(args: SignLienReleaseArgs): Promise<SignLienReleaseResult> {
  const { releaseId, formType, fields, payload, signer, onDevice } = args
  const present = onDevice != null
  if (present && payload.mode !== 'draw') {
    return { ok: false, message: 'Draw the signature. A typed name would be this screen’s keyboard, not the leader’s hand.' }
  }
  let signaturePath: string | null = null
  const signedAtIso = new Date().toISOString()
  // v2.4335: the drawing is trimmed to its ink before it is stored, so the signed PDF and every
  // later copy print it the same size, on the line (the whole pad box used to print).
  let ink: string | null = null
  if (payload.mode === 'draw') {
    const invalid = validateReportSignatureDataUrlForSubmit(payload.signaturePngBase64)
    if (invalid) return { ok: false, message: invalid }
    ink = await trimSignatureInk(payload.signaturePngBase64)
    try {
      const path = `${releaseId}/${crypto.randomUUID()}.png`
      const bytes = await (await fetch(ink)).blob()
      const { error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(path, bytes, { contentType: 'image/png' })
      if (!error) signaturePath = path
    } catch {
      /* the row stamp below is the signature of record */
    }
  }
  const audit = lienReleaseSignatureAuditLine(
    { signed_at: signedAtIso, signer_consented_at: signedAtIso, signer_printed_name: payload.printedName, signer_signature_mode: payload.mode },
    present ? onDevice.name : null,
  )
  const signature: LienWaiverSignature = {
    mode: payload.mode,
    printedName: payload.printedName,
    pngDataUrl: payload.mode === 'draw' ? ink : null,
    auditLine: audit ?? '',
    signedYmd: calendarYmdInAppTzFromIso(signedAtIso),
  }
  try {
    await withSupabaseRetry(
      () =>
        supabase
          .from('job_lien_releases')
          .update({
            status: 'signed',
            signed_at: signedAtIso,
            signer_printed_name: payload.printedName,
            signer_signature_mode: payload.mode,
            signer_signature_storage_path: signaturePath,
            signer_consented_at: signedAtIso,
            signer_user_id: signer.userId,
            signed_on_device_of: present ? onDevice.userId : null,
          })
          .eq('id', releaseId)
          .eq('status', 'awaiting_signature'),
      'sign lien release',
    )
  } catch {
    return { ok: false, message: 'Could not record the signature — nothing was saved. Try again.' }
  }
  try {
    const pdf = await buildLienWaiverPdfBlob(formType, fields, signature)
    const { error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(`${releaseId}/signed.pdf`, pdf, { contentType: 'application/pdf', upsert: true })
    if (!error) await supabase.from('job_lien_releases').update({ signed_pdf_path: `${releaseId}/signed.pdf` }).eq('id', releaseId)
  } catch {
    /* regenerable from the snapshot + row stamp */
  }
  return { ok: true, signedAtIso }
}

// ---------- his code on a waiver (v2.5924) ----------

export type SignLienReleaseWithCodeArgs = {
  releaseId: string
  formType: LienWaiverFormType
  fields: LienWaiverFields
  /** The leader whose code it is — the signer of record. */
  signerUserId: string
  code: string
  /** The signed-in user's name, for the audit line on the stored PDF ("on Wendi’s screen"). */
  deviceUserName: string | null
}

export type SignLienReleaseWithCodeResult =
  | { ok: true; signedAtIso: string; printedName: string }
  | { ok: false; reason: 'format' | 'none' | 'wrong' | 'locked' | 'not_live' | 'error'; message: string; triesLeft: number | null; lockedUntilIso: string | null }

/**
 * The waiver twin of the desk's signLienDeskItemWithCode (v2.5791 → v2.5924): the code is checked
 * in the database by sign_lien_release_with_code, which stamps the row signed in mode 'code'. On
 * ok this tells the signer his code was used (best effort) and stores the signed PDF the way the
 * pad's path does — the row stamp is the signature of record either way.
 */
export async function signLienReleaseWithCode(args: SignLienReleaseWithCodeArgs): Promise<SignLienReleaseWithCodeResult> {
  const { data, error } = await supabase.rpc('sign_lien_release_with_code' as never, { p_release_id: args.releaseId, p_signer_id: args.signerUserId, p_code: args.code } as never)
  if (error) {
    if (isMissingRpcError(error.message)) {
      return { ok: false, reason: 'not_live', message: 'Signing by code is not switched on here yet — the database side ships with the next migration push.', triesLeft: null, lockedUntilIso: null }
    }
    return { ok: false, reason: 'error', message: error.message, triesLeft: null, lockedUntilIso: null }
  }
  const d = (data ?? {}) as { ok?: boolean; signed_at?: string; printed_name?: string; reason?: string; message?: string; tries_left?: number; locked_until?: string | null }
  if (!d.ok) {
    const reason = d.reason === 'format' || d.reason === 'none' || d.reason === 'wrong' || d.reason === 'locked' ? d.reason : 'error'
    return { ok: false, reason, message: d.message ?? 'The code did not sign it.', triesLeft: typeof d.tries_left === 'number' ? d.tries_left : null, lockedUntilIso: d.locked_until ?? null }
  }
  const signedAtIso = d.signed_at ?? new Date().toISOString()
  const printedName = d.printed_name ?? ''
  // Tell him his code was used (v2.5924): one line on his phone, or the same words by email; the
  // function says nothing when it was his own screen. Best effort; the record stands either way.
  try {
    await supabase.functions.invoke('notify-lien-approval', { body: { release_id: args.releaseId, kind: 'waiver_code_used' } })
  } catch {
    /* the window's history chip names the code signature too */
  }
  // The signed PDF, best-effort — regenerable from the row's snapshot when the bytes are missing.
  try {
    const audit = lienReleaseSignatureAuditLine(
      { signed_at: signedAtIso, signer_consented_at: signedAtIso, signer_printed_name: printedName, signer_signature_mode: 'code' },
      args.deviceUserName,
    )
    const signature: LienWaiverSignature = { mode: 'code', printedName, pngDataUrl: null, auditLine: audit ?? '', signedYmd: calendarYmdInAppTzFromIso(signedAtIso) }
    const pdf = await buildLienWaiverPdfBlob(args.formType, args.fields, signature)
    const { error: upErr } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(`${args.releaseId}/signed.pdf`, pdf, { contentType: 'application/pdf', upsert: true })
    if (!upErr) await supabase.from('job_lien_releases').update({ signed_pdf_path: `${args.releaseId}/signed.pdf` }).eq('id', args.releaseId)
  } catch {
    /* regenerable from the snapshot + row stamp */
  }
  return { ok: true, signedAtIso, printedName }
}

/**
 * Who a job's waiver goes to (v2.4276): the GC's billing email on a sub job, else the job's
 * customer email; null when neither is on file. Read here so the leader's seat and the window
 * name the same address the send function will accept.
 */
export async function resolveLienWaiverRecipient(jobId: string): Promise<{ email: string; name: string } | null> {
  try {
    const { data: job } = await supabase.from('jobs_ledger').select('customer_email, customer_name, gc_customer_id').eq('id', jobId).maybeSingle()
    const j = job as { customer_email: string | null; customer_name: string | null; gc_customer_id: string | null } | null
    if (!j) return null
    if (j.gc_customer_id) {
      const { data: gc } = await supabase.from('customers').select('name, billing_email').eq('id', j.gc_customer_id).maybeSingle()
      const g = gc as { name: string | null; billing_email: string | null } | null
      const email = (g?.billing_email ?? '').trim()
      if (email) return { email, name: (g?.name ?? '').trim() || 'the GC' }
    }
    const email = (j.customer_email ?? '').trim()
    return email ? { email, name: (j.customer_name ?? '').trim() || 'the customer' } : null
  } catch {
    return null
  }
}
