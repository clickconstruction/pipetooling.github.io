import { useEffect, useMemo, useState } from 'react'
import { buildContractSigningEmail, CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO, contractSigningEmailDefaultSubject } from '../../lib/contractSigningEmail'
import { PORTAL_SHORT_ORIGIN } from '../../lib/portal/portalShortOrigin'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { quickSendPlanWrites, type QuickSendPlan } from '../../lib/contractsQuickSend'
import { PERSON_PAPER_LINK_DAYS, sentToastWords, signerEmailRefusal } from '../../lib/contracts/personPaperSend'
import { materializeQuickSendRow, readPortalSlugIfLive, sendPersonPaperForSignature } from '../../lib/contracts/personPaperSendIo'
import { useToastContext } from '../../contexts/ToastContext'
import { SKY_UNDER_WORDS, WORDS_ON_SKY } from '../../lib/skyUnderWords'

/**
 * Send for signature: the one window that emails a person's paper to sign. People → Contracts opens it from a paper's
 * Send or Resend and from a quick-send pick; Documents → Agreements opens it from a waiting line's Send again. It shows
 * the email as the send function will build it, takes the signer's address and the office's own subject and opening
 * words, and sends through `send-contract-for-signature`.
 *
 * A quick-send pick writes nothing until Send email is pressed: its row is filled or made right before the send, and
 * `onRowWritten` hands the id up at once, so a send that then fails tries again on the same row.
 */
export function ContractSendWindow({
  target,
  docId,
  quickSendPlan = null,
  initialEmail,
  sender,
  personId,
  again = false,
  onClose,
  onRowWritten,
  onSent,
}: {
  /** Who and what the email is about; null when the paper went away under the window. */
  target: { personName: string; documentName: string } | null
  /** The saved paper to send; null while a quick-send pick has not been written yet. */
  docId: string | null
  /** The quick-send pick's plan, when the window was opened from one. */
  quickSendPlan?: QuickSendPlan | null
  /** The address the window opens on. */
  initialEmail: string
  /** The staff member sending, for the preview's Reply-To and reach line. */
  sender: { name: string; email: string } | null
  /** The one roster person the name finds, for the preview's portal band; null shows none. */
  personId: string | null
  /** The paper is already out: the window says it is sent again and that the earlier link stops working. */
  again?: boolean
  onClose: () => void
  onRowWritten?: (docId: string) => void
  onSent: (sent: { docId: string; emailed: boolean; planKind: QuickSendPlan['kind'] | null }) => void
}) {
  const { showToast } = useToastContext()
  const [email, setEmail] = useState(initialEmail)
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** A quick-send row written by an earlier press that then failed to send: the next press sends that same row. */
  const [writtenDocId, setWrittenDocId] = useState<string | null>(null)

  // The signer's portal address, read the way the send function reads it: a saved slug and an unrevoked link.
  useEffect(() => {
    if (!personId) {
      setPortalUrl(null)
      return
    }
    let cancelled = false
    readPortalSlugIfLive(personId).then(
      (slug) => !cancelled && setPortalUrl(slug ? `${PORTAL_SHORT_ORIGIN}${slug}` : null),
      () => !cancelled && setPortalUrl(null),
    )
    return () => {
      cancelled = true
    }
  }, [personId])

  const preview = useMemo(() => {
    if (!target) return { kind: 'missing' as const }
    const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : 'https://pipetooling.github.io'
    const sentYmd = todayYmdInAppTz()
    return {
      kind: 'ok' as const,
      ...buildContractSigningEmail({
        documentName: target.documentName,
        personName: target.personName,
        acceptUrl: `${origin}/contract/accept?t=…`,
        expiresYmd: ymdAddDays(sentYmd, PERSON_PAPER_LINK_DAYS),
        sentYmd,
        subjectOverride: subject,
        introPlain: intro,
        sender,
        portalUrl,
        officePhone: PORTAL_COMPANY.phone || null,
      }),
    }
  }, [target, subject, intro, sender, portalUrl])

  async function send() {
    const refusal = signerEmailRefusal(email)
    if (refusal) {
      setError(refusal)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // The user just committed: this is where a quick-send pick becomes a row. The id is pinned at once, so a failed
      // send retries against the same row instead of minting a second one.
      let id = writtenDocId ?? docId
      const planKind = quickSendPlan?.kind ?? null
      if (!writtenDocId && target && quickSendPlan && quickSendPlanWrites(quickSendPlan)) {
        id = await materializeQuickSendRow({ personName: target.personName, documentName: target.documentName, plan: quickSendPlan })
        setWrittenDocId(id)
        onRowWritten?.(id)
      }
      if (!id) {
        setError('Could not prepare the document to send')
        return
      }
      const result = await sendPersonPaperForSignature({ documentId: id, mode: 'email', signerEmail: email, subject, intro })
      const toast = sentToastWords(result)
      showToast(toast.words, toast.tone)
      onSent({ docId: id, emailed: result.emailed, planKind })
    } catch (e) {
      setError(formatErrorMessage(e, 'Send failed'))
    } finally {
      setSaving(false)
    }
  }

  const field = { display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-label={again ? 'Send again' : 'Send for signature'} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(640px, 92vw)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>{again ? 'Send again' : 'Send for signature'}</h3>
        {again && target ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.25rem' }} data-testid="contract-send-again-note">
            {target.documentName} goes to {target.personName} again, with a new signing link. The link sent before stops working.
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {error}
          </p>
        ) : null}
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Signer email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={field} />
        </label>
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Email subject (optional)</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Default: ${contractSigningEmailDefaultSubject(target?.documentName ?? 'your agreement')}`}
            maxLength={200}
            style={field}
          />
        </label>
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Opening message (optional, plain text)</span>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder={`Default: ${CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO} Leave blank to use it, or write it in your own words.`}
            rows={4}
            maxLength={4000}
            style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
          Your message opens the email. The document name, the three signing steps, the button, and the link&rsquo;s expiry date follow it.
        </p>
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>Email preview</div>
          {preview.kind === 'missing' ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Unable to load preview.</p>
          ) : (
            <>
              <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', lineHeight: 1.45 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>From: </span>
                  {preview.fromName}
                  {preview.replyTo ? (
                    <>
                      {' '}· <span style={{ fontWeight: 600 }}>Reply-To: </span>
                      {preview.replyTo}
                    </>
                  ) : null}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>Subject: </span>
                  {preview.subject}
                </div>
              </div>
              <iframe title="Contract email preview" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 6, background: '#f6f3ec' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                Built by the same code that sends it. The signing link is generated when you send; the link works for {PERSON_PAPER_LINK_DAYS} days.
              </p>
            </>
          )}
        </div>
        <div style={{ display: 'flex', marginTop: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Nothing was written for a quick-send pick, so there is nothing to undo. */}
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: SKY_UNDER_WORDS, color: WORDS_ON_SKY, border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Sending…' : again ? 'Send the email again' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContractSendWindow
