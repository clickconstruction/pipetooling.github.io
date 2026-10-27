import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { signLienRelease, signLienReleaseWithCode } from '../../lib/jobs/lienReleaseSignIo'
import { lienSignCodeProblem, lienSignCodeStatus, type LienSignCodeStatus } from '../../lib/jobs/lienDeskSignIo'
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from '../estimates/EstimateAcceptTypedSignatureLine'
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
 *
 * v2.5958: `codeOnly` is the Bids → Lien Release tab's door — the present leader's code is the one way
 * to sign there (no pad, no Draw instead), and `docLabel` names the bid in the title.
 */
export default function LienReleaseSignModal({
  open,
  onClose,
  release,
  jobNumber,
  onSigned,
  presentSigner = null,
  deviceUserName = null,
  codeOnly = false,
  docLabel,
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
  /** v2.5958: the present leader signs with his code only — the Bids tab's door, where a drawn signature has no row to land on. */
  codeOnly?: boolean
  /** What the title names after the dash; `Job <number>` by default ("Bid B482" on the Bids tab). */
  docLabel?: string
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

  // His signing code (v2.5788 → v2.5924): on another's screen the leader may type his code in place
  // of drawing. The status arriving later moves an untouched pad to the code once, as the desk does.
  const [codeStatus, setCodeStatus] = useState<LienSignCodeStatus | null>(null)
  const [signMode, setSignMode] = useState<'draw' | 'code'>('draw')
  const [modeTouched, setModeTouched] = useState(false)
  const [codeValue, setCodeValue] = useState('')
  useEffect(() => {
    if (!open || !present) return
    let cancelled = false
    lienSignCodeStatus(presentSigner.id)
      .then((s) => {
        if (cancelled) return
        setCodeStatus(s)
      })
      .catch(() => {
        // An unread status leaves the pad leading; the code is offered only once its status is known.
      })
    return () => {
      cancelled = true
    }
  }, [open, present, presentSigner?.id, presentSigner])
  const codeReady = present && codeStatus?.set === true && (codeStatus.lockedUntilIso == null || new Date(codeStatus.lockedUntilIso).getTime() <= Date.now())
  useEffect(() => {
    if (codeReady && !modeTouched && padRef.current?.isEmpty?.() !== false) setSignMode('code')
  }, [codeReady, modeTouched])
  const codeMode = present && (codeOnly || (codeReady && signMode === 'code'))
  // The code door's own answer when his code cannot sign right now (v2.5958): not set, or locked a while.
  const codeOnlyNote =
    codeOnly && present && codeStatus
      ? !codeStatus.set
        ? `${presentSigner.name} has not set a signing code yet. He sets it under Settings, Your account.`
        : codeStatus.lockedUntilIso && new Date(codeStatus.lockedUntilIso).getTime() > Date.now()
          ? `${presentSigner.name}’s code is locked for a few minutes after five wrong tries.`
          : null
      : null
  const signerFirstName = (presentSigner?.name ?? '').trim().split(/\s+/)[0] || 'He'

  const signWithCode = useCallback(async () => {
    if (!release || !fields || submitting || !presentSigner) return
    if (codeOnly && codeStatus?.set === false) {
      setFormError(`${presentSigner.name} has not set a signing code yet. He sets it under Settings, Your account.`)
      return
    }
    const bad = lienSignCodeProblem(codeValue)
    if (bad) {
      setFormError(bad)
      return
    }
    if (!agreed) {
      setFormError('Tick the box above the button first.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const r = await signLienReleaseWithCode({
        releaseId: release.id,
        formType,
        fields,
        signerUserId: presentSigner.id,
        code: codeValue,
        deviceUserName: deviceUserName,
      })
      if (!r.ok) {
        const tries = r.reason === 'wrong' && r.triesLeft != null && r.triesLeft > 0 ? ` ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.` : ''
        setFormError(`${r.message}${tries}`)
        if (r.reason === 'locked' || r.reason === 'none') setCodeStatus(await lienSignCodeStatus(presentSigner.id).catch(() => null))
        return
      }
      showToast('Release signed.', 'success')
      onSigned?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }, [release, fields, submitting, presentSigner, codeOnly, codeStatus, codeValue, agreed, formType, deviceUserName, showToast, onSigned, onClose])

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
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
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
            {present ? `${presentSigner.name} signs here — ${docLabel ?? `Job ${jobNumber}`}` : `Sign release of lien — ${docLabel ?? `Job ${jobNumber}`}`}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {codeMode
              ? `He reads it, then types his signing code under the page. The record: typed by ${presentSigner?.name}${deviceUserName ? `, on ${deviceUserName}’s screen` : ''}, confirmed by his code.`
              : present
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
            {codeMode ? (
              // His name waits in the cursive face over the rule; the code under the page puts it there (v2.5924).
              <div data-testid="lien-release-code-foot" style={{ marginTop: '2.4em', maxWidth: 420 }}>
                <div style={{ fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT, fontSize: '2.1em', lineHeight: 1.15, color: 'var(--text-base)' }}>{foot.name}</div>
                <div style={{ borderTop: '1px solid var(--text-base)', paddingTop: '0.4em', lineHeight: 1.45 }}>
                  <strong>{foot.name}</strong>, {foot.company}
                </div>
                {foot.title ? <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.title}</div> : null}
                <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{`Signed ${lienWaiverDate(todayYmdInAppTz())}`}</div>
              </div>
            ) : (
              <LienWaiverSignOnPage ref={padRef} foot={foot} signedLabel={`Signed ${lienWaiverDate(todayYmdInAppTz())}`} allowTyped={!present} disabled={submitting} />
            )}
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          {present && (codeReady || codeOnly) ? (
            <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {codeMode ? (
                <>
                  <label htmlFor="lien-release-sign-code" style={{ fontSize: '0.8125rem', fontWeight: 650 }}>
                    {signerFirstName} types his signing code
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      id="lien-release-sign-code"
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={codeValue}
                      onChange={(e) => {
                        setCodeValue(e.target.value.replace(/[^0-9]/g, ''))
                        setFormError(null)
                      }}
                      disabled={submitting}
                      style={{ width: 120, padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '1rem', letterSpacing: '0.35em', background: 'var(--surface)', color: 'var(--text-base)' }}
                    />
                    {codeOnly ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          setSignMode('draw')
                          setModeTouched(true)
                          setFormError(null)
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Draw instead
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Four to six digits, his alone. The record names this screen, and he gets a push the moment it signs.</span>
                  {codeOnlyNote ? (
                    <span data-testid="lien-release-code-note" style={{ fontSize: '0.8125rem', color: 'var(--text-amber-900)' }}>
                      {codeOnlyNote}
                    </span>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSignMode('code')
                    setModeTouched(true)
                    setFormError(null)
                  }}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {signerFirstName} types his code instead
                </button>
              )}
            </div>
          ) : null}
          <LienWaiverSignAgree
            disclosure={
              codeMode
                ? `By typing his signing code, ${presentSigner?.name} acknowledges having read this release of lien and agrees to issue it. The code confirms it is him, and the typed signature has the same force and effect as a written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322). It prints on every copy of this document, and the record names whose screen it was typed on.`
                : present
                  ? `By signing, ${presentSigner.name} acknowledges having read this release of lien and agrees to issue it. Drawing the signature here has the same force and effect as a written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.`
                  : 'By signing, you acknowledge that you have read this release of lien and agree to issue it. Drawing or typing your signature here has the same force and effect as your written signature under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), and it prints on every copy of this document.'
            }
            agreeLabel={present ? `I, ${presentSigner.name}, have read this release and agree to sign it.` : 'I have read this release and agree to sign it.'}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              setFormError(null)
            }}
            error={formError}
            submitting={submitting}
            submitLabel={codeMode ? 'Sign it with his code' : present ? 'Sign it' : 'Sign release'}
            onSubmit={() => {
              if (codeMode) {
                void signWithCode()
                return
              }
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
