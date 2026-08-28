/** The Bid Room state chip (v2.2471) — one look everywhere: picker, board GC lines, Followup. */
import { roomStateChipLabel, roomStateChipTone, type BidRoomStateSummary } from '../../lib/bids/bidRoomState'

const TONE_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  signed: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border)' },
  declined: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', border: 'var(--border)' },
  live: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)', border: 'var(--border-amber)' },
  idle: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
}

export function BidRoomStateChip({ state, compact }: { state: BidRoomStateSummary | null | undefined; compact?: boolean }) {
  const label = roomStateChipLabel(state)
  const tone = roomStateChipTone(state)
  if (!label || !tone) return null
  const t = TONE_STYLES[tone]!
  return (
    <span
      title="Bid room — the GC's durable proposal link"
      style={{
        display: 'inline-block',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: compact ? '0 0.4rem' : '0.08rem 0.5rem',
        fontSize: compact ? '0.62rem' : '0.68rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  )
}
