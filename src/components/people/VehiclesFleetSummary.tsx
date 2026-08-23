import type React from 'react'
import type { FleetAttentionItem } from '../../lib/vehicleFleetAttention'

/**
 * Fleet strip for People → Vehicles (v2.2169): one quiet FACTS line (counts
 * that describe the fleet, with the Insurance plans link riding on the
 * insurance fact) and a NEEDS ATTENTION card (counts that ask for work — red
 * before amber; rows that open a catch-up list carry a chevron). A list on
 * phones; from 720px the rows flow into tiles. Hidden entirely when nothing
 * needs attention, except a quiet "caught up" line.
 */
export function VehiclesFleetSummary({
  facts,
  onInsurancePlans,
  items,
  onOpenReadings,
  onOpenTasks,
}: {
  facts: string[]
  onInsurancePlans: () => void
  items: FleetAttentionItem[]
  onOpenReadings: () => void
  onOpenTasks: () => void
}) {
  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.55rem 0.75rem',
    fontSize: '0.92rem',
    color: 'var(--text-strong)',
    borderTop: '1px solid var(--border)',
    minWidth: 0,
  }
  const countStyle = (tone: 'red' | 'amber'): React.CSSProperties => ({
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    fontSize: '1.02rem',
    minWidth: '2ch',
    textAlign: 'right',
    color: tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)',
    flexShrink: 0,
  })
  return (
    <div className="fleet-summary" style={{ marginBottom: '1rem' }}>
      <style>{`
        .fleet-summary .fleet-attn-rows { display: grid; grid-template-columns: 1fr; }
        .fleet-summary .fleet-attn-row--tap:hover { background: var(--bg-subtle); }
        @media (min-width: 720px) {
          .fleet-summary .fleet-attn-rows { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
          .fleet-summary .fleet-attn-rows > * { border-right: 1px solid var(--border); }
        }
      `}</style>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', flexWrap: 'wrap', columnGap: '0.45rem', rowGap: '0.1rem', alignItems: 'baseline' }}>
        {facts.map((f, i) => (
          <span key={f} style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'baseline' }}>
            {i > 0 ? <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span> : null}
            <span style={i === 0 ? { color: 'var(--text-strong)', fontWeight: 600 } : undefined}>{f}</span>
          </span>
        ))}
        <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
        <button
          type="button"
          onClick={onInsurancePlans}
          aria-label="Insurance plans"
          style={{ font: 'inherit', fontSize: '0.86rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Insurance plans ›
        </button>
      </p>
      {items.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem 0.35rem', fontSize: '0.66rem', letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
            <span>Needs attention</span>
            <span style={{ color: items.some((i) => i.tone === 'red') ? 'var(--text-red-700)' : 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
          </div>
          <div className="fleet-attn-rows">
            {items.map((it) => {
              const onClick = it.action === 'readings' ? onOpenReadings : it.action === 'tasks' ? onOpenTasks : undefined
              const inner = (
                <>
                  <span style={countStyle(it.tone)}>{it.count}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                  {onClick ? <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '1rem' }}>›</span> : null}
                </>
              )
              return onClick ? (
                <button
                  key={it.key}
                  type="button"
                  onClick={onClick}
                  className="fleet-attn-row fleet-attn-row--tap"
                  title={it.action === 'readings' ? 'Open the odometer catch-up list' : 'Open the maintenance-task list'}
                  aria-label={`${it.count} ${it.label}`}
                  data-testid={`fleet-attn-${it.key}`}
                  style={{ ...rowBase, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid var(--border)', font: 'inherit', cursor: 'pointer' }}
                >
                  {inner}
                </button>
              ) : (
                <div key={it.key} className="fleet-attn-row" data-testid={`fleet-attn-${it.key}`} style={rowBase}>
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-green-700)' }}>✓ Fleet's caught up — nothing needs attention</p>
      )}
    </div>
  )
}
