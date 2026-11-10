import { useEffect, useState, type CSSProperties } from 'react'
import { funnelLines, funnelTiles, funnelVerdict, type PermitFunnel } from '../../lib/research/permitBuilders'
import { loadPermitFunnel } from '../../lib/research/permitResearchIo'

/**
 * Permits, the count (punch list #302, PR 8): what arrived this month, what was skimmed and how
 * it was answered, and what became a bid. One strip, so a month in anyone can see whether the
 * skim turns into work or is busywork. Shows nothing until the read exists and answers.
 */
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '8px 4px', textAlign: 'center', minWidth: 0 }

export function PermitCountStrip({ city, todayYmd, refreshKey }: { city: string; todayYmd: string; /** Changes when an answer is written, so the count reads again. */ refreshKey: number }) {
  const [funnel, setFunnel] = useState<PermitFunnel | null>(null)
  const since = `${todayYmd.slice(0, 8)}01`

  useEffect(() => {
    let live = true
    loadPermitFunnel(city, since)
      .then((f) => live && setFunnel(f))
      .catch(() => live && setFunnel(null))
    return () => {
      live = false
    }
  }, [city, since, refreshKey])

  if (!funnel) return null
  const month = new Date(`${since}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const lines = funnelLines(funnel)
  const verdict = funnelVerdict(funnel)

  return (
    <section aria-label="The count" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Permits, {month} so far</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {funnelTiles(funnel).map((t) => (
          <div key={t.words} style={tile}>
            <strong style={{ display: 'block', fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>{t.n}</strong>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{t.words}</span>
          </div>
        ))}
      </div>
      {(lines.length > 0 || verdict) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'minmax(84px, 110px) minmax(0, 1fr)', gap: '3px 10px', fontSize: '0.8125rem' }}>
          {lines.map((l) => (
            <span key={l.label} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.words}</span>
            </span>
          ))}
          {verdict && <span style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>{verdict}</span>}
        </div>
      )}
    </section>
  )
}
