import { useEffect, useMemo, useState } from 'react'
import {
  previewReorderedDay,
  scheduleTimeToMinutes,
  sortBlocksByDayOrder,
} from '../../lib/reorderDayScheduleBlocks'
import { dispatchMinutesToHHmm, formatDispatchQuickTimeLabel } from '../../lib/dispatchAddBlockTime'

export type ReorderDayBlocksModalBlock = {
  id: string
  label: string
  time_start: string
  time_end: string
  /** Part of a linked crew group (shared_block_group_id). */
  linked?: boolean
}

function timeRangeLabel(startMin: number, endMin: number): string {
  return `${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(startMin))}–${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(endMin))}`
}

/**
 * Dispatch Day tab → "Reorder day" for one person: their blocks listed in day
 * order with ▲▼ controls and a live preview of the resulting time windows
 * (duration + gaps rule — see reorderDayScheduleBlocks). Save hands the new
 * id order back to the caller, which computes and persists the changed times.
 */
export default function ReorderDayBlocksModal({
  open,
  onClose,
  personName,
  blocks,
  saving,
  error,
  onSave,
}: {
  open: boolean
  onClose: () => void
  personName: string
  blocks: ReorderDayBlocksModalBlock[]
  saving: boolean
  error: string | null
  onSave: (newOrderedIds: string[]) => void
}) {
  const dayOrderIds = useMemo(() => sortBlocksByDayOrder(blocks).map((b) => b.id), [blocks])
  const [orderedIds, setOrderedIds] = useState<string[]>(dayOrderIds)
  useEffect(() => {
    if (open) setOrderedIds(dayOrderIds)
  }, [open, dayOrderIds])

  if (!open) return null

  const byId = new Map(blocks.map((b) => [b.id, b]))
  // State can lag the blocks prop for one render (it syncs in an effect after
  // open flips true) — render from the live day order until it's a valid
  // permutation, so previewReorderedDay never sees a mismatched id list.
  const effectiveOrder =
    orderedIds.length === dayOrderIds.length && orderedIds.every((id) => byId.has(id))
      ? orderedIds
      : dayOrderIds
  const preview = new Map(previewReorderedDay(blocks, effectiveOrder).map((p) => [p.id, p]))
  const unchanged = effectiveOrder.every((id, i) => id === dayOrderIds[i])
  const anyLinked = blocks.some((b) => b.linked)

  function move(index: number, delta: -1 | 1) {
    const j = index + delta
    if (j < 0 || j >= effectiveOrder.length) return
    const next = [...effectiveOrder]
    ;[next[index], next[j]] = [next[j]!, next[index]!]
    setOrderedIds(next)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reorder ${personName}'s day`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1006,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 480,
          width: 'calc(100vw - 2rem)',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>Reorder {personName}&rsquo;s day</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Jobs keep their durations; the gaps between them stay put. New times preview below.
        </p>
        <ol style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {effectiveOrder.map((id, i) => {
            const block = byId.get(id)
            const p = preview.get(id)
            if (!block || !p) return null
            const newStart = scheduleTimeToMinutes(p.time_start)
            const newEnd = scheduleTimeToMinutes(p.time_end)
            const movedInList = id !== dayOrderIds[i]
            const timesChanged =
              newStart !== scheduleTimeToMinutes(block.time_start) ||
              newEnd !== scheduleTimeToMinutes(block.time_end)
            return (
              <li
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.6rem',
                  border: `1px solid ${movedInList ? '#3b82f6' : 'var(--border-strong)'}`,
                  borderRadius: 8,
                  background: movedInList ? 'var(--bg-blue-tint, var(--bg-muted))' : 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || saving}
                    aria-label={`Move ${block.label} earlier in the day`}
                    style={{ padding: '0 0.4rem', fontSize: '0.8125rem', lineHeight: 1.4, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.35 : 1 }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === effectiveOrder.length - 1 || saving}
                    aria-label={`Move ${block.label} later in the day`}
                    style={{ padding: '0 0.4rem', fontSize: '0.8125rem', lineHeight: 1.4, cursor: i === effectiveOrder.length - 1 ? 'default' : 'pointer', opacity: i === effectiveOrder.length - 1 ? 0.35 : 1 }}
                  >
                    ▼
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {block.label}
                    {block.linked ? (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '0.05rem 0.3rem', verticalAlign: 'middle' }}>
                        linked crew
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {timesChanged ? (
                      <>
                        <s style={{ opacity: 0.6 }}>
                          {timeRangeLabel(scheduleTimeToMinutes(block.time_start), scheduleTimeToMinutes(block.time_end))}
                        </s>
                        {' → '}
                        <strong style={{ color: 'var(--text-strong)' }}>{timeRangeLabel(newStart, newEnd)}</strong>
                      </>
                    ) : (
                      timeRangeLabel(newStart, newEnd)
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        {anyLinked ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Linked crew jobs move for the whole crew — everyone&rsquo;s copy of that job shifts with it.
          </p>
        ) : null}
        {error ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(effectiveOrder)}
            disabled={unchanged || saving}
            style={{
              padding: '0.45rem 0.9rem',
              background: unchanged || saving ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: unchanged || saving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : 'Save new order'}
          </button>
        </div>
      </div>
    </div>
  )
}
