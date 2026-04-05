import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EstimateCustomerThankYou from '../components/estimates/EstimateCustomerThankYou'
import EstimateAcceptBody, { type EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import type { EstimateCustomerExperienceClient } from '../lib/estimateCustomerExperience'
import {
  fallbackClientCustomerExperience,
  parseCustomerExperienceClient,
} from '../lib/estimateCustomerExperience'
import type { EstimateAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { parseAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type PublicEstimate = {
  id: string
  title: string
  for_line: string | null
  line_items_snapshot: unknown
  terms_snapshot: string
  total_cents: number
  valid_until: string | null
}

export default function EstimateAccept() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null)
  const [experience, setExperience] = useState<EstimateCustomerExperienceClient>(
    fallbackClientCustomerExperience(),
  )
  const [alreadyAccepted, setAlreadyAccepted] = useState(false)
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [headerBrand, setHeaderBrand] = useState<EstimateAcceptHeaderBrand | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('This link is missing required information.')
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-estimate-for-customer?token=${encodeURIComponent(token)}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
        )
        const json = (await res.json()) as {
          error?: string
          code?: string
          customer_experience?: unknown
        } & Partial<PublicEstimate>
        if (cancelled) return
        if (!res.ok) {
          if (json.code === 'already_accepted') {
            const cx = parseCustomerExperienceClient(json.customer_experience) ?? fallbackClientCustomerExperience()
            if (!cancelled) {
              setExperience(cx)
              setAlreadyAccepted(true)
              setEstimate(null)
            }
            setLoading(false)
            return
          }
          setError(json.error || 'Unable to load estimate.')
          setEstimate(null)
          setLoading(false)
          return
        }
        const cx = parseCustomerExperienceClient(json.customer_experience) ?? fallbackClientCustomerExperience()
        if (!cancelled) {
          setExperience(cx)
          const fl = json.for_line
          setHeaderBrand(parseAcceptHeaderBrand((json as { accept_header_brand?: unknown }).accept_header_brand))
          setEstimate({
            id: String(json.id),
            title: String(json.title ?? ''),
            for_line: typeof fl === 'string' ? fl.trim() || null : fl ?? null,
            line_items_snapshot: json.line_items_snapshot,
            terms_snapshot: String(json.terms_snapshot ?? ''),
            total_cents: Number(json.total_cents ?? 0),
            valid_until: json.valid_until ?? null,
          })
        }
      } catch {
        if (!cancelled) setError('Could not load estimate. Check your connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function submitAccept(payload: EstimateAcceptSubmitPayload) {
    if (!token || !estimate) return
    if (!agreed) {
      setError('Please confirm that you agree to the terms.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body =
        payload.mode === 'type'
          ? { token, printedName: payload.printedName, agreedTerms: true as const }
          : {
              token,
              printedName: payload.printedName,
              signaturePngBase64: payload.signaturePngBase64,
              agreedTerms: true as const,
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
      const json = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(json.error || 'Could not record acceptance.')
        return
      }
      setDone(true)
    } catch {
      setError('Could not record acceptance. Try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <p>Loading…</p>
      </div>
    )
  }

  if (done || alreadyAccepted) {
    return (
      <EstimateCustomerThankYou title={experience.thankYouTitle} body={experience.thankYouBody} />
    )
  }

  if (error && !estimate) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <h1>{experience.docTitleFallback}</h1>
        <p style={{ color: '#b91c1c' }}>{error}</p>
      </div>
    )
  }

  if (!estimate) return null

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <EstimateAcceptBody
        variant="interactive"
        estimate={{
          title: estimate.title,
          for_line: estimate.for_line,
          valid_until: estimate.valid_until,
          line_items_snapshot: estimate.line_items_snapshot,
          terms_snapshot: estimate.terms_snapshot,
          total_cents: estimate.total_cents,
        }}
        experience={experience}
        printedName={printedName}
        agreed={agreed}
        onPrintedNameChange={setPrintedName}
        onAgreedChange={setAgreed}
        formError={error}
        submitting={submitting}
        onSubmit={(p) => void submitAccept(p)}
        headerBrand={headerBrand}
      />
    </div>
  )
}
