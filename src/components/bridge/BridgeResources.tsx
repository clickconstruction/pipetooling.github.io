import type { CSSProperties } from 'react'
import type { ResourceId, ResourceReading } from '../../lib/bridge/resources'

/**
 * What throttles the link (link PR 6): Decision, Capital and Talent as three
 * cards — a one-line head, an action pill, a gauge, one line, and a badge
 * that opens the order. Pressing a card opens its desk.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

const toneColor = (tone: ResourceReading['tone']): string => (tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-700)' : 'var(--text)')

export function BridgeResources({ resources, pickedId, onPick, onOrder }: { resources: ResourceReading[]; pickedId: ResourceId | null; onPick: (id: ResourceId) => void; onOrder?: (id: ResourceId) => void }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-resources">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <span style={label}>What throttles the link</span>
        <span style={det}>a stage is slow because one of these is short. Press one.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {resources.map((r) => {
          const picked = pickedId === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              aria-pressed={picked}
              data-testid={`bridge-resource-${r.id}`}
              style={{ textAlign: 'left', font: 'inherit', color: picked ? 'var(--text)' : 'var(--text-muted)', background: picked ? 'var(--surface)' : 'var(--surface)', border: picked ? '2px solid var(--text-red-700)' : '1px solid var(--border)', borderRadius: 10, padding: picked ? 11 : 12, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, minHeight: 130, cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ ...label, color: 'inherit' }}>{r.name}</span>
                <span style={det}>{r.kind}</span>
              </span>
              <span style={{ alignSelf: 'flex-end', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>↳ {r.action}</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: toneColor(r.tone) }} data-testid={`bridge-resource-gauge-${r.id}`}>
                {r.gauge}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.oneLine}</span>
              <span
                role="button"
                tabIndex={0}
                title="what to deal with first, in order"
                onClick={(e) => {
                  e.stopPropagation()
                  onOrder?.(r.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onOrder?.(r.id)
                  }
                }}
                style={{ marginTop: 'auto', fontSize: '0.78rem', fontWeight: 700, color: r.throttles ? 'var(--text-amber-800)' : 'var(--text)', textDecoration: onOrder ? 'underline dotted' : undefined, textUnderlineOffset: 3, cursor: onOrder ? 'pointer' : undefined }}
                data-testid={`bridge-resource-badge-${r.id}`}
              >
                {r.badge}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
