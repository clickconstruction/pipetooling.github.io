import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isMissingRpcError } from '../../lib/customers/customersListBundle'
import { healthTiles, parseJourneyHealthCounts, type HealthTile } from '../../lib/journeys/journeyHealth'

/**
 * The health row (v2.3513): the journey for everyone at once — per step, how many outside
 * people are at it and how many are stuck, with the door that moves them. One read-only RPC;
 * the row hides itself until the function is live in the database.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function JourneyHealthRow() {
  const [state, setState] = useState<{ tiles: HealthTile[] | null; hidden: boolean; error: string | null }>({ tiles: null, hidden: false, error: null })
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.rpc('journey_health_counts' as never)
      if (cancelled) return
      if (error) {
        // Before the migration is pushed the function does not exist; the row simply stays away.
        setState({ tiles: null, hidden: isMissingRpcError(error.message), error: isMissingRpcError(error.message) ? null : error.message })
        return
      }
      const parsed = parseJourneyHealthCounts(data)
      setState({ tiles: parsed ? healthTiles(parsed) : null, hidden: !parsed, error: null })
    })()
    return () => {
      cancelled = true
    }
  }, [])
  if (state.hidden) return null
  return (
    <div style={CARD} data-testid="journey-health">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Where people are, all at once</h3>
        <span style={MUTED}>per step: how many are there and how many are stuck — the Needs You doors, grouped by where the customer is</span>
      </div>
      {state.error ? <div style={{ ...MUTED, color: 'var(--text-red-700)' }}>{state.error}</div> : null}
      {!state.tiles && !state.error ? <div style={MUTED}>Counting…</div> : null}
      {state.tiles ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
          {state.tiles.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--bg-page)', borderLeft: t.attention ? '3px solid var(--border-amber)' : '1px solid var(--border)' }} data-attention={t.attention ? '1' : '0'}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.label}</div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-strong)', margin: '0.25rem 0 0.35rem', lineHeight: 1.3 }}>{t.line}</div>
              <Link to={t.door.to} style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
                {t.door.label} →
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
