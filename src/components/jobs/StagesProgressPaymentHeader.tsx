import type { CSSProperties } from 'react'

/**
 * The "Progress & payment" column header shared by the Stages tables (v2.3408).
 * Given `onToggleSort`, it is a button: one click orders the section's rows by
 * % complete, 0 → 100; the next click restores job-number order. The sort is a
 * look, not a setting — `jobsStagesSortMode.ts` never persists it, so leaving
 * the board and coming back drops it.
 */
export const STAGES_PROGRESS_HEADER_LABEL = 'Progress & payment'
export const STAGES_PROGRESS_HEADER_SORT_ON_TITLE = 'Sorted by % complete, 0 → 100 — click to go back to job-number order'
export const STAGES_PROGRESS_HEADER_SORT_OFF_TITLE = 'Click to sort rows by % complete, 0 → 100'

export type StagesProgressPaymentHeaderProps = {
  /** True while the board is sorted by % complete. */
  sortedByProgress: boolean
  /** Omit to render a plain, unclickable header (deck embeds pass hideHeader anyway). */
  onToggleSort?: () => void
}

const thStyle: CSSProperties = {
  padding: '0.75rem',
  textAlign: 'center',
  borderBottom: '1px solid var(--border)',
  minWidth: '12rem',
}

export default function StagesProgressPaymentHeader({ sortedByProgress, onToggleSort }: StagesProgressPaymentHeaderProps) {
  if (!onToggleSort) return <th style={thStyle}>{STAGES_PROGRESS_HEADER_LABEL}</th>
  return (
    <th style={thStyle} aria-sort={sortedByProgress ? 'ascending' : 'none'}>
      <button
        type="button"
        onClick={onToggleSort}
        title={sortedByProgress ? STAGES_PROGRESS_HEADER_SORT_ON_TITLE : STAGES_PROGRESS_HEADER_SORT_OFF_TITLE}
        aria-pressed={sortedByProgress}
        data-stages-progress-sort={sortedByProgress ? 'on' : 'off'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.15rem 0.4rem',
          margin: '-0.15rem -0.4rem',
          border: 'none',
          borderRadius: 4,
          background: sortedByProgress ? 'var(--bg-blue-tint)' : 'transparent',
          color: sortedByProgress ? 'var(--text-link)' : 'inherit',
          font: 'inherit',
          fontWeight: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {STAGES_PROGRESS_HEADER_LABEL}
        <span aria-hidden style={{ fontSize: '0.6875rem', fontWeight: 600, opacity: sortedByProgress ? 1 : 0.45 }}>
          {sortedByProgress ? '0 → 100' : '↕'}
        </span>
      </button>
    </th>
  )
}
