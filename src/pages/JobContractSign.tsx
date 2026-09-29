/**
 * The customer's contract page (Contract Desk PR 2): `/contract/sign?t=<token>`.
 * The bid room's shell with a job in it — pinned light, letterhead, scope in
 * plain words, one amount, the payment line, the full terms one tap away,
 * and the same signature block customers already use on estimates. The link
 * is durable: after signing it shows the signed record forever.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import { ContractAcceptSignatureForm } from '../components/contracts/ContractAcceptSignatureForm'
import { ContractBodyDisplay } from '../components/contracts/ContractBodyDisplay'
import type { EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import { SignedSignatureBlock } from '../components/SignedSignatureBlock'
import { signedRecordId } from '../lib/signedRecordId'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel, parseAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { formatContractMoney, parseJobContractFields, paymentTermsSentence, type JobContractIssuer } from '../lib/jobs/jobContractDocument'
import { sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { jobContractSignatureAuditLine } from '../lib/jobs/jobContractLifecycle'
import { openFrames, signerFrames, type SignerFrameKey } from '../lib/jobs/jobContractSigners'
import { esignConsentText } from '../lib/esignConsent'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type ContractFetch = {
  contract: {
    id: string
    status: string
    revision: number
    heading: string
    job_number: string
    job_address: string | null
    customer_name: string | null
    recipient_name: string | null
    fields: unknown
    body_html: string | null
    body_format: string
    template_name: string | null
    template_version_date: string | null
    sent_at: string | null
    signed_at: string | null
    signer_printed_name: string | null
    signer_mode: string | null
    signer_consented_at: string | null
    signature_url: string | null
    signed_pdf_url: string | null
    /** v2.4186: the second frame, when the office named a second signer. */
    co_signer_name?: string | null
    co_signed_at?: string | null
    co_signer_printed_name?: string | null
    co_signer_mode?: string | null
    co_signer_consented_at?: string | null
    co_signature_url?: string | null
  }
  issuer: JobContractIssuer | null
  brand: string | null
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <AuthPublicLandingLayout
      titleLinkText="Click Plumbing and Electrical"
      titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
    >
      <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
        <div className="auth-public-landing__signin-box">{children}</div>
      </div>
    </AuthPublicLandingLayout>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-orange-700)',
  fontWeight: 700,
  margin: '1.3rem 0 0.4rem',
}

