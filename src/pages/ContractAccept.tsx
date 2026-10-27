import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { publicFunctionHeaders, sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { Link, useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import EstimateCustomerThankYou from '../components/estimates/EstimateCustomerThankYou'
import { ContractAcceptSignatureForm } from '../components/contracts/ContractAcceptSignatureForm'
import { contractBodyHasRenderableDisplay } from '../lib/contractBodyFormat'
import { ContractBodyDisplay } from '../components/contracts/ContractBodyDisplay'
import { ClausePaper } from '../components/contracts/ClausePaper'
import { CLAUSE_SIGN_WORDS, clauseView, type ClausePaperPayload } from '../lib/contracts/clauseSign'
import type { EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import { ContractFormFill } from '../components/contracts/formFill/ContractFormFill'
import { applyPrefill, schemaForParty, type FormPerson, type FormSchema, type FormValues, validateFormValues } from '../lib/forms/formSchema'
import { partyRegions, type PartyRegion } from '../lib/forms/formParties'
import { errorsByBox, fillString, type FillLang } from '../lib/forms/formFillState'
import { esignConsentText } from '../lib/esignConsent'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { contractLinkErrorWords } from '../lib/contractAcceptLink'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../lib/portal/portalFailure'
import { PortalFailureNote } from '../components/portal/PortalFailureNote'

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

/** Contract Forms (v2.2797): a form row — the signer fills the template's PDF instead of reading a body. */
type FormPayload = {
  schema: FormSchema
  templateUrl: string
  revisionLabel: string | null
  person: FormPerson
  todayLabel: string
  /** Two-party forms (v2.2803): the office's regions, shaded on the page. */
  officeRegions?: PartyRegion[]
}

type LoadPayload = {
  id: string
  person_name: string
  document_name: string
  signing_body_html: string | null
  signing_body_format: string
  canonical_document_url: string | null
  form: FormPayload | null
  /** Messages, cut 4c (v2.5294): the paper built from clauses, in English and Spanish, at the revision signed. */
  clause_paper: ClausePaperPayload | null
}

export default function ContractAccept() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  // What customers see (v2.2760): the sample token renders the sample agreement for a signed-in office user.
  const sample = sampleStateFromToken(token)
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  /** A check the signer can fix, a state the page's own code words (a dead or expired link, a changed paper). */
  const [error, setError] = useState<string | null>(null)
  /** A load or a signature that failed, as kept (v2.5965): its class or the function's own known sentence, never other server text. */
  const [failure, setFailure] = useState<{ cause: PortalFailureCause; from: 'load' | 'sign' } | null>(null)
  /** Bumped by Try again on a failed load: the paper reads again. */
  const [reloadKey, setReloadKey] = useState(0)
  /** The last signature sent, so Try again re-sends exactly it. */
  const lastSignRef = useRef<EstimateAcceptSubmitPayload | null>(null)
  const [payload, setPayload] = useState<LoadPayload | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [thankYouTitle, setThankYouTitle] = useState('Thank you')
  const [thankYouBody, setThankYouBody] = useState('')
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [thankYouCta, setThankYouCta] = useState<ContractThankYouCtaState>({ status: 'waiting_auth' })
  /** Two-party forms (v2.2803): the just-signed document still needs its office section — offered to a signed-in staff member on this device. */
  const [officePendingDocId, setOfficePendingDocId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<FormValues>({})
  const [formLang, setFormLang] = useState<FillLang>('en')
  // Messages, cut 4c (v2.5294): the language a paper built from clauses is read and signed in.
  const [paperLang, setPaperLang] = useState<'en' | 'es'>('en')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

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
      setFailure(null)
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-contract-for-signer?token=${encodeURIComponent(token)}`,
          {
            signal: ac.signal,
            headers: await publicFunctionHeaders(sample),
          },
        )
        const json = (await res.json()) as Omit<LoadPayload, 'form'> & {
          form?: FormPayload | null
          code?: string
          error?: unknown
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
          const own = contractLinkErrorWords(res.status, json.code)
          if (own) setError(own)
          else setFailure({ cause: portalFailureCause(res.status, json, 'open'), from: 'load' })
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
          clause_paper: json.clause_paper && typeof json.clause_paper.revision === 'number' ? json.clause_paper : null,
          // Two-party forms (v2.2802): the signer sees only their boxes; the office's half is completed from the record.
          form: json.form && json.form.schema ? { ...json.form, schema: schemaForParty(json.form.schema, 'signer'), officeRegions: partyRegions(json.form.schema, 'office') } : null,
        })
        if (json.form && json.form.schema) {
          // Office-seeded values (lien waivers, v2.2970): the sender can pre-fill non-sensitive
          // boxes; the signer sees them filled and can change any of them. Roster prefill still
          // fills whatever is left empty.
          const seededRaw = (json.form as { values?: unknown }).values
          const seeded: Record<string, string> = {}
          if (seededRaw && typeof seededRaw === 'object') {
            for (const [k, v] of Object.entries(seededRaw as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) seeded[k] = v
          }
          setFormValues(applyPrefill(schemaForParty(json.form.schema, 'signer'), seeded, json.form.person))
          setFormErrors({})
        }
      } catch (e) {
        if (!ac.signal.aborted) setFailure({ cause: portalFailureKind(e), from: 'load' })
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => ac.abort()
  }, [token, sample, reloadKey])

  async function submitAccept(p: EstimateAcceptSubmitPayload) {
    if (!token) return
    if (!agreed) {
      setError('Please confirm that you agree to the contract.')
      return
    }
    if (sample) {
      // Nothing is saved in sample mode — the walkthrough just moves on to the thank-you.
      setThankYouTitle('Thank you')
      setThankYouBody('')
      setDone(true)
      return
    }
    if (payload?.form) {
      const problems = validateFormValues(payload.form.schema, formValues)
      if (problems.length > 0) {
        setFormErrors(errorsByBox(payload.form.schema, formValues))
        setError(fillString(formLang, 'fixFirst'))
        return
      }
      setFormErrors({})
    }
    setSubmitting(true)
    setError(null)
    setFailure(null)
    lastSignRef.current = p
    try {
      const formPart = payload?.form ? { formValues, formLang } : {}
      // A paper built from clauses signs at the revision the page showed, in the language it was read in.
      const clausePart = payload?.clause_paper && !payload.form ? { paperRevision: payload.clause_paper.revision, paperLang } : {}
      const consentPart = p.consent ? { esignConsent: p.consent } : {}
      const body =
        p.mode === 'type'
          ? { token, printedName: p.printedName, agreedTerms: true as const, ...formPart, ...clausePart, ...consentPart }
          : {
              token,
              printedName: p.printedName,
              signaturePngBase64: p.signaturePngBase64,
              agreedTerms: true as const,
              ...formPart,
              ...clausePart,
              ...consentPart,
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
      const json = (await res.json()) as { ok?: boolean; code?: string; error?: unknown; alreadySigned?: boolean; documentId?: string; officeSectionPending?: boolean }
      if (!res.ok) {
        // The page's own words by the answer's code; anything else by its class or the function's own known sentence.
        if (json.code === 'paper_changed') setError(CLAUSE_SIGN_WORDS[paperLang].changed)
        else if (json.code === 'form_invalid') setError(fillString(formLang, 'fixFirst'))
        else if (json.code === 'expired') setError(contractLinkErrorWords(410, 'expired'))
        else setFailure({ cause: portalFailureCause(res.status, json, 'send'), from: 'sign' })
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
      if (json.officeSectionPending && json.documentId) setOfficePendingDocId(json.documentId)
      setDone(true)
    } catch (e) {
      setFailure({ cause: portalFailureKind(e), from: 'sign' })
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
            {sample ? <SampleModeBanner /> : null}
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
              ) : thankYouCta.status === 'signed_in' && officePendingDocId ? (
                <>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>You are signed in on this device. The office section can be completed now, while the documents are in front of you.</p>
                  <Link to={`/people?tab=contracts&doc=${encodeURIComponent(officePendingDocId)}`} style={contractThankYouPrimaryLinkStyle}>
                    Complete the office section
                  </Link>
                </>
              ) : thankYouCta.status === 'signed_in' && thankYouCta.pendingCount > 0 ? (
                <Link to="/dashboard" style={contractThankYouPrimaryLinkStyle}>
                  Go to dashboard
                </Link>
              ) : thankYouCta.status === 'signed_in' ? (
                <Link to="/dashboard" style={contractThankYouPrimaryLinkStyle}>
                  Return to ClickTooling
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </AuthPublicLandingLayout>
    )
  }

  const loadFailed = failure?.from === 'load' ? portalFailure(failure.cause, 'open') : null
  /** The signer reads the failure in the language of the paper or form they sign. */
  const signLang = payload?.form ? formLang : payload?.clause_paper ? paperLang : 'en'
  const signFailed = failure?.from === 'sign' ? portalFailure(failure.cause, 'send', signLang) : null
  if ((error || loadFailed) && !payload) {
    return (
      <AuthPublicLandingLayout
        titleLinkText="Click Plumbing and Electrical"
        titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
      >
        <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
          <div className="auth-public-landing__signin-box">
            <h1 style={{ fontSize: '1.25rem' }}>Contract</h1>
            <p style={{ color: 'var(--text-red-700)' }}>{error ?? loadFailed?.message}</p>
            <PortalFailureNote failure={error ? null : loadFailed} doorsOnly onTryAgain={() => setReloadKey((n) => n + 1)} />
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
          {sample ? <SampleModeBanner /> : null}
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

          {payload.form ? (
            <ContractFormFill
              schema={payload.form.schema}
              shadedRegions={payload.form.officeRegions ?? []}
              templateUrl={payload.form.templateUrl}
              values={formValues}
              onValuesChange={(next) => {
                setFormValues(next)
                if (Object.keys(formErrors).length > 0) setFormErrors(errorsByBox(payload.form!.schema, next))
              }}
              lang={formLang}
              onLangChange={setFormLang}
              errors={formErrors}
              todayLabel={payload.form.todayLabel}
              signature={printedName.trim() ? { mode: 'type', text: printedName.trim() } : null}
            />
          ) : null}

          {payload.clause_paper && !payload.form ? (
            <div data-clause-sign style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div role="group" aria-label={CLAUSE_SIGN_WORDS[paperLang].language} style={{ display: 'flex', gap: '0.35rem' }}>
                {(['en', 'es'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={paperLang === l}
                    onClick={() => setPaperLang(l)}
                    style={{ padding: '0.25rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: paperLang === l ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    {l === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--bg-subtle)' }}>
                <ClausePaper paper={clauseView(payload.clause_paper[paperLang], payload.document_name)} showTitle={false} />
              </div>
              {hasRenderableSigningBody ? (
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>{CLAUSE_SIGN_WORDS[paperLang].full}</summary>
                  <div style={{ maxHeight: 'min(50vh, 420px)', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--bg-subtle)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    <ContractBodyDisplay format={payload.signing_body_format} bodyHtml={payload.signing_body_html} />
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {hasRenderableSigningBody && !payload.form && !payload.clause_paper ? (
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

          {!hasRenderableSigningBody && !canonical && !payload.form && !payload.clause_paper ? (
            <p style={{ color: 'var(--text-muted)' }}>This link has no contract to read. Ask the office to send it again before you sign.</p>
          ) : null}

          <ContractAcceptSignatureForm
            printedName={printedName}
            agreed={agreed}
            onPrintedNameChange={setPrintedName}
            onAgreedChange={setAgreed}
            formError={error ?? signFailed?.message ?? null}
            submitting={submitting}
            onSubmit={(p) => void submitAccept(p)}
            consent={esignConsentText({
              audience: 'sub',
              lang: payload.form ? formLang : payload.clause_paper ? paperLang : 'en',
              documentNoun: payload.form ? (formLang === 'es' ? 'este formulario' : 'this form') : payload.clause_paper ? CLAUSE_SIGN_WORDS[paperLang].noun : 'this agreement',
            })}
            {...(payload.form
              ? {
                  heading: fillString(formLang, 'signHeading'),
                  disclosure: fillString(formLang, 'disclosure'),
                  agreeLabel: fillString(formLang, 'agree'),
                  submitLabel: fillString(formLang, 'submit'),
                }
              : payload.clause_paper && paperLang === 'es'
                ? {
                    heading: CLAUSE_SIGN_WORDS.es.heading,
                    disclosure: CLAUSE_SIGN_WORDS.es.disclosure,
                    agreeLabel: CLAUSE_SIGN_WORDS.es.agree,
                    submitLabel: CLAUSE_SIGN_WORDS.es.submit,
                  }
                : {})}
          />
          <PortalFailureNote
            failure={signFailed}
            lang={signLang}
            doorsOnly
            onTryAgain={() => lastSignRef.current && void submitAccept(lastSignRef.current)}
            busy={submitting}
            style={{ marginTop: '0.5rem' }}
          />
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}
