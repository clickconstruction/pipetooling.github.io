import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import { LEGAL_CONFIRM_EXPIRED_REASON, legalConfirmedPageBody, legalUnsubscribedPageBody } from '../lib/legalEmails'
import { sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { pt } from '../lib/gc/portalI18n'
import { knownPortalRefusal, portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../lib/portal/portalFailure'
import { PortalFailureNote } from '../components/portal/PortalFailureNote'

/**
 * The two plain pages behind the law firm's email links (v2.3521): `/legal/confirm?t=<token>`
 * confirms a recipient, `&stop=1` pauses them. The function used to serve these pages itself,
 * but the platform relays its HTML as text/plain, so recipients saw page source; the function
 * now answers JSON for this page (`&json=1`) and redirects its old links here. Same words as
 * before, from the same builder. The sample token renders Ann Sample's pages without a call.
 *
 * A failure reads by its class (v2.5965): a lost signal says *No connection* with Try again, an
 * answer the page cannot read is a refusal or a gone link, never *That link has expired*. An
 * expired answer's reason shows only when it is one the function writes (`knownPortalRefusal`).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type Answer = { kind: 'confirmed'; name: string; email: string } | { kind: 'unsubscribed'; name: string } | { kind: 'expired'; reason?: string }

function bodyFor(a: Answer, stop: boolean): string {
  if (a.kind === 'confirmed') return legalConfirmedPageBody(PORTAL_COMPANY.name, a.name, a.email)
  if (a.kind === 'unsubscribed') return legalUnsubscribedPageBody(PORTAL_COMPANY.name, a.name)
  const known = knownPortalRefusal(a.reason)
  const reason = known ? pt('en', known) : stop ? 'Use the link in a newer email, or stop emails from the portal.' : LEGAL_CONFIRM_EXPIRED_REASON
  return `<h1>That link has expired.</h1><p>${reason.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`
}

export default function LegalConfirm() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const stop = params.get('stop') === '1'
  const sample = sampleStateFromToken(token)
  const [answer, setAnswer] = useState<Answer | null>(() => (sample ? (stop ? { kind: 'unsubscribed', name: 'Ann Sample' } : { kind: 'confirmed', name: 'Ann Sample', email: 'ann@samplepartner.example.com' }) : null))
  /** The link did not answer, as kept: its class or the function's own known sentence. */
  const [failed, setFailed] = useState<PortalFailureCause | null>(null)
  /** Bumped by Try again: the link is asked again. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (sample || !token) return
    let cancelled = false
    void (async () => {
      try {
        const q = stop ? `unsubscribe=${encodeURIComponent(token)}` : `confirm=${encodeURIComponent(token)}`
        const res = await fetch(`${supabaseUrl}/functions/v1/legal-notify-dispatch?${q}&json=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } })
        const body = (await res.json().catch(() => null)) as Answer | null
        if (cancelled) return
        if (body && (body.kind === 'confirmed' || body.kind === 'unsubscribed' || body.kind === 'expired')) setAnswer(body)
        // An answer the page cannot read is a refusal or a gone link, never an expired link it did not say.
        else setFailed(res.ok ? 'refused' : portalFailureCause(res.status, body, 'open'))
      } catch (e) {
        if (!cancelled) setFailed(portalFailureKind(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, stop, sample, reloadKey])

  const failure = failed ? portalFailure(failed, 'open') : null
  const body = !token
    ? '<h1>Nothing to do.</h1><p>This page only answers the links in the firm\'s emails.</p>'
    : answer
      ? bodyFor(answer, stop)
      : failure
        ? null
        : '<p>One moment…</p>'

  return (
    <div data-theme="light" style={{ minHeight: '100vh', margin: 0, padding: '40px 20px', background: '#f6f3ec', color: '#16283c', font: "16px/1.5 -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <main style={{ maxWidth: 520, margin: '0 auto', background: '#fdfcf9', border: '1px solid #ddd6c8', borderRadius: 8, padding: 24 }}>
        {sample ? <SampleModeBanner /> : null}
        {body != null ? (
          <div className="legal-confirm-body" dangerouslySetInnerHTML={{ __html: body }} />
        ) : failure ? (
          <div className="legal-confirm-body" role="alert">
            <h1>{failure.title}</h1>
            {failure.detail ? <p>{failure.detail}</p> : null}
            <PortalFailureNote
              failure={failure}
              doorsOnly
              onTryAgain={() => {
                setFailed(null)
                setReloadKey((n) => n + 1)
              }}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}
