import { useEffect, useRef, useState, type ReactNode } from 'react'
import { publicFunctionHeaders, sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import EstimateCustomerThankYou from '../components/estimates/EstimateCustomerThankYou'
import EstimateAcceptBody, { type EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import {
  defaultEstimateSelection,
  estimateSelectionProblemMessage,
  isValidEstimateSelection,
  normalizeEstimateOptionsFromJson,
  toggleEstimateOptionSelection,
  type EstimateOption,
} from '../lib/estimates/estimateOptions'
import type { EstimateCustomerExperienceClient } from '../lib/estimateCustomerExperience'
import {
  fallbackClientCustomerExperience,
  parseCustomerExperienceClient,
} from '../lib/estimateCustomerExperience'
import type { EstimateAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { parseAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import type { CustomerAttachmentPayload } from '../lib/estimateCustomerAttachment'
import { supabase } from '../lib/supabase'
import { estimateCustomerFetchQuery, isEstimateViewStaffPreview } from '../lib/estimateViewPreview'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../lib/portal/portalFailure'
import { PortalFailureNote } from '../components/portal/PortalFailureNote'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** The estimate's own words for an answer coded `expired`, on the load and on a send. */
const EXPIRED_WORDS = 'This link has expired. Reply to our email or call the office and we will send a fresh one.'

type PublicEstimate = {
  id: string
  title: string
  for_line: string | null
  line_items_snapshot: unknown
  terms_snapshot: string
  total_cents: number
  valid_until: string | null
  customer_attachment: CustomerAttachmentPayload | null
  doc_kind: string | null
  change_order_fields: unknown
}

function PublicEstimateShell({ children }: { children: ReactNode }) {
  return (
    <AuthPublicLandingLayout
      titleLinkText="Click Plumbing and Electrical"
      titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
      compact
    >
      <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
        <div className="auth-public-landing__signin-box">{children}</div>
      </div>
    </AuthPublicLandingLayout>
  )
}

export default function EstimateAccept() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  // v2.2873 (journey-map #34/#37): the office's Open customer link appends ?preview=1 so its
  // own look is not stamped as a customer open; a signed-in staff session counts the same way.
  const previewParam = isEstimateViewStaffPreview(params, false)
  // What customers see (v2.2758): the sample token renders the fixture for a signed-in office user.
  const sample = sampleStateFromToken(token)

  const [loading, setLoading] = useState(true)
  /** A check the customer can fix, a state the estimate's own code words, or a broken link. */
  const [error, setError] = useState<string | null>(null)
  /** A load, an approval or a decline that failed, as kept (v2.5965): its class or the function's own known sentence, never other server text. */
  const [failure, setFailure] = useState<{ cause: PortalFailureCause; from: 'load' | 'accept' | 'decline' } | null>(null)
  /** The estimate's own words for a send its code names (`expired`), shown where that send's line shows. */
  const [sendWords, setSendWords] = useState<{ from: 'accept' | 'decline'; text: string } | null>(null)
  /** The last decline, so Try again re-sends exactly it (an approval's own Submit stays in its window). */
  const lastDeclineRef = useRef<(() => Promise<void>) | null>(null)
  /** Bumped by Try again on a failed load: the estimate reads again. */
  const [reloadKey, setReloadKey] = useState(0)
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null)
  const [experience, setExperience] = useState<EstimateCustomerExperienceClient>(
    fallbackClientCustomerExperience(),
  )
  const [alreadyAccepted, setAlreadyAccepted] = useState(false)
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // v2.2873: the customer's "No thanks" (J17-F6).
  const [declined, setDeclined] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [headerBrand, setHeaderBrand] = useState<EstimateAcceptHeaderBrand | null>(null)
  // Estimate Options (v2.2460): 2+ options render the picker; the selection rides the accept POST.
  // v2.3555: a set — the choice plus any ticked add-ons (the ★ choice to start, no add-ons).
  const [options, setOptions] = useState<EstimateOption[]>([])
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<string[]>([])

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
        let staffSession = false
        try {
          const { data: sess } = await supabase.auth.getSession()
          staffSession = Boolean(sess.session)
        } catch {
          staffSession = false
        }
        if (ac.signal.aborted) return
        const preview = isEstimateViewStaffPreview(previewParam ? '?preview=1' : '', staffSession)
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-estimate-for-customer?${estimateCustomerFetchQuery(token, preview)}`,
          {
            signal: ac.signal,
            headers: await publicFunctionHeaders(sample),
          },
        )
        const json = (await res.json()) as {
          code?: string
          error?: unknown
          customer_experience?: unknown
          customer_attachment?: CustomerAttachmentPayload | null
        } & Partial<PublicEstimate>
        if (ac.signal.aborted) return
        if (!res.ok) {
          if (json.code === 'already_accepted') {
            const cx = parseCustomerExperienceClient(json.customer_experience) ?? fallbackClientCustomerExperience()
            if (!ac.signal.aborted) {
              setExperience(cx)
              setAlreadyAccepted(true)
              setEstimate(null)
            }
            setLoading(false)
            return
          }
          // The estimate's own codes keep their words; anything else reads by its class or the function's own known sentence.
          if (json.code === 'expired') setError(EXPIRED_WORDS)
          else setFailure({ cause: portalFailureCause(res.status, json, 'open'), from: 'load' })
          setEstimate(null)
          setLoading(false)
          return
        }
        const cx = parseCustomerExperienceClient(json.customer_experience) ?? fallbackClientCustomerExperience()
        if (!ac.signal.aborted) {
          setExperience(cx)
          const fl = json.for_line
          setHeaderBrand(parseAcceptHeaderBrand((json as { accept_header_brand?: unknown }).accept_header_brand))
          const att = json.customer_attachment
          const customer_attachment: CustomerAttachmentPayload | null =
            att &&
            typeof att === 'object' &&
            typeof att.url === 'string' &&
            att.url.startsWith('https://')
              ? {
                  url: att.url,
                  label: typeof att.label === 'string' ? att.label : null,
                }
              : null
          const parsedOptions = normalizeEstimateOptionsFromJson((json as { options?: unknown }).options)
          setOptions(parsedOptions)
          setSelectedOptionKeys(defaultEstimateSelection(parsedOptions))
          setEstimate({
            id: String(json.id),
            title: String(json.title ?? ''),
            for_line: typeof fl === 'string' ? fl.trim() || null : fl ?? null,
            line_items_snapshot: json.line_items_snapshot,
            terms_snapshot: String(json.terms_snapshot ?? ''),
            total_cents: Number(json.total_cents ?? 0),
            valid_until: json.valid_until ?? null,
            customer_attachment,
            doc_kind: typeof (json as { doc_kind?: unknown }).doc_kind === 'string' ? (json as { doc_kind: string }).doc_kind : null,
            change_order_fields: (json as { change_order_fields?: unknown }).change_order_fields ?? null,
          })
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!ac.signal.aborted) setFailure({ cause: portalFailureKind(err), from: 'load' })
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => ac.abort()
  }, [token, sample, previewParam, reloadKey])

  async function submitAccept(payload: EstimateAcceptSubmitPayload) {
    if (!token || !estimate) return
    if (!agreed) {
      setError('Please confirm that you agree to the terms.')
      return
    }
    if (sample) {
      // Nothing is saved in sample mode — the walkthrough just moves on to the thank-you.
      setDone(true)
      return
    }
    setSubmitting(true)
    setError(null)
    setFailure(null)
    setSendWords(null)
    try {
      // v2.3555: the selection rides as BOTH shapes — `optionKeys` (the whole selection) for a
      // server that knows add-ons and `optionKey` (the choice, or the one key) for one that
      // predates them — so the page never depends on which deploy landed first.
      let optionPart: { optionKey?: string; optionKeys?: string[] } = {}
      if (options.length >= 2) {
        const verdict = isValidEstimateSelection(options, selectedOptionKeys)
        if (!verdict.ok) {
          setError(estimateSelectionProblemMessage(options, verdict.reason))
          return
        }
        const choiceKey = options.find((o) => o.kind === 'choice' && selectedOptionKeys.includes(o.key))?.key ?? selectedOptionKeys[0]
        optionPart = { ...(choiceKey ? { optionKey: choiceKey } : {}), optionKeys: selectedOptionKeys }
      }
      const consentPart = payload.consent ? { esignConsent: payload.consent } : {}
      const body =
        payload.mode === 'type'
          ? { token, printedName: payload.printedName, agreedTerms: true as const, ...optionPart, ...consentPart }
          : {
              token,
              printedName: payload.printedName,
              signaturePngBase64: payload.signaturePngBase64,
              agreedTerms: true as const,
              ...optionPart,
              ...consentPart,
            }
      const res = await fetch(`${supabaseUrl}/functions/v1/accept-estimate`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { code?: string; error?: unknown } | null
        if (json?.code === 'expired') setSendWords({ from: 'accept', text: EXPIRED_WORDS })
        else setFailure({ cause: portalFailureCause(res.status, json, 'send'), from: 'accept' })
        return
      }
      setDone(true)
    } catch (e) {
      setFailure({ cause: portalFailureKind(e), from: 'accept' })
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * v2.2873 (J17-F6): "No thanks" → accept-estimate with action: 'decline'. The office sees
   * the row move to the Pipeline's Declined bucket and a "Declined by customer" activity line.
   */
  async function submitDecline(reason: string) {
    if (!token || !estimate || declining) return
    if (sample) {
      setDeclined(true)
      return
    }
    setDeclining(true)
    setError(null)
    setFailure(null)
    setSendWords(null)
    lastDeclineRef.current = () => submitDecline(reason)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/accept-estimate`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, action: 'decline', declineReason: reason }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { code?: string; error?: unknown } | null
        if (json?.code === 'expired') setSendWords({ from: 'decline', text: EXPIRED_WORDS })
        else setFailure({ cause: portalFailureCause(res.status, json, 'send'), from: 'decline' })
        return
      }
      setDeclined(true)
    } catch (e) {
      setFailure({ cause: portalFailureKind(e), from: 'decline' })
    } finally {
      setDeclining(false)
    }
  }

  if (loading) {
    return (
      <PublicEstimateShell>
        <p>Loading…</p>
      </PublicEstimateShell>
    )
  }

  if (declined) {
    return (
      <PublicEstimateShell>
        {sample ? <SampleModeBanner /> : null}
        <div className="auth-public-landing__estimate-thankyou-inner">
          <EstimateCustomerThankYou
            title="Thanks for letting us know"
            body="We've marked this estimate as declined and won't follow up on it. If anything changes, just reply to the email and we'll pick it right back up."
          />
        </div>
      </PublicEstimateShell>
    )
  }

  if (done || alreadyAccepted) {
    return (
      <PublicEstimateShell>
        {sample ? <SampleModeBanner /> : null}
        <div className="auth-public-landing__estimate-thankyou-inner">
          <EstimateCustomerThankYou title={experience.thankYouTitle} body={experience.thankYouBody} />
        </div>
      </PublicEstimateShell>
    )
  }

  const failed = failure ? portalFailure(failure.cause, failure.from === 'load' ? 'open' : 'send') : null
  if ((error || failed) && !estimate) {
    return (
      <PublicEstimateShell>
        <h1>{experience.docTitleFallback}</h1>
        <p style={{ color: 'var(--text-red-700)' }}>{error ?? failed?.message}</p>
        <PortalFailureNote
          failure={error ? null : failed}
          doorsOnly
          onTryAgain={() => setReloadKey((n) => n + 1)}
        />
      </PublicEstimateShell>
    )
  }

  if (!estimate) return null

  return (
    <PublicEstimateShell>
      {sample ? <SampleModeBanner /> : null}
      <EstimateAcceptBody
        variant="interactive"
        estimate={{
          title: estimate.title,
          for_line: estimate.for_line,
          valid_until: estimate.valid_until,
          line_items_snapshot: estimate.line_items_snapshot,
          terms_snapshot: estimate.terms_snapshot,
          total_cents: estimate.total_cents,
          doc_kind: estimate.doc_kind,
          change_order_fields: estimate.change_order_fields,
        }}
        experience={experience}
        printedName={printedName}
        agreed={agreed}
        onPrintedNameChange={setPrintedName}
        onAgreedChange={setAgreed}
        formError={error ?? (sendWords?.from === 'accept' ? sendWords.text : null) ?? (failure?.from === 'accept' ? (failed?.message ?? null) : null)}
        submitting={submitting}
        onSubmit={(p) => void submitAccept(p)}
        options={options}
        selectedOptionKeys={selectedOptionKeys}
        onToggleOption={(key) => {
          const next = toggleEstimateOptionSelection(options, selectedOptionKeys, key)
          setSelectedOptionKeys(next)
          // An add-on un-ticked is not a look; only a card turning on is worth a row.
          if (sample || !next.includes(key)) return
          // Phase 3 (v2.2462): tell the office which options the customer weighed — the
          // activity feed's "Viewed option — Tankless upgrade" rows. Fire-and-forget;
          // browsing must never depend on it.
          void fetch(`${supabaseUrl}/functions/v1/log-estimate-option-view`, {
            method: 'POST',
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, optionKey: key }),
          }).catch(() => undefined)
        }}
        headerBrand={headerBrand}
        customerAttachment={estimate.customer_attachment}
        onDecline={(reason) => void submitDecline(reason)}
        declining={declining}
      />
      {/* A decline's failure: before, it went to the approval window's line, which is closed while declining. */}
      {sendWords?.from === 'decline' ? (
        <p role="alert" style={{ margin: '0.75rem 0 0', textAlign: 'center', color: 'var(--text-red-700)', fontSize: '0.9rem' }}>
          {sendWords.text}
        </p>
      ) : null}
      <PortalFailureNote
        failure={failure?.from === 'decline' ? failed : null}
        onTryAgain={() => void lastDeclineRef.current?.()}
        busy={declining}
        style={{ marginTop: '0.75rem', justifyContent: 'center' }}
        messageStyle={{ color: 'var(--text-red-700)', fontSize: '0.9rem' }}
      />
    </PublicEstimateShell>
  )
}
