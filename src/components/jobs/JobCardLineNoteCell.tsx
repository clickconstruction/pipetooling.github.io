import {
  jobCardLineStatus,
  jobCardLineStatusNote,
  type JobMercuryAllocLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import type { CardChargeExclusions } from '../../lib/jobs/cardChargeAllocationFilter'

/**
 * A card line's Note cell in the Job window and Edit Job: the allocation's own note,
 * and under it why the line is not in the Card charges total when the one card rule
 * leaves it out (an Internal Transfer, or a charge already counted on a supply invoice).
 */
export function JobCardLineNoteCell({ line, exclusions }: { line: JobMercuryAllocLine; exclusions: CardChargeExclusions | undefined }) {
  const why = jobCardLineStatusNote(jobCardLineStatus(line, exclusions))
  return (
    <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-600)' }}>
      {line.note ?? (why ? null : '—')}
      {why ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }} data-testid="card-line-not-counted">
          {why}
        </div>
      ) : null}
    </td>
  )
}
