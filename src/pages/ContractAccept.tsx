import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import EstimateCustomerThankYou from '../components/estimates/EstimateCustomerThankYou'
import { ContractAcceptSignatureForm } from '../components/contracts/ContractAcceptSignatureForm'
import { contractBodyHasRenderableDisplay } from '../lib/contractBodyFormat'
import { ContractBodyDisplay } from '../components/contracts/ContractBodyDisplay'
import type { EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const contractThankYouPrimaryLinkStyle: CSSProperties = {
  marginTop: '1.5rem',
  display: 'inline-block',
  padding: '0.5rem 1.25rem',
  fontWeight: 600,
  background: '#ea580c',
  color: 'white',
  borderRadius: 6,
  textDecoration: 'none',
  textAlign: 'center',
}

type ContractThankYouCtaState =
  | { status: 'waiting_auth' }
  | { status: 'anon' }
  | { status: 'fetching' }
  | { status: 'signed_in'; pendingCount: number }

type LoadPayload = {
  id: string
  person_name: string
  document_name: string
  signing_body_html: string | null
  signing_body_format: string
  canonical_document_url: string | null
}

export default function ContractAccept() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LoadPayload | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [thankYouTitle, setThankYouTitle] = useState('Thank you')
  const [thankYouBody, setThankYouBody] = useState('')
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [thankYouCta, setThankYouCta] = useState<ContractThankYouCtaState>({ status: 'waiting_auth' })

  const showThankYou = done || alreadySigned

  useEffect(() => {
    if (!showThankYou) {
      setThankYouCta({ status: 'waiting_auth' })
      return
    }
    if (authLoading) {
      setThankYouCta({ status: 'waiting_auth' })
      return
    }
    if (!user) {
      setThankYouCta({ status: 'anon' })
      return
    }

    let cancelled = false
    setThankYouCta({ status: 'fetching' })
    void (async () => {
      try {
        const rows = (await withSupabaseRetry(
          () => supabase.rpc('list_my_contract_dashboard_prompts'),
          'list_my_contract_dashboard_prompts',
        )) as Array<{ id: string }>
        if (cancelled) return
        setThankYouCta({ status: 'signed_in', pendingCount: rows.length })
      } catch {
        if (!cancelled) setThankYouCta({ status: 'signed_in', pendingCount: 0 })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [showThankYou, authLoading, user])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('This link is missing required information.')
      return
    }
    const ac = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-contract-for-signer?token=${encodeURIComponent(token)}`,
          {
            signal: ac.signal,
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          },
        )
        const json = (await res.json()) as LoadPayload & {
          error?: string
          code?: string
          thank_you_title?: string
          thank_you_body?: string
        }
        if (ac.signal.aborted) return
        if (res.status === 409 && json.code === 'already_signed') {
          setAlreadySigned(true)
          setPayload(null)
          setThankYouTitle('Thank you')
          setThankYouBody('')
          setLoading(false)
          return
        }
        if (!res.ok) {
          setError(json.error || 'Unable to load contract.')
          setPayload(null)
          setLoading(false)
          return
        }
        setPayload({
          id: String(json.id),
          person_name: String(json.person_name ?? ''),
          document_name: String(json.document_name ?? ''),
          signing_body_html: json.signing_body_html ?? null,
          signing_body_format:
            typeof json.signing_body_format === 'string' && json.signing_body_format ? json.signing_body_format : 'html',
          canonical_document_url: json.canonical_document_url ?? null,
        })
      } catch {
        if (!ac.signal.aborted) setError('Could not load contract. Check your connection.')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => ac.abort()
  }, [token])

  async function submitAccept(p: EstimateAcceptSubmitPayload) {
    if (!token) return
    if (!agreed) {
      setError('Please confirm that you agree to the contract.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body =
        p.mode === 'type'
          ? { token, printedName: p.printedName, agreedTerms: true as const }
          : {
              token,
              printedName: p.printedName,
              signaturePngBase64: p.signaturePngBase64,
              agreedTerms: true as const,
            }
      const res = await fetch(`${supabaseUrl}/functions/v1/accept-contract`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string; ok?: boolean; alreadySigned?: boolean }
      if (!res.ok) {
        setError(json.error || 'Could not record signature.')
        return
      }
      if (json.alreadySigned) {
        setAlreadySigned(true)
        setThankYouTitle('Thank you')
        setThankYouBody('')
        return
      }
      setThankYouTitle('Thank you')
      setThankYouBody('')
      setDone(true)
    } catch {
      setError('Could not record signature. Try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AuthPublicLandingLayout
        titleLinkText="Click Plumbing and Electrical"
        titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
      >
        <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
          <div className="auth-public-landing__signin-box">
            <p>Loading…</p>
          </div>
        </div>
      </AuthPublicLandingLayout>
    )
  }

  if (done || alreadySigned) {
    return (
      <AuthPublicLandingLayout
        titleLinkText="Click Plumbing and Electrical"
        titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
      >
        <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
          <div className="auth-public-landing__signin-box auth-public-landing__estimate-thankyou-inner">
            <EstimateCustomerThankYou
              title={thankYouTitle}
              body={thankYouBody}
              footerImageSrc={`${import.meta.env.BASE_URL}pup.jpg`}
            />
            <div style={{ textAlign: 'center', padding: '0 1rem 1.5rem' }}>
              {thankYouCta.status === 'waiting_auth' || thankYouCta.status === 'fetching' ? (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Checking for more contracts…
                </p>
              ) : thankYouCta.status === 'anon' ? (
                <Link to="/sign-in" style={contractThankYouPrimaryLinkStyle}>
                  Sign in
                </Link>
              ) : thankYouCta.status === 'signed_in' && thankYouCta.pendingCount > 0 ? (
                <Link to="/dashboard" style={contractThankYouPrimaryLinkStyle}>
                  Go to dashboard
                </Link>
              ) : thankYouCta.status === 'signed_in' ? (
                <Link to="/dashboard" style={contractThankYouPrimaryLinkStyle}>
                  Return to PipeTooling
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </AuthPublicLandingLayout>
    )
  }

  if (error && !payload) {
    return (
      <AuthPublicLandingLayout
        titleLinkText="Click Plumbing and Electrical"
        titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
      >
        <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
          <div className="auth-public-landing__signin-box">
            <h1 style={{ fontSize: '1.25rem' }}>Contract</h1>
            <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
          </div>
        </div>
      </AuthPublicLandingLayout>
    )
  }

  if (!payload) return null

  const hasRenderableSigningBody = contractBodyHasRenderableDisplay(
    payload.signing_body_html,
    payload.signing_body_format,
  )
  const canonical = payload.canonical_document_url?.trim()

  return (
    <AuthPublicLandingLayout
      titleLinkText="Click Plumbing and Electrical"
      titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
    >
      <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
        <div className="auth-public-landing__signin-box" style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: '1.35rem', marginTop: 0 }}>{payload.document_name}</h1>

          {canonical ? (
            <p style={{ marginBottom: '1rem' }}>
              <a
                href={canonical}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-link)', fontWeight: 600 }}
              >
                Open full document
              </a>
            </p>
          ) : null}

          {hasRenderableSigningBody ? (
            <div
              style={{
                maxHeight: 'min(50vh, 420px)',
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem',
                background: 'var(--bg-subtle)',
                fontSize: '0.9rem',
                marginBottom: '0.5rem',
              }}
            >
              <ContractBodyDisplay
                format={payload.signing_body_format}
                bodyHtml={payload.signing_body_html}
              />
            </div>
          ) : null}

          {!hasRenderableSigningBody && !canonical ? (
            <p style={{ color: 'var(--text-muted)' }}>No document content was provided for this link.</p>
          ) : null}

          <ContractAcceptSignatureForm
            printedName={printedName}
            agreed={agreed}
            onPrintedNameChange={setPrintedName}
            onAgreedChange={setAgreed}
            formError={error}
            submitting={submitting}
            onSubmit={(p) => void submitAccept(p)}
          />
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}
