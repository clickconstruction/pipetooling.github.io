import type { StagesSearchHeldBackKind, StagesSearchHeldBackLine } from '../../lib/jobs/stagesSearchHeldBack'

/** The lines above the board when a search's matches sit behind a filter (`stagesSearchHeldBack.ts`). */
export function StagesSearchHeldBackHint({
  lines,
  onPress,
}: {
  lines: readonly StagesSearchHeldBackLine[]
  onPress: (kind: StagesSearchHeldBackKind) => void
}) {
  if (lines.length === 0) return null
  return (
    <div
      role="status"
      data-testid="stages-search-held-back"
      style={{ margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}
    >
      {lines.map((line) => (
        <div key={line.kind} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>{line.main}</span>
          <button
            type="button"
            onClick={() => onPress(line.kind)}
            style={{
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-link)',
              borderRadius: 9999,
              padding: '0.25rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {line.press}
          </button>
        </div>
      ))}
    </div>
  )
}
