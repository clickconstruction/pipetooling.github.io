import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

const PAID_COLOR = '#16a34a'
const BILLED_COLOR = '#2563eb'
const DRAFT_COLOR = '#60a5fa'
const UNBILLED_COLOR = '#f59e0b'

export { PAID_COLOR, BILLED_COLOR, DRAFT_COLOR, UNBILLED_COLOR }

/** One colored slice of the bar; `frac` is 0–1 of the whole track. */
export type BarSegment = { key: string; frac: number; color: string; striped?: boolean }

export type MoneyTile = {
  key: string
  label: string
  value: number
  /** Swatch color; omit for the neutral (empty-track) swatch. */
  dot?: string
  /** Striped swatch (matches a striped segment, e.g. draft). */
  striped?: boolean
  /** Render bold (e.g. the Job Total / Remaining headline figures). */
  strong?: boolean
}

function stripe(color: string): string {
  return `repeating-linear-gradient(45deg, ${color}, ${color} 4px, transparent 4px, transparent 8px)`
}

function Swatch({ color, striped }: { color?: string; striped?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: 2,
        marginRight: 6,
        background: color ? (striped ? undefined : color) : 'var(--bg-subtle)',
        backgroundColor: color && striped ? 'var(--surface)' : undefined,
        backgroundImage: color && striped ? stripe(color) : undefined,
        border: color ? `1px solid ${color}` : '1px solid var(--border)',
        verticalAlign: 'baseline',
      }}
    />
  )
}

/**
 * The Progress & payment bar + a labeled money legend, shared between the Stages
 * board and the Edit-Job billing header so both read the same. The caller passes
 * the ordered colored segments (they render left-to-right and clip to the track)
 * and the tiles to spell out beneath it.
 */
export function MoneyLifecycleBar({
  hasBar,
  segments,
  tiles,
  height = 12,
  barTitle,
}: {
  hasBar: boolean
  segments: BarSegment[]
  tiles: MoneyTile[]
  height?: number
  barTitle?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {hasBar ? (
        <div
          title={barTitle}
          style={{
            display: 'flex',
            height,
            borderRadius: 5,
            overflow: 'hidden',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          {segments
            .filter((s) => s.frac > 0)
            .map((s) => (
              <div
                key={s.key}
                style={{
                  width: `${s.frac * 100}%`,
                  background: s.striped ? undefined : s.color,
                  backgroundColor: s.striped ? 'var(--surface)' : undefined,
                  backgroundImage: s.striped ? stripe(s.color) : undefined,
                }}
              />
            ))}
        </div>
      ) : (
        <div
          title="No line items yet — add work below to set the job total"
          style={{ height, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }}
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1.25rem' }}>
        {tiles.map((t) => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', minWidth: '6.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <Swatch color={t.dot} striped={t.striped} />
              {t.label}
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: t.strong ? 700 : 500,
                color: t.strong ? 'var(--text-strong)' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {formatUsdNoCents(t.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
