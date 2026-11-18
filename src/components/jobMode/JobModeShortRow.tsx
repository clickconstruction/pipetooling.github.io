import type { CSSProperties, ReactNode } from 'react'

/**
 * One row of the short Job Mode page (punch list #384): a title, a second line that says what the press opens,
 * and a mark on the right. **Open this job**, the pace line, **Tomorrow** and **Everything else** are all this
 * row, so the page reads as four doors under the card. `expanded` makes it a fold's handle: the mark turns and
 * the row tells a screen reader whether it is open. `picture` draws under the words: the pace line's two thin bars
 * (punch list #396), so the row shows its reading and the card need not be opened to get it.
 */

const ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 56, padding: '0.6rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }

export function JobModeShortRow({ title, note, onPress, expanded, tone, testId, picture }: { title: string; note: string; onPress: () => void; expanded?: boolean; tone?: 'ahead' | 'behind'; testId: string; picture?: ReactNode }) {
  const titleColor = tone === 'ahead' ? 'var(--text-green-700)' : tone === 'behind' ? 'var(--text-red-700)' : undefined
  return (
    <button type="button" data-job-mode-short-row={testId} data-testid={testId} aria-expanded={expanded} onClick={onPress} style={ROW}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: titleColor }}>{title}</span>
        <span data-job-mode-short-note style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {note}
        </span>
        {picture ? <span style={{ display: 'grid', gap: 4, marginTop: 6 }}>{picture}</span> : null}
      </span>
      <span aria-hidden="true" style={{ fontSize: '1.25rem', color: 'var(--text-link)' }}>
        {expanded === undefined ? '›' : expanded ? '▴' : '▾'}
      </span>
    </button>
  )
}

export default JobModeShortRow
