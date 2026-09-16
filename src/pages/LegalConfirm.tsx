import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import { legalConfirmedPageBody, legalUnsubscribedPageBody } from '../lib/legalEmails'
import { sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'

/**
 * The two plain pages behind the law firm's email links (v2.3521): `/legal/confirm?t=<token>`
 * confirms a recipient, `&stop=1` pauses them. The function used to serve these pages itself,
 * but the platform relays its HTML as text/plain, so recipients saw page source; the function
 * now answers JSON for this page (`&json=1`) and redirects its old links here. Same words as
 * before, from the same builder. The sample token renders Ann Sample's pages without a call.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type Answer = { kind: 'confirmed'; name: string; email: string } | { kind: 'unsubscribed'; name: string } | { kind: 'expired'; reason?: string }

function bodyFor(a: Answer, stop: boolean): string {
  if (a.kind === 'confirmed') return legalConfirmedPageBody(PORTAL_COMPANY.name, a.name, a.email)
  if (a.kind === 'unsubscribed') return legalUnsubscribedPageBody(PORTAL_COMPANY.name, a.name)
  const reason = a.reason ?? (stop ? 'Use the link in a newer email, or stop emails from the portal.' : 'Ask someone at the firm to add you again from the portal.')
  return `<h1>That link has expired.</h1><p>${reason.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`
}

export default function LegalConfirm() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const stop = params.get('stop') === '1'
  const sample = sampleStateFromToken(token)
  const [answer, setAnswer] = useState<Answer | null>(() => (sample ? (stop ? { kind: 'unsubscribed', name: 'Ann Sample' } : { kind: 'confirmed', name: 'Ann Sample', email: 'ann@samplepartner.example.com' }) : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (sample || !token) return
    let cancelled = false
    void (async () => {
      try {
        const q = stop ? `unsubscribe=${encodeURIComponent(token)}` : `confirm=${encodeURIComponent(token)}`
        const res = await fetch(`${supabaseUrl}/functions/v1/legal-notify-dispatch?${q}&json=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } })
        const body = (await res.json().catch(() => null)) as Answer | null
        if (cancelled) return
        setAnswer(body && (body.kind === 'confirmed' || body.kind === 'unsubscribed' || body.kind === 'expired') ? body : { kind: 'expired' })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, stop, sample])

  const body = !token
    ? '<h1>Nothing to do.</h1><p>This page only answers the links in the firm\'s emails.</p>'
    : failed
      ? '<h1>Could not reach the office.</h1><p>Check your connection and open the link again.</p>'
      : answer
        ? bodyFor(answer, stop)
        : '<p>One moment…</p>'

  return (
    <div data-theme="light" style={{ minHeight: '100vh', margin: 0, padding: '40px 20px', background: '#f6f3ec', color: '#16283c', font: "16px/1.5 -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <main style={{ maxWidth: 520, margin: '0 auto', background: '#fdfcf9', border: '1px solid #ddd6c8', borderRadius: 8, padding: 24 }}>
        {sample ? <SampleModeBanner /> : null}
        <div className="legal-confirm-body" dangerouslySetInnerHTML={{ __html: body }} />
      </main>
    </div>
  )
}
