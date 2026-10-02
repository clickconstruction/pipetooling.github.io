import type { StagesBillRowLine as Line } from '../../lib/jobs/stagesBillRowLine'

/**
 * "This bill · $11,182 paid … $588 left" (v2.4349): the one line on a Pipeline bill row
 * about the row's own bill, under the job's money legend and above the dates block —
 * which are about the same bill. Kernel: `stagesBillRowLine`.
 */
export function StagesBillRowLine({ line, compact = false }: { line: Line; compact?: boolean }) {
  return (
    <div
      data-testid="stages-bill-row-line"
      title={line.title}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '0.5rem',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        marginTop: compact ? '0.25rem' : '0.4rem',
        textAlign: 'left',
        fontSize: '0.75rem',
        lineHeight: 1.35,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>This bill</b>
        <span style={{ color: 'var(--text-muted)' }}>{` · ${line.paid}`}</span>
      </span>
      <span style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{line.left}</span>
    </div>
  )
}
