import { useEffect, useMemo, useRef, useState } from 'react'
import { buildContractSigningEmail, CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO, contractSigningEmailDefaultSubject } from '../../lib/contractSigningEmail'
import { PORTAL_SHORT_ORIGIN } from '../../lib/portal/portalShortOrigin'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { quickSendPlanWrites, type QuickSendPlan } from '../../lib/contractsQuickSend'
import { PERSON_PAPER_LINK_DAYS, initialSignerName as signerNameToOpenOn, sentToastWords, signerEmailRefusal, signerNameRefusal } from '../../lib/contracts/personPaperSend'
import { PAPER_WORD_MAX } from '../../lib/contracts/paperParty'
import { ADDRESS_NOT_CHECKED, addressLookUpVerdict, keepSignerWords, knownAddressRefusal, knownAddressWords, partySaysLine, partySigningFor, sendPartyHint, type PartySendInput, type SendWindowParty } from '../../lib/documents/paperPartyPick'
import { readContactForAddress, type KnownAddress } from '../../lib/documents/paperPartyIo'
import { materializeQuickSendRow, readKeptSigner, readPortalSlugIfLive, sendPersonPaperForSignature } from '../../lib/contracts/personPaperSendIo'
import { useToastContext } from '../../contexts/ToastContext'
import { SKY_UNDER_WORDS, WORDS_ON_SKY } from '../../lib/skyUnderWords'

/**
 * Send for signature: the one window that emails a person's paper to sign. People → Contracts opens it from a paper's
 * Send or Resend and from a quick-send pick; Documents → Agreements opens it from a waiting line's Send again. It shows
 * the email as the send function will build it, takes who signs (their name, their title and their address) and the
 * office's own subject and opening words, and sends through `send-contract-for-signature`. The function keeps the signer
 * on the paper's own row (punch list #403), which is what a reminder and the signer's copy are sent to.
 *
 * A quick-send pick writes nothing until Send email is pressed: its row is filled or made right before the send, and
 * `onRowWritten` hands the id up at once, so a send that then fails tries again on the same row.
 *
 * A party's paper (punch list #403, step 3) opens the same window with `party`: an outside company, or someone on no
 * list. The window then says who the paper is with and what it will say, asks someone on no list for their company,
 * names an address the app already keeps, and offers to keep a typed signer with their company. Its paper is written
 * through `preparePartyPaper`, right before the email goes, like a quick-send pick's.
 */
