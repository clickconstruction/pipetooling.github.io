import { useCallback, type KeyboardEvent } from 'react'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { formatDenverWeekday, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { formatDateMdYDisplay } from './UserScheduleDayRow'

export function ScheduleBlockPreviewModal({
  open,
  block,
  jobTitle,
  onClose,
}: {
  open: boolean
  block: JobScheduleBlockRow | null
  jobTitle: string
  onClose: () => void
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  if (!open || !block) return null

  const dayWeekday = formatDenverWeekday(referenceDateForWorkDateYmd(block.work_date).getTime())
  const dayMdY = formatDateMdYDisplay(block.work_date)
  const timeRange = scheduleFormatWindow(block.time_start, block.time_end)
  const note = (block.note ?? '').trim()
  const linked = Boolean(block.shared_block_group_id)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="presentation"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-block-preview-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 460,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <h2
            id="schedule-block-preview-title"
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {jobTitle || 'Schedule block'}
          </h2>
          {linked ? (
            <span
              title="Part of a linked block group"
              style={{
                flexShrink: 0,
                padding: '0.1rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-blue-700)',
                background: 'var(--bg-blue-tint)',
                border: '1px solid var(--border-blue)',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              Linked block
            </span>
          ) : null}
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div>
            <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{dayWeekday}</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>· {dayMdY}</span>
          </div>
          <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{timeRange}</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Note</div>
          {note ? (
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                lineHeight: 1.45,
                color: 'var(--text-strong)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {note}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
              No note
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
