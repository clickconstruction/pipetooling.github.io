import { useCallback, useMemo, useState } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import {
  buildLienWaiverParagraphs,
  buildLienWaiverPdfBlob,
  buildLienWaiverSignatureLines,
  lienWaiverTitle,
  type LienWaiverFields,
  type LienWaiverFormType,
  type LienWaiverSignature,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import {
  isLienWaiverFormType,
  lienReleaseFieldsFromSnapshot,
  type JobLienReleaseRow,
} from '../../lib/jobs/lienReleaseTracking'
import { lienReleaseSignatureAuditLine } from '../../lib/jobs/lienReleaseLifecycle'
import { validateReportSignatureDataUrlForSubmit } from '../../lib/reportSignatureField'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from '../../lib/jobs/lienReleaseDocuments'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

/**
 * In-app signing for a lien release awaiting signature (v2.2619): the full
 * document above the shared Type/Draw signature form (the estimates/contracts
 * pad). Signing uploads the drawn PNG + the signed PDF to the private
 * lien-release-documents bucket (best-effort), then stamps the row — the row
 * stamp is the signature of record; stored bytes are the audit copy.
 */
export default function LienReleaseSignModal({
  open,
  onClose,
  release,
  jobNumber,
  onSigned,
}: {
  open: boolean
  onClose: () => void
  release: JobLienReleaseRow | null
  jobNumber: string
  onSigned?: () => void
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(null)

  const formType: LienWaiverFormType = useMemo(
    () => (release && isLienWaiverFormType(release.form_type) ? release.form_type : 'conditional_progress'),
    [release],
  )
  const fields: LienWaiverFields | null = useMemo(() => {
    if (!release) return null
    const s = lienReleaseFieldsFromSnapshot(release.fields)
    return {
      companyName: s.companyName ?? '',
      checkFrom: s.checkFrom ?? '',
      amount: s.amount ?? String(release.amount ?? ''),
      projectDescription: s.projectDescription ?? '',
      throughDate: s.throughDate ?? release.through_date ?? '',
      signedDate: s.signedDate ?? release.signed_date ?? '',
      signerName: s.signerName ?? '',
      signerTitle: s.signerTitle ?? '',
    }
  }, [release])

  // Seed the printed name from the document's "Signed by" line, once per release.
  if (open && release && fields && seededFor !== release.id) {
    setSeededFor(release.id)
    setPrintedName(fields.signerName)
    setAgreed(false)
    setFormError(null)
  }

  const sign = useCallback(
    async (payload: EstimateAcceptSubmitPayload) => {
      if (!release || !fields || submitting) return
      setSubmitting(true)
      setFormError(null)
      try {
        let signaturePath: string | null = null
        const signedAtIso = new Date().toISOString()
        if (payload.mode === 'draw') {
          const invalid = validateReportSignatureDataUrlForSubmit(payload.signaturePngBase64)
          if (invalid) {
            setFormError(invalid)
            return
          }
          // Best-effort upload — the row stamp below is the signature of record.
          try {
            const path = `${release.id}/${crypto.randomUUID()}.png`
            const bytes = await (await fetch(payload.signaturePngBase64)).blob()
            const { error } = await supabase.storage
              .from(LIEN_RELEASE_DOCUMENTS_BUCKET)
              .upload(path, bytes, { contentType: 'image/png' })
            if (!error) signaturePath = path
          } catch {
            /* bucket may not exist yet — row stamp still records the signature */
          }
        }

        const audit = lienReleaseSignatureAuditLine({ signed_at: signedAtIso, signer_consented_at: signedAtIso })
        const signature: LienWaiverSignature = {
          mode: payload.mode,
          printedName: payload.printedName,
          pngDataUrl: payload.mode === 'draw' ? payload.signaturePngBase64 : null,
          auditLine: audit ?? '',
        }

        // Stamp the row FIRST — this is the legal record; the stored PDF is the audit copy.
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
                signer_user_id: authUser?.id ?? null,
              })
              .eq('id', release.id)
              .eq('status', 'awaiting_signature'),
          'sign lien release',
        )

        try {
          const pdf = await buildLienWaiverPdfBlob(formType, fields, signature)
          const { error } = await supabase.storage
            .from(LIEN_RELEASE_DOCUMENTS_BUCKET)
            .upload(`${release.id}/signed.pdf`, pdf, { contentType: 'application/pdf', upsert: true })
          if (!error) {
            await supabase.from('job_lien_releases').update({ signed_pdf_path: `${release.id}/signed.pdf` }).eq('id', release.id)
          }
        } catch {
          /* regenerable from the snapshot + row stamp */
        }

        showToast('Release signed.', 'success')
        onSigned?.()
        onClose()
      } catch {
        setFormError('Could not record the signature — nothing was saved. Try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [release, fields, submitting, formType, authUser?.id, showToast, onSigned, onClose],
  )

  if (!open || !release || !fields) return null
  const paragraphs = buildLienWaiverParagraphs(formType, fields)
  const signatureLines = buildLienWaiverSignatureLines(fields)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign release of lien"
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={() => !submitting && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Sign release of lien — Job {jobNumber}</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Read it, then sign below. The signature prints on every copy of this document.
          </p>
        </div>
        <div data-theme="light" style={{ padding: '1rem 1.25rem', background: 'var(--bg-subtle)' }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.1rem 1.25rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.8125rem', lineHeight: 1.7 }}>
            <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>
              {lienWaiverTitle(formType)}
            </p>
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: '0 0 0.7em' }}>
                {p}
              </p>
            ))}
            {signatureLines.map((l) => (
              <p key={l.label} style={{ margin: '1.1em 0 0' }}>
                {l.label}: {l.value ? <strong>{l.value}</strong> : '______________________'}
              </p>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          <ContractAcceptSignatureForm
            printedName={printedName}
            agreed={agreed}
            onPrintedNameChange={setPrintedName}
            onAgreedChange={setAgreed}
            formError={formError}
            submitting={submitting}
            onSubmit={(payload) => void sign(payload)}
            heading="Sign release"
            disclosure="By signing, you acknowledge that you have read this release of lien and agree to issue it. Typing or drawing your signature here has the same force and effect as your written signature, and it prints on every copy of this document."
            agreeLabel="I have read this release and agree that my electronic signature is as binding as ink."
            submitLabel="Sign release"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={{ display: 'block', margin: '0.75rem auto 0', padding: '0.4rem 1rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