export default function JobContractSign() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const inPerson = params.get('inperson') === '1'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ContractFetch | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [justSigned, setJustSigned] = useState<{ printedName: string; signedAt: string; mode: string; signer: SignerFrameKey; complete: boolean; waitingOn: string | null } | null>(null)
  /** v2.4186: which frame this person is signing when two are open. */
  const [chosenFrame, setChosenFrame] = useState<SignerFrameKey | null>(null)
  // What customers see (v2.3510): the sample token renders the sample agreement; signing moves straight to the signed view and saves nothing.
  const sample = sampleStateFromToken(token)

  useEffect(() => {
    if (!token) {
      setError('This link is incomplete.')
      setLoading(false)
      return
    }
    const ac = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-job-contract?t=${encodeURIComponent(token)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          signal: ac.signal,
        })
        const json = (await res.json()) as ContractFetch & { error?: string; code?: string }
        if (!res.ok) {
          setError(
            json.code === 'voided'
              ? 'This agreement was withdrawn. Please contact us for the current version.'
              : json.code === 'expired'
                ? 'This link has expired. Reply to our email or call the office and we will send a fresh one.'
                : json.code === 'empty'
                  ? 'Nothing has been sent to this link yet — check back shortly.'
                  : json.error || 'Could not load the agreement.',
          )
          return
        }
        if (!ac.signal.aborted) {
          setData(json)
          if (json.contract.recipient_name && !printedName) setPrintedName('')
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!ac.signal.aborted) setError('Could not load the agreement. Check your connection.')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reloadNonce])

  const fields = useMemo(() => parseJobContractFields(data?.contract.fields), [data])

  async function submit(payload: EstimateAcceptSubmitPayload) {
    if (!data) return
    const signer: SignerFrameKey = chosenFrame ?? openFrames(data.contract)[0]?.key ?? 'primary'
    if (sample) {
      setJustSigned({ printedName: payload.printedName, signedAt: new Date().toISOString(), mode: payload.mode, signer, complete: true, waitingOn: null })
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sign-job-contract`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          revision: data.contract.revision,
          printedName: payload.printedName,
          agreedTerms: true,
          ...(payload.mode === 'draw' ? { signaturePngBase64: payload.signaturePngBase64 } : {}),
          ...(payload.consent ? { esignConsent: payload.consent } : {}),
          ...(inPerson ? { mode: 'in_person' } : {}),
          ...(signer === 'co' ? { signer: 'co' } : {}),
          public_origin: window.location.origin,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string; signed_at?: string | null; mode?: string; complete?: boolean; waiting_on?: string | null }
      if (!res.ok || !json.ok) {
        if (json.code === 'stale_revision' || json.code === 'already_signed' || json.code === 'frame_signed') {
          setFormError('This agreement was just updated — here is the current version.')
          setReloadNonce((n) => n + 1)
          return
        }
        setFormError(json.error || 'Could not record your signature. Please try again.')
        return
      }
      const complete = json.complete !== false
      setJustSigned({ printedName: payload.printedName, signedAt: json.signed_at ?? new Date().toISOString(), mode: json.mode ?? 'type', signer, complete, waitingOn: json.waiting_on ?? null })
      setPrintedName('')
      setAgreed(false)
      setChosenFrame(null)
      // A frame filled while the other waits: read the row again so its frame shows signed.
      if (!complete) setReloadNonce((n) => n + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setFormError('Could not record your signature. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Shell><p style={{ margin: 0 }}>Loading your agreement…</p></Shell>
  if (error || !data) return <Shell><p style={{ margin: 0 }}>{error ?? 'Could not load the agreement.'}</p></Shell>

  const c = data.contract
  const issuer = data.issuer
  const brand = parseAcceptHeaderBrand(data.brand)
  // v2.4186: one frame, or two when the office named a second signer; either may sign first.
  const frames = signerFrames(c).map((f) =>
    justSigned && justSigned.signer === f.key && !f.signedAt ? { ...f, signedAt: justSigned.signedAt, printedName: justSigned.printedName, mode: justSigned.mode, consentedAt: justSigned.signedAt } : f,
  )
  const open = frames.filter((f) => !(f.signedAt && f.printedName))
  const signed = c.status === 'signed' || (justSigned?.complete ?? false) || (frames.length > 0 && open.length === 0)
  const signedNames = frames.filter((f) => f.signedAt && f.printedName).map((f) => f.printedName ?? '')
  const signedName = signedNames.join(' and ')
  const signedAt = justSigned?.complete ? justSigned.signedAt : c.signed_at
  const auditLine = jobContractSignatureAuditLine({
    signed_at: signedAt ?? frames[0]?.signedAt ?? null,
    signer_printed_name: signedName,
    signer_mode: justSigned?.mode ?? c.signer_mode,
    signer_consented_at: justSigned ? justSigned.signedAt : c.signer_consented_at,
  })
  const partial = !signed && frames.length > 1 && open.length === 1
  const signingFrame = open.length === 1 ? open[0] : open.find((f) => f.key === chosenFrame) ?? null
  const amountLabel = fields.amount_cents != null ? formatContractMoney(fields.amount_cents) : 'Billed at completion'
  const scope = fields.scope_lines.map((l) => l.trim()).filter(Boolean)
  const dateLabel = (() => {
    const d = new Date(c.sent_at ?? Date.now())
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  })()

  return (
    <Shell>
      <div data-theme="light" style={{ color: 'var(--text-strong)' }}>
        {sample ? <SampleModeBanner /> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
            {issuer?.companyName ? (
              <div style={{ fontWeight: 700, color: '#7c2d12', fontSize: '0.95rem' }}>
                {issuer.companyName}
                <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'pre-line' }}>
                  {[issuer.addressText, issuer.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
            ) : null}
            <h1 style={{ margin: '0.6rem 0 0', fontSize: '1.45rem', lineHeight: 1.2 }}>{c.heading}</h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
              Job <strong>#{c.job_number}</strong> · for <strong>{c.customer_name || c.recipient_name || 'you'}</strong>
              {dateLabel ? <> · {dateLabel}</> : null}
              {c.revision > 1 ? <> · rev {c.revision}</> : null}
            </p>
            {c.job_address ? <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Property: {c.job_address}</p> : null}
          </div>
          {brand ? (
            <img
              src={acceptHeaderBrandImageSrc(brand)}
              alt={acceptHeaderBrandLabel(brand)}
              width={140}
              height={56}
              style={{ maxWidth: 140, maxHeight: 56, width: 'auto', height: 'auto', objectFit: 'contain', flex: '0 0 auto' }}
            />
          ) : null}
        </div>

        {signed ? (
          <div
            role="status"
            style={{ marginTop: '1rem', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.9rem', fontWeight: 600, background: '#f2fbf5', border: '1px solid #b5e5c4', color: 'var(--text-green-800)' }}
          >
            ✍ Signed{signedName ? ` by ${signedName}` : ''}
            {justSigned ? '. Thank you — we emailed a copy to you.' : '.'}
            <div style={{ fontWeight: 400, fontSize: '0.78rem', marginTop: 2 }}>{auditLine}</div>
          </div>
        ) : partial ? (
          <div role="status" style={{ marginTop: '1rem', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.9rem', fontWeight: 600, background: 'var(--bg-amber-tint)', border: '1px solid var(--border)', color: 'var(--text-amber-800)' }} data-testid="contract-sign-partial">
            ✍ {signedName} has signed{justSigned && !justSigned.complete ? ' — thank you' : ''}. Waiting on {open[0]?.expectedName || 'the other signer'}&apos;s signature to complete the agreement.
          </div>
        ) : null}

        {fields.note.trim() ? <p style={{ margin: '1rem 0 0', fontSize: '0.92rem' }}>{fields.note.trim()}</p> : null}

        <div style={sectionLabel}>Work we&apos;ll do</div>
        {scope.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.92rem' }}>
            {scope.map((l, i) => (
              <li key={i} style={{ margin: '0.2rem 0' }}>{l}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Scope as discussed.</p>
        )}
        {fields.exclusions.trim() ? <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Not included: {fields.exclusions.trim()}</p> : null}
        {fields.start_date || fields.completion_date ? (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {[fields.start_date ? `Start: ${fields.start_date}` : '', fields.completion_date ? `Estimated completion: ${fields.completion_date}` : ''].filter(Boolean).join(' · ')}
          </p>
        ) : null}

        <div style={sectionLabel}>Price &amp; payment</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid var(--border-rule)', paddingTop: '0.5rem' }}>
          <span>Contract amount</span>
          <span>{amountLabel}</span>
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-700)' }}>{paymentTermsSentence(fields)}</p>

        <div style={sectionLabel}>Terms{c.template_name ? ` · ${c.template_name}` : ''}</div>
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.6rem 0.8rem',
            fontSize: '0.85rem',
            color: 'var(--text-700)',
            maxHeight: termsOpen ? undefined : 120,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <ContractBodyDisplay format={c.body_format} bodyHtml={c.body_html} />
          {!termsOpen ? <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, background: 'linear-gradient(transparent, var(--bg-subtle))' }} /> : null}
        </div>
        <button
          type="button"
          onClick={() => setTermsOpen((v) => !v)}
          style={{ marginTop: '0.35rem', background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
        >
          {termsOpen ? 'Collapse the terms ▴' : 'Read the full terms ▾'}
        </button>

        {frames.filter((f) => f.signedAt && f.printedName).map((f) => (
          <div key={f.key} style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border-rule)', paddingTop: '0.4rem' }} data-testid={`contract-sign-frame-${f.key}`}>
            <SignedSignatureBlock
              heading={frames.length > 1 ? (f.key === 'primary' ? 'Customer signature' : `Second signature — ${f.expectedName || f.printedName || ''}`) : 'Customer signature'}
              printedName={f.printedName ?? ''}
              signedAtIso={f.signedAt}
              consentedAtIso={f.consentedAt}
              consentSummary="agreed to do business electronically and to this agreement's scope, price and terms"
              method={f.mode}
              recordId={signedRecordId('J', c.job_number, c.id)}
              drawSignatureUrl={f.key === 'primary' ? c.signature_url : c.co_signature_url ?? null}
            />
          </div>
        ))}
        {signed ? (
          <div style={{ marginTop: '0.4rem' }}>
            {c.signed_pdf_url ? (
              <a
                href={c.signed_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '0.9rem', padding: '0.55rem 1rem', borderRadius: 8, border: '1.5px solid var(--text-orange-700)', color: 'var(--text-orange-700)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
              >
                Download signed PDF
              </a>
            ) : justSigned ? (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Your signed PDF is in the confirmation email; reload this page for a download link.</p>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border-rule)', paddingTop: '0.9rem' }}>
            {inPerson ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Signing in person with a Click Plumbing team member present.</p>
            ) : null}
            {open.length > 1 ? (
              <div style={{ marginBottom: '0.8rem' }} data-testid="contract-sign-who">
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Two signatures complete this agreement. Who is signing now?</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="radiogroup" aria-label="Who is signing">
                  {open.map((f) => {
                    const on = signingFrame?.key === f.key
                    return (
                      <button
                        key={f.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setChosenFrame(f.key)}
                        data-testid={`contract-sign-as-${f.key}`}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: 999, border: `1.5px solid ${on ? 'var(--text-orange-700)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-orange-tint)' : 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {f.expectedName || (f.key === 'primary' ? 'The customer' : 'The second signer')}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {open.length > 1 && !signingFrame ? null : (
            <ContractAcceptSignatureForm
              printedName={printedName}
              agreed={agreed}
              onPrintedNameChange={setPrintedName}
              onAgreedChange={setAgreed}
              formError={formError}
              submitting={submitting}
              onSubmit={(p) => void submit(p)}
              heading={frames.length > 1 && signingFrame ? `Sign agreement — ${signingFrame.expectedName || (signingFrame.key === 'primary' ? 'the customer' : 'the second signer')}` : 'Sign agreement'}
              disclosure="Your signature below applies to the scope, price, and terms shown on this page."
              consent={esignConsentText({ audience: 'customer', documentNoun: 'this agreement' })}
              agreeLabel="I agree to do business electronically and accept this agreement, its scope, price, and terms."
              submitLabel={`Sign agreement${fields.amount_cents != null ? ` — ${amountLabel}` : ''}`}
            />
            )}
            <p style={{ margin: '0.8rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Questions first?{issuer?.phone ? ` Call ${issuer.phone} or` : ''} reply to our email.
            </p>
          </div>
        )}

        {issuer ? (
          <p style={{ margin: '1.6rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'pre-line' }}>
            {[issuer.tagline, issuer.companyName, issuer.addressText, issuer.phone ? `Ph: ${issuer.phone}` : '', issuer.licenseLine].filter(Boolean).join('\n')}
          </p>
        ) : null}
      </div>
    </Shell>
  )
}
