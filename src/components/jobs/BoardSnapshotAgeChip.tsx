import { describeKeptReadAge } from '../../lib/keptRead'

/**
 * v2.3610: the age of the remembered board, beside *Updating jobs…* while it is on screen, and beside the line that
 * says the refresh did not land. Moved out of `JobsStagesTab` as it was (the Stages map's step 25).
 */
export function BoardSnapshotAgeChip({ savedAt }: { savedAt: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: '0.4rem',
        padding: '0.05rem 0.5rem',
        borderRadius: 999,
        fontSize: '0.72rem',
        background: 'var(--bg-amber-100)',
        border: '1px solid var(--border-amber)',
        color: 'var(--text-amber-800)',
        verticalAlign: 'middle',
      }}
    >
      board from {describeKeptReadAge(savedAt, Date.now())}
    </span>
  )
}
