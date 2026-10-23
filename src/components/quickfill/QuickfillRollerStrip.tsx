import type { RollerDot } from '../../lib/quickfill/views'

const DOT: Record<RollerDot, { background: string; border?: string }> = {
  red: { background: '#dc2626' },
  amber: { background: '#d97706' },
  green: { background: '#16a34a' },
  grey: { background: 'var(--border-strong)' },
  hollow: { background: 'transparent', border: '1.5px solid var(--border-strong)' },
}

/**
 * The Roller's strip (punch list #147, v2.5787): one dot per group in the deck in the
 * freshness colours, the words "7 of 23 · 12 left with work", the show-done switch and the
 * Groups button that opens the Board as the index. A dot is a button that jumps to its group.
 */
export function QuickfillRollerStrip({
  dots,
  words,
  showDone,
  doneCount,
  onShowDone,
  onPick,
  onGroups,
}: {
  dots: ReadonlyArray<{ sectionId: string; label: string; dot: RollerDot; current: boolean }>
  words: string
  showDone: boolean
  doneCount: number
  onShowDone: (on: boolean) => void
  onPick: (sectionId: string) => void
  onGroups: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem 1rem', marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
      <span role="list" aria-label="The groups in this round" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
        {dots.map((d) => (
          <button
            key={d.sectionId}
            type="button"
            role="listitem"
            aria-label={d.label}
            aria-current={d.current ? 'step' : undefined}
            title={d.label}
            onClick={() => onPick(d.sectionId)}
            style={{
              width: d.current ? 15 : 9,
              height: d.current ? 15 : 9,
              padding: 0,
              borderRadius: '50%',
              border: DOT[d.dot].border ?? 'none',
              background: DOT[d.dot].background,
              outline: d.current ? '2px solid var(--text-link)' : 'none',
              outlineOffset: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
      </span>
      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{words}</span>
      {doneCount > 0 ? (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => onShowDone(e.target.checked)} />
          Show the {doneCount} marked today
        </label>
      ) : null}
      <button
        type="button"
        onClick={onGroups}
        style={{ padding: '0.25rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
      >
        Groups ▾
      </button>
    </div>
  )
}
