import { PhoneSheet } from '../PhoneSheet'
import type { LienDeskMoreKey, LienDeskMoreRow } from '../../lib/jobs/lienDeskPhoneMore'

/**
 * The Lien desk's **More** sheet on a phone (punch list #352, PR 1): the doors the header held, each a row a thumb
 * tall. A press closes the sheet and opens what the door opens on a computer; the sheet writes nothing itself.
 * The rows and their order are `lienDeskMoreRows`.
 */
export default function LienDeskMoreSheet({ rows, onPick, onClose }: { rows: ReadonlyArray<LienDeskMoreRow>; onPick: (key: LienDeskMoreKey) => void; onClose: () => void }) {
  return (
    <PhoneSheet label="More on the Lien desk" title="More" onClose={onClose} dataAttrs={{ 'data-lien-desk-more': 'sheet' }}>
      <div style={{ overflowY: 'auto', padding: '0.25rem 0 0.5rem' }}>
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            data-lien-desk-more-row={r.key}
            onClick={() => onPick(r.key)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '0 0.75rem',
              width: '100%',
              minHeight: 56,
              padding: '0.5rem 1rem',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-base)',
              font: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: r.primary ? 'var(--text-blue-700)' : undefined }}>{r.label}</span>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.hint}</span>
            </span>
            {r.count != null ? (
              <span data-lien-desk-more-count style={{ minWidth: 28, padding: '2px 9px', borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: '0.875rem', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
            ) : (
              <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}>›</span>
            )}
          </button>
        ))}
      </div>
    </PhoneSheet>
  )
}
