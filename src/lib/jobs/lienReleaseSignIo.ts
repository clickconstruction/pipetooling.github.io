import type { EstimateAcceptSubmitPayload } from '../../components/estimates/EstimateAcceptBody'
import { buildLienWaiverPdfBlob, type LienWaiverFields, type LienWaiverFormType, type LienWaiverSignature } from '../jobsDocuments/lienWaiverRelease'
import { lienReleaseSignatureAuditLine } from './lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import { validateReportSignatureDataUrlForSubmit } from '../reportSignatureField'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

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
  if (payload.mode === 'draw') {
    const invalid = validateReportSignatureDataUrlForSubmit(payload.signaturePngBase64)
    if (invalid) return { ok: false, message: invalid }
    try {
      const path = `${releaseId}/${crypto.randomUUID()}.png`
      const bytes = await (await fetch(payload.signaturePngBase64)).blob()
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
    pngDataUrl: payload.mode === 'draw' ? payload.signaturePngBase64 : null,
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
