import { memo } from 'react'
import type { ApprovalGroup } from '../../lib/accountingApprovalGroups'
import { formatUsd } from './bankingMercuryDragSortLedger'

export type AccountingApprovalGroupHeaderProps = {
  group: ApprovalGroup
  expanded: boolean
  /** True while any approve/reject is running anywhere in the section. */
  busy: boolean
  onToggle: (labelId: string) => void
  onApproveGroup: (labelId: string) => void
  onRejectGroup: (labelId: string) => void
}

/**
 * Collapsed header row for one suggested-label bucket in the grouped Approvals
 * view: expand chevron + label name + item count + signed total, a conflict note
 * when some rows can't be auto-approved, and per-group Approve all / Reject all.
 */
export const AccountingApprovalGroupHeader = memo(function AccountingApprovalGroupHeader({
  group,
  expanded,
  busy,
  onToggle,
  onApproveGroup,
  onRejectGroup,
}: AccountingApprovalGroupHeaderProps) {
  const approvableCount = group.count - group.conflictCount
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#f8fafc',
        padding: '0.6rem 0.85rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(group.labelId)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.labelName}`}
        style={{
          flex: '1 1 16rem',
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.5rem',
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{ color: '#64748b', width: '1rem', flex: '0 0 auto' }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 700, color: '#0f172a' }}>{group.labelName}</span>
        <span style={{ color: '#475569', fontSize: '0.875rem' }}>
          {group.count.toLocaleString()} {group.count === 1 ? 'item' : 'items'} · {formatUsd(group.totalAmount)}
        </span>
        {group.conflictCount > 0 ? (
          <span style={{ color: '#b45309', fontSize: '0.8rem' }}>
            · {group.conflictCount.toLocaleString()} need splits cleared
          </span>
        ) : null}
      </button>
      <span style={{ display: 'flex', gap: '0.5rem', flex: '0 0 auto' }}>
        <button
          type="button"
          disabled={busy || approvableCount === 0}
          onClick={() => onApproveGroup(group.labelId)}
          title={
            approvableCount === 0
              ? 'Every suggestion in this group needs job splits cleared first'
              : `Approve ${approvableCount.toLocaleString()} suggestion${approvableCount === 1 ? '' : 's'} → ${group.labelName}`
          }
          style={{
            padding: '0.4rem 0.8rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            background: busy || approvableCount === 0 ? '#94a3b8' : '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: busy || approvableCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Approve all{approvableCount > 0 ? ` (${approvableCount.toLocaleString()})` : ''}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRejectGroup(group.labelId)}
          title={`Dismiss all ${group.count.toLocaleString()} suggestion${group.count === 1 ? '' : 's'} in this group`}
          style={{
            padding: '0.4rem 0.8rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            background: '#fff',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 6,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Reject all
        </button>
      </span>
    </div>
  )
})