export function ContractSendWindow({
  target,
  docId,
  quickSendPlan = null,
  initialEmail,
  initialSignerName,
  initialSignerTitle,
  sender,
  personId,
  again = false,
  party = null,
  preparePartyPaper,
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
  /**
   * Who signed for the paper last time, when the caller read them with the paper. Left out, the window reads them itself
   * for a saved paper. With nobody kept it opens on the person the paper is filed under.
   */
  initialSignerName?: string
  initialSignerTitle?: string
  /** The staff member sending, for the preview's Reply-To and reach line. */
  sender: { name: string; email: string } | null
  /** The one roster person the name finds, for the preview's portal band; null shows none. */
  personId: string | null
  /** The paper is already out: the window says it is sent again and that the earlier link stops working. */
  again?: boolean
  /** Who an outside party's paper is with. Left out for a person's own paper. */
  party?: SendWindowParty | null
  /**
   * Writes what a party's first send needs, at Send email and not before: the party's contact, a person kept with the
   * company, and the paper's row. Answers the row to send. Left out when the paper is already written.
   */
  preparePartyPaper?: (input: PartySendInput) => Promise<string>
  onClose: () => void
  onRowWritten?: (docId: string) => void
  onSent: (sent: { docId: string; emailed: boolean; planKind: QuickSendPlan['kind'] | null }) => void
}) {
  const { showToast } = useToastContext()
  const [email, setEmail] = useState(initialEmail)
  const [signerName, setSignerName] = useState(() => signerNameToOpenOn(initialSignerName, target?.personName))
  const [signerTitle, setSignerTitle] = useState(initialSignerTitle ?? '')
  /** The boxes the office has typed in: what the paper kept never lands over their words. */
  const typed = useRef({ name: false, title: false, email: false })
  /** Someone on no list: the company they sign for, when the office types one. */
  const [company, setCompany] = useState('')
  /** A typed signer is kept with their company unless the office unticks it. */
  const [keep, setKeep] = useState(true)
  /** Whose the typed address already is, for someone on no list. */
  const [known, setKnown] = useState<KnownAddress | null>(null)
  /** The address the last look-up that answered was for. A press of Send email asks itself when it is not this one. */
  const lookedUpFor = useRef<string | null>(null)
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

  // A saved paper keeps who signed for it last time. A caller that did not read them leaves it to the window: the name
  // and the title fill their boxes, and the address fills an empty one. The roster's address stays when there is one.
  useEffect(() => {
    if (!docId || initialSignerName !== undefined) return
    let cancelled = false
    readKeptSigner(docId).then(
      (kept) => {
        if (cancelled) return
        if (kept.name && !typed.current.name) setSignerName(kept.name)
        if (kept.title && !typed.current.title) setSignerTitle(kept.title)
        if (kept.email && !typed.current.email) setEmail((now) => (now.trim() ? now : kept.email))
      },
      // The boxes keep what they opened on: the read is a help, never a gate.
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [docId, initialSignerName])

  // Someone on no list is found by their address. One the app already keeps is named before the send, so nobody is
  // added twice. Asked once the typing rests. A look-up that fails names nobody here, and Send email asks again itself
  // and holds the send until it has an answer (`send`, below).
  const lookUpAddress = party?.unlisted === true && !docId
  useEffect(() => {
    if (!lookUpAddress || signerEmailRefusal(email)) {
      setKnown(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      // A press of Send email that beat this timer has asked already: the answer is on the window.
      if (lookedUpFor.current === email.trim()) return
      readContactForAddress(email).then(
        (found) => {
          if (cancelled) return
          lookedUpFor.current = email.trim()
          setKnown(found)
        },
        () => !cancelled && setKnown(null),
      )
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lookUpAddress, email])

  const preview = useMemo(() => {
    if (!target) return { kind: 'missing' as const }
    const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : 'https://pipetooling.github.io'
    const sentYmd = todayYmdInAppTz()
    return {
      kind: 'ok' as const,
      ...buildContractSigningEmail({
        documentName: target.documentName,
        // A party's paper is filed under a stored name: the email is for the person who signs.
        personName: party ? signerName.trim() || party.name : target.personName,
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
  }, [target, subject, intro, sender, portalUrl, party, signerName])

  async function send() {
    const refusal = signerNameRefusal(signerName) ?? signerEmailRefusal(email)
    if (refusal) {
      setError(refusal)
      return
    }
    setSaving(true)
    setError(null)
    if (lookUpAddress) {
      // Whose the address is must be known before anything is written. A press that came before the look-up answered
      // asks now and waits, so the roster's refusal and the note that names who holds the address are never skipped.
      const address = email.trim()
      const namedBefore = lookedUpFor.current === address
      let who = known
      if (!namedBefore) {
        try {
          who = await readContactForAddress(address)
        } catch (e) {
          setError(`${ADDRESS_NOT_CHECKED} ${formatErrorMessage(e, '')}`.trim())
          setSaving(false)
          return
        }
        lookedUpFor.current = address
        setKnown(who)
      }
      const verdict = addressLookUpVerdict(who, namedBefore)
      if (verdict.kind === 'hold') {
        setError(verdict.why)
        setSaving(false)
        return
      }
    }
    try {
      // The user just committed: this is where a quick-send pick becomes a row. The id is pinned at once, so a failed
      // send retries against the same row instead of minting a second one.
      let id = writtenDocId ?? docId
      const planKind = quickSendPlan?.kind ?? null
      if (!writtenDocId && party && preparePartyPaper) {
        // A party's first send: its contact, a person kept with the company and the paper's row are written here.
        id = await preparePartyPaper({ signerName, signerEmail: email, typedCompany: company, keep: party.keepWith != null && keep })
        setWrittenDocId(id)
        onRowWritten?.(id)
      } else if (!writtenDocId && target && quickSendPlan && quickSendPlanWrites(quickSendPlan)) {
        id = await materializeQuickSendRow({ personName: target.personName, documentName: target.documentName, plan: quickSendPlan })
        setWrittenDocId(id)
        onRowWritten?.(id)
      }
      if (!id) {
        setError('Could not prepare the document to send')
        return
      }
      const result = await sendPersonPaperForSignature({
        documentId: id,
        mode: 'email',
        signerEmail: email,
        signerName,
        signerTitle,
        // The business a party's signer signs for is kept with them. A person's own paper sends none, and keeps its own.
        ...(party ? { signingFor: partySigningFor(party, company, signerName) ?? '' } : {}),
        subject,
        intro,
      })
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
        {party && target ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.25rem' }} data-testid="contract-send-party">
            {sendPartyHint(target.documentName, party)}
          </p>
        ) : null}
        {again && target ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.25rem' }} data-testid="contract-send-again-note">
            {target.documentName} goes to {party ? signerName.trim() || party.name || 'them' : target.personName} again, with a new signing link. The link sent before stops working.
          </p>
        ) : null}
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Signer name</span>
          <input
            type="text"
            value={signerName}
            onChange={(e) => {
              typed.current.name = true
              setSignerName(e.target.value)
            }}
            placeholder="Who signs it"
            maxLength={PAPER_WORD_MAX}
            autoComplete="off"
            style={field}
          />
        </label>
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Title (optional)</span>
          <input
            type="text"
            value={signerTitle}
            onChange={(e) => {
              typed.current.title = true
              setSignerTitle(e.target.value)
            }}
            placeholder="Owner, Branch manager"
            maxLength={PAPER_WORD_MAX}
            autoComplete="off"
            style={field}
          />
        </label>
        {party?.unlisted ? (
          <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 600 }}>Company (optional)</span>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="The business they sign for" maxLength={PAPER_WORD_MAX} autoComplete="off" style={field} />
          </label>
        ) : null}
        <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>Signer email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              typed.current.email = true
              setEmail(e.target.value)
            }}
            placeholder="name@example.com"
            style={field}
          />
        </label>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }} data-testid="contract-send-signer-kept">
          The name and the address are kept on the paper.
        </p>
        {lookUpAddress && knownAddressWords(known) ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-700)', margin: '0.5rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint)' }} data-testid="contract-send-known-address">
            {knownAddressWords(known)}
          </p>
        ) : null}
        {lookUpAddress && knownAddressRefusal(known) ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', margin: '0.5rem 0 0' }} data-testid="contract-send-known-roster">
            {knownAddressRefusal(known)}
          </p>
        ) : null}
        {party?.keepWith && !docId && keepSignerWords(signerName, party.keepWith) ? (
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.6rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ marginTop: '0.15rem' }} />
            <span>
              <span style={{ fontWeight: 600, display: 'block' }}>{keepSignerWords(signerName, party.keepWith)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>The next paper offers them by name.</span>
            </span>
          </label>
        ) : null}
        {party && partySaysLine(party, company, signerName, signerTitle) ? (
          <p style={{ fontSize: '0.8125rem', margin: '0.6rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }} data-testid="contract-send-says">
            {/* A business whose name ends in a full stop is not given a second one. */}
            The paper will say: <strong>{partySaysLine(party, company, signerName, signerTitle).replace(/\.$/, '')}.</strong>
          </p>
        ) : null}
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
        {/* The window scrolls and the press is at its foot: a refusal is drawn beside the press, where the eye is. */}
        {error ? (
          <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0.75rem 0 0' }}>
            {error}
          </p>
        ) : null}
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
