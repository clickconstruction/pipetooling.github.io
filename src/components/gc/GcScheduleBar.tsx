/**
 * GC mode, the real build, the schedule's PR 7b: the opened bar, read only (call 3 of the plan,
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). A card under the chart for the
 * bar pressed: its name, its trade and company, then what the chart's hover card says about it,
 * what holds it, its parts and its place (`barCardRows`). The editor comes with the schedule's PR 8,
 * for those who may move a bar.
 */
import { Fragment } from 'react'
import type { GanttBar } from '../../lib/gc/schedule/gantt'
import { barCardRows } from '../../lib/gc/schedule/scheduleWindow'
import { Btn, Card, Chip } from './gcUi'

/** The colours the chart's hover card gives a line. */
const TONE = { red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', green: 'var(--text-green-800)' } as const

export function GcScheduleBar({ bar, all, today, building, onClose }: { bar: GanttBar; all: GanttBar[]; today: string; building: boolean; onClose: () => void }) {
  const rows = barCardRows(bar, all, today, building)
  return (
    <Card>
      <div data-gc-opened-activity={bar.id} style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1rem' }}>{bar.item.label}</strong>
          <Chip tone={bar.tone}>{bar.statusWords}</Chip>
          <span style={{ flex: 1 }} />
          <Btn kind="quiet" onClick={onClose}>
            Close the bar
          </Btn>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {bar.item.trade} · {bar.item.company}
        </div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '6.5rem minmax(0, 1fr)', gap: '0.2rem 0.6rem' }}>
          {rows.map((r, i) => (
            <Fragment key={`${r.label}:${i}`}>
              {/* A run of rows with one label (its waits, its parts) says the label once. */}
              <dt style={{ color: 'var(--text-muted)' }}>{i > 0 && rows[i - 1]?.label === r.label ? '' : r.label}</dt>
              <dd style={{ margin: 0, ...(r.tone ? { color: TONE[r.tone] } : {}) }}>{r.words}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </Card>
  )
}
