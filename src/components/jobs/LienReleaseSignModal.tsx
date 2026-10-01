import { useCallback, useMemo, useState } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import {
  buildLienWaiverFoot,
  buildLienWaiverParagraphs,
  lienWaiverTitle,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { signLienRelease } from '../../lib/jobs/lienReleaseSignIo'
import { LienWaiverFootPreview } from './LienWaiverFootPreview'
import {
  isLienWaiverFormType,
  lienReleaseFieldsFromSnapshot,
  type JobLienReleaseRow,
} from '../../lib/jobs/lienReleaseTracking'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

/**
 * In-app signing for a lien release awaiting signature (v2.2619): the full
 * document above the shared Type/Draw signature form (the estimates/contracts
 * pad). Signing uploads the drawn PNG + the signed PDF to the private
 * lien-release-documents bucket (best-effort), then stamps the row — the row
 * stamp is the signature of record; stored bytes are the audit copy.
 *
 * "He signs now" (v2.4274): with `presentSigner`, the leader signs on this
 * screen — the assistant's, or a phone handed to him. The signer of record is
 * the leader; `signed_on_device_of` names whose session it was, and the audit
 * line says so. Drawn, not typed: a typed name would be the assistant's keys.
 */
export default function LienReleaseSignModal({
  open,
  onClose,
  release,
  jobNumber,
  onSigned,
  presentSigner = null,
  deviceUserName = null,
}: {
  open: boolean
  onClose: () => void
  release: JobLienReleaseRow | null
  jobNumber: string
  onSigned?: () => void
  /** The leader standing here, signing on this session's screen. Null: the signed-in user signs for themselves. */
  presentSigner?: { id: string; name: string } | null
  /** The signed-in user's name, for the audit line when a present leader signs. */
  deviceUserName?: string | null
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

  // Seed the printed name from the document's "Signed by" line — or the present leader's name — once per release.
  if (open && release && fields && seededFor !== release.id) {
    setSeededFor(release.id)
    setPrintedName(presentSigner?.name.trim() || fields.signerName)
    setAgreed(false)
    setFormError(null)
  }
  const present = presentSigner != null && presentSigner.id !== authUser?.id

  const sign = useCallback(
    async (payload: EstimateAcceptSubmitPayload) => {
      if (!release || !fields || submitting) return
      setSubmitting(true)
      setFormError(null)
      try {
        const r = await signLienRelease({
          releaseId: release.id,
          formType,
          fields,
          payload,
          signer: { userId: present ? presentSigner.id : (authUser?.id ?? null) },
          onDevice: present ? { userId: authUser?.id ?? null, name: deviceUserName } : null,
        })
        if (!r.ok) {
          setFormError(r.message)
          return
        }
        showToast('Release signed.', 'success')
        onSigned?.()
        onClose()
      } finally {
        setSubmitting(false)
      }
    },
    [release, fields, submitting, formType, authUser?.id, present, presentSigner, deviceUserName, showToast, onSigned, onClose],
  )

  if (!open || !release || !fields) return null
  const paragraphs = buildLienWaiverParagraphs(formType, fields)
  const foot = buildLienWaiverFoot({ ...fields, signerName: presentSigner?.name.trim() || fields.signerName }, null)

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
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            {present ? `${presentSigner.name} signs here — Job ${jobNumber}` : `Sign release of lien — Job ${jobNumber}`}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {present
              ? `Read it, then draw the signature below. The record: drawn by ${presentSigner.name}${deviceUserName ? `, on ${deviceUserName}’s screen` : ''}.`
              : 'Read it, then sign below. The signature prints on every copy of this document.'}
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
            <LienWaiverFootPreview foot={foot} />
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
            heading={present ? `${presentSigner.name} signs` : 'Sign release'}
            disclosure={
              present
                ? `By signing, ${presentSigner.name} acknowledges having read this release of lien and agrees to issue it. Drawing the signature here has the same force and effect as a written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.`
                : 'By signing, you acknowledge that you have read this release of lien and agree to issue it. Typing or drawing your signature here has the same force and effect as your written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.'
            }
            agreeLabel={present ? `I, ${presentSigner.name}, have read this release and my drawn signature is as binding as ink.` : 'I have read this release and agree that my electronic signature is as binding as ink.'}
            submitLabel={present ? 'Sign it' : 'Sign release'}
            lockMode={present ? 'draw' : undefined}
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
