import { useMemo } from 'react'
import { checklistGanttAxis, checklistGanttRows, type GanttItemInput } from '../../lib/checklistGanttRows'
import type { DueChangeRow } from '../../lib/checklistDuePushes'

/**
 * Manage → Timeline (v2.2375, Tier B of pushed-back markers): a
 * calendar-TRUE Gantt strip for dated one-offs — the roadmap Timeline's
 * deliberate opposite (that one is sequence-axis and stays untouched).
 * Solid bar = the current window (start → due; green once done and kept
 * ~2 weeks as recent history). Where a task was pushed, a hollow amber
 * tick marks the ORIGINAL promise — it never moves — and a hatched trail
 * stretches to the current due with a "→ pushed ×N · +Md" badge. Tasks
 * without a due date simply aren't rows here. Tapping a row opens the
 * item's edit window.
 */
export function ChecklistManageTimeline({
  items,
  pushesByItem,
  onOpenItem,
}: {
  items: GanttItemInput[]
  pushesByItem: Map<string, DueChangeRow[]>
  onOpenItem: (id: string) => void
}) {
  const todayStr = new Date().toLocaleDateString('en-CA')
  const axis = useMemo(() => checklistGanttAxis(items, todayStr), [items, todayStr])
  const rows = useMemo(() => checklistGanttRows(items, pushesByItem, axis, todayStr), [items, pushesByItem, axis, todayStr])
  const pct = (f: number) => `${(f * 100).toFixed(2)}%`

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>
        No tasks with a due date yet — give a one-off a <b>Due by</b> date and it appears here.
      </p>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 640 }}>
          {/* month header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 'none', width: 170 }} />
            <div style={{ flex: 1, position: 'relative', height: 24 }}>
              {axis.months.map((m) => (
                <span
                  key={m.label + m.left}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: pct(m.left), width: pct(m.width), borderLeft: m.left > 0 ? '1px solid var(--border)' : 'none' }}
                >
                  {m.width > 0.06 ? (
                    <span style={{ position: 'absolute', top: 4, left: 6, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                      {m.label}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: 46 }}>
              <button
                type="button"
                onClick={() => onOpenItem(r.id)}
                title={r.title}
                style={{ flex: 'none', width: 170, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '0.35rem 0.6rem', fontSize: '0.8125rem', color: r.done ? 'var(--text-muted)' : 'var(--text-strong)', overflow: 'hidden' }}
              >
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: r.done ? 'line-through' : undefined }}>
                  {r.title}
                </span>
              </button>
              <div style={{ flex: 1, position: 'relative' }}>
                {axis.weekends.map((w, i) => (
                  <span key={i} aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(w.left), width: pct(w.width), background: 'var(--bg-slate-tint)' }} />
                ))}
                {/* solid window bar */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 13,
                    height: 18,
                    left: pct(r.bar.left),
                    width: pct(r.bar.width),
                    borderRadius: 5,
                    boxSizing: 'border-box',
                    border: r.done ? '1.5px solid #16a34a' : '1.5px solid #2563eb',
                    background: r.done ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)',
                  }}
                />
                {/* hatched slip trail: original due → current due */}
                {r.trail && r.trail.width > 0 ? (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 13,
                      height: 18,
                      left: pct(r.trail.left),
                      width: pct(r.trail.width),
                      borderRadius: '0 5px 5px 0',
                      boxSizing: 'border-box',
                      border: '1.5px dashed #d97706',
                      borderLeft: 'none',
                      background: 'repeating-linear-gradient(-55deg, var(--bg-amber-tint) 0 5px, var(--surface) 5px 10px)',
                    }}
                  />
                ) : null}
                {/* hollow tick at the original promise */}
                {r.origTickLeft != null ? (
                  <span aria-hidden style={{ position: 'absolute', top: 9, height: 26, left: pct(r.origTickLeft), borderLeft: '2px solid #d97706' }}>
                    <span style={{ position: 'absolute', top: -5, left: -4, width: 6, height: 6, border: '2px solid #d97706', borderRadius: '50%', background: 'var(--surface)' }} />
                  </span>
                ) : null}
                {r.badge ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: pct(Math.min(r.origTickLeft ?? r.bar.left, 0.8)),
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '0.06rem 0.4rem',
                      borderRadius: 999,
                      background: 'var(--bg-amber-tint)',
                      border: '1px solid #d97706',
                      color: 'var(--text-amber-800)',
                      whiteSpace: 'nowrap',
                      zIndex: 2,
                    }}
                  >
                    {r.badge}
                  </span>
                ) : null}
                {/* today line */}
                <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(axis.todayLeft), borderLeft: '2px solid #dc2626', opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, padding: '0.45rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Real calendar, dated one-offs only. Solid bar = start → due (green once done, kept two weeks). ○ amber tick = the original promise — it never moves; the hatched trail is the slip to the current due. The red line is today. Tap a row to open the task.
      </p>
    </div>
  )
}
