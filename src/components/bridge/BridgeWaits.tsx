import { useState, type CSSProperties } from 'react'
import type { Reflex, ReflexId, ReflexLine } from '../../lib/bridge/waits'

/**
 * Everything else waits (link PR 7): the four usual fixes as presses, one per
 * row, each setting the dial to what the fix would do; the pressed one shows
 * its result line. A "?" in the corner keeps the old list of the other
 * links' levers. The footer says when they come back.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function BridgeWaits({ reflexes, activeId, line, levers, onPress, onReset }: { reflexes: Reflex[]; activeId: ReflexId | null; line: ReflexLine | null; levers: Array<{ id: string; name: string; lever: string }>; onPress: (id: ReflexId) => void; onReset: () => void }) {
  const [leversOpen, setLeversOpen] = useState(false)
  return (
    <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }} data-testid="bridge-waits">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={label}>Everything else waits</span>
        <button
          type="button"
          onFocus={() => setLeversOpen(true)}
          onBlur={() => setLeversOpen(false)}
          onClick={() => setLeversOpen((o) => !o)}
          aria-label="The other links' levers"
          aria-expanded={leversOpen}
          style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', lineHeight: 1, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ?
        </button>
      </div>
      {leversOpen && (
        <div role="tooltip" style={{ position: 'absolute', right: 12, top: 44, zIndex: 5, width: 'min(360px, calc(100% - 24px))', background: 'var(--text-base)', color: 'var(--surface)', padding: '0.7rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', lineHeight: 1.45, boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }} data-testid="bridge-waits-levers">
          <div style={{ ...label, color: 'var(--border)', marginBottom: 6 }}>The other links' levers, greyed until the link moves</div>
          {levers.map((l) => (
            <div key={l.id} style={{ padding: '0.2rem 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <b>{l.name}</b> <span style={{ color: 'var(--border)' }}>· {l.lever}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ ...det, marginBottom: 4 }}>the usual fixes. Press one; the cards and the dial above show what it does.</div>
      {reflexes.map((r) => {
        const on = r.id === activeId
        return (
          <div key={r.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => onPress(r.id)}
              aria-pressed={on}
              disabled={r.stage != null && r.usd == null}
              data-testid={`bridge-waits-${r.id}`}
              style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: on ? 600 : 400, padding: '0.25rem 0.75rem', borderRadius: 999, cursor: 'pointer', minHeight: 28, border: on ? '2px solid var(--text-amber-800)' : '1px solid var(--border)', background: on ? 'var(--bg-amber-tint, var(--surface))' : 'var(--surface)', color: on ? 'var(--text-amber-800)' : 'var(--text)' }}
            >
              {r.label}
            </button>
            {on && line && (
              <div style={{ marginTop: 6, fontSize: '0.82rem', padding: '0.4rem 0.6rem', borderRadius: 6, border: `1px solid ${line.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--border)'}`, color: line.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text)', background: 'var(--surface)' }} data-testid="bridge-waits-line">
                {line.text}
              </div>
            )}
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', ...det }}>
        <span>They come back when the link moves. Friday asks whether it did.</span>
        {activeId && (
          <button type="button" onClick={onReset} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }} data-testid="bridge-waits-reset">
            back to today
          </button>
        )}
      </div>
    </div>
  )
}
