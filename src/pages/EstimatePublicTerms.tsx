import { useEffect, useState } from 'react'
import { esignDisclosureSections, ESIGN_CONSENT_VERSION } from '../lib/esignConsent'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export default function EstimatePublicTerms() {
  const [body, setBody] = useState<string | null>(null)
  // v2.3100: the office contact printed at the foot of the electronic-signatures disclosure.
  const [issuer, setIssuer] = useState<{ companyName: string; phone: string; email: string; addressText: string } | null>(null)
  const lang: 'en' | 'es' = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lang') === 'es' ? 'es' : 'en'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-estimate-public-terms`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        })
        const json = (await res.json()) as { error?: string; body?: string; issuer?: { companyName?: string; phone?: string; email?: string; addressText?: string } | null }
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Unable to load terms.')
          setBody(null)
          return
        }
        setBody(typeof json.body === 'string' ? json.body : '')
        const i = json.issuer
        setIssuer(i && typeof i === 'object' ? { companyName: i.companyName ?? '', phone: i.phone ?? '', email: i.email ?? '', addressText: i.addressText ?? '' } : null)
      } catch {
        if (!cancelled) {
          setError('Could not load terms. Check your connection.')
          setBody(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', minHeight: '100vh', boxSizing: 'border-box' }}>
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Terms and Conditions</h1>
      {loading ? <p>Loading…</p> : null}
      {error ? <p style={{ color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!loading && !error ? (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            color: 'var(--text-strong)',
          }}
        >
          {body === '' || body == null ? 'No terms have been published yet.' : body}
        </div>
      ) : null}

      <section id="electronic-signatures" aria-labelledby="esign-heading" style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <h2 id="esign-heading" style={{ fontSize: '1.25rem', margin: '0 0 0.25rem' }}>{lang === 'es' ? 'Firmas y registros electrónicos' : 'Electronic signatures and records'}</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {lang === 'es' ? `Versión ${ESIGN_CONSENT_VERSION}` : `Version ${ESIGN_CONSENT_VERSION}`}
          {issuer?.companyName ? ` · ${issuer.companyName}` : ''}
          {' · '}
          <a href={lang === 'es' ? '/estimate/terms#electronic-signatures' : '/estimate/terms?lang=es#electronic-signatures'} style={{ color: 'var(--text-link)' }}>
            {lang === 'es' ? 'English' : 'Español'}
          </a>
        </p>
        {esignDisclosureSections({
          lang,
          companyName: issuer?.companyName ?? null,
          contactLine: issuer ? [issuer.companyName, issuer.phone, issuer.email, issuer.addressText].filter((x) => x.trim()).join(' · ') : null,
        }).map((sec, i) => (
          <div key={i} style={{ marginTop: sec.heading ? '0.9rem' : 0 }}>
            {sec.heading ? (
              <h3 style={{ fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.25rem' }}>{sec.heading}</h3>
            ) : null}
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--text-strong)' }}>{sec.body}</p>
          </div>
        ))}
      </section>
    </div>
    </div>
  )
}
