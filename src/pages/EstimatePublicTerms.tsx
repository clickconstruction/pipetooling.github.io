import { useEffect, useState } from 'react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export default function EstimatePublicTerms() {
  const [body, setBody] = useState<string | null>(null)
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
        const json = (await res.json()) as { error?: string; body?: string }
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Unable to load terms.')
          setBody(null)
          return
        }
        setBody(typeof json.body === 'string' ? json.body : '')
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
    <div data-theme="light" style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
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
    </div>
  )
}
