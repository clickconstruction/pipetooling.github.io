import { useCallback, useMemo, useRef, useState } from 'react'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import { LienWaiverSignAgree, LienWaiverSignOnPage } from './LienWaiverSignOnPage'
import { lienWaiverSignPayload, type LienWaiverSignOnPageHandle } from '../../lib/jobs/lienWaiverSignPayload'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  buildLienWaiverFoot,
  lienWaiverDate,
  buildLienWaiverParagraphs,
  lienWaiverTitle,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { signLienRelease } from '../../lib/jobs/lienReleaseSignIo'
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
 *
 * v2.4335: he signs on the page itself — the pad is the signature line at the foot of the page
 * (`LienWaiverSignOnPage`), his printed name under it as text, the agreement and the button below.
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

  // v2.4335: the name under the line is the signer of record — the present leader, else the
  // document's Signed by line — shown as text, not a box. Reset once per release.
  if (open && release && fields && seededFor !== release.id) {
    setSeededFor(release.id)
    setPrintedName(presentSigner?.name.trim() || fields.signerName.trim())
    setAgreed(false)
    setFormError(null)
  }
  const padRef = useRef<LienWaiverSignOnPageHandle>(null)
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
  const foot = buildLienWaiverFoot({ ...fields, signerName: printedName || presentSigner?.name.trim() || fields.signerName }, null)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign release of lien"
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => {
        // The pad is drawn inside the Release of Lien window's backdrop: a click outside the pad
        // closes the pad only, not the window behind it (v2.4338).
        e.stopPropagation()
        if (!submitting) onClose()
      }}
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
              ? `Read it, then draw the signature on the line at the foot of the page. The record: drawn by ${presentSigner.name}${deviceUserName ? `, on ${deviceUserName}’s screen` : ''}.`
              : 'Read it, then sign on the line at the foot of the page. The signature prints there on every copy.'}
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
            <LienWaiverSignOnPage ref={padRef} foot={foot} signedLabel={`Signed ${lienWaiverDate(todayYmdInAppTz())}`} allowTyped={!present} disabled={submitting} />
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <LienWaiverSignAgree
            disclosure={
              present
                ? `By signing, ${presentSigner.name} acknowledges having read this release of lien and agrees to issue it. Drawing the signature here has the same force and effect as a written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.`
                : 'By signing, you acknowledge that you have read this release of lien and agree to issue it. Drawing or typing your signature here has the same force and effect as your written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.'
            }
            agreeLabel={present ? `I, ${presentSigner.name}, have read this release and my drawn signature is as binding as ink.` : 'I have read this release and agree that my electronic signature is as binding as ink.'}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              setFormError(null)
            }}
            error={formError}
            submitting={submitting}
            submitLabel={present ? 'Sign it' : 'Sign release'}
            onSubmit={() => {
              const r = lienWaiverSignPayload(padRef.current, printedName, agreed)
              if ('error' in r) {
                setFormError(r.error)
                return
              }
              void sign(r.payload)
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
