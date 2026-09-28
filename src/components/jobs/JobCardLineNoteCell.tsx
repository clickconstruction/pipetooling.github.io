import {
  jobCardLineStatus,
  jobCardLineStatusNote,
  type JobMercuryAllocLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import type { CardChargeExclusions } from '../../lib/jobs/cardChargeAllocationFilter'
import { CATEGORY_TAG_INK, type CategoryTagRow } from '../../lib/banking/categoryTags'

/**
 * A card line's Note cell in the Job window and Edit Job: the allocation's own note,
 * and under it why the line is not in the Card charges total when the one card rule
 * leaves it out (an Internal Transfer, or a charge already counted on a supply invoice).
 * A charge in a cost-line tag (⛽ Fuel & gas) carries the tag, so the line reads as
 * part of that row of the Costs tab (punch list #52).
 */
export function JobCardLineNoteCell({
  line,
  exclusions,
  tagByTxId,
}: {
  line: JobMercuryAllocLine
  exclusions: CardChargeExclusions | undefined
  tagByTxId?: ReadonlyMap<string, CategoryTagRow>
}) {
  const status = jobCardLineStatus(line, exclusions)
  const why = jobCardLineStatusNote(status)
  const tag = status === 'counts' && line.mercuryTransactionId ? tagByTxId?.get(line.mercuryTransactionId) : undefined
  return (
    <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-600)' }}>
      {tag ? (
        <span style={{ marginRight: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: CATEGORY_TAG_INK[tag.color], whiteSpace: 'nowrap' }} data-testid="card-line-tag">
          {tag.icon} {tag.name}
        </span>
      ) : null}
      {line.note ?? (why || tag ? null : '—')}
      {why ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }} data-testid="card-line-not-counted">
          {why}
        </div>
      ) : null}
    </td>
  )
}

