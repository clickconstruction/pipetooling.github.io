/**
 * GC mode, the real build, the schedule's PR 14c: our superintendent's "To verify" on the Schedule window (owner,
 * 2026-10-02: only a checked mark counts toward the look-ahead; the plan is to-dos/gc-mode/mockups/schedule-pr14.md on
 * branch spike/gc-mode). Ported from the GC mode prototype's `VerifyCard` and `VerifyLine` in `GcBuildingSchedule.tsx`,
 * their words kept: each trade mark waiting, with what they say and what they reported against the plan, right or
 * corrected; our own crew's work this week, marked here and checked as it is made; and each inspection due by the
 * week's end, through the bar form's own `GcInspectionCheck`. The prototype dispatched each press to its reducer; here
 * each is a callback the Schedule window carries to the database. The prototype's line from the daily log waits on the
 * log in the schedule's read.
 */
import { useState } from 'react'
import { crewMark, verifiedMark } from '../../lib/gc/schedule/lateWindow'
import { mondayOf, verifyList, type ScheduleRow } from '../../lib/gc/schedule/schedule'
import type { InspectionFailure, LookAheadMark, LookAheadReason, ScheduleActivity } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'
import { GcInspectionCheck, PressNote } from './GcScheduleCards'
import { Btn, Card, Chip, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

const REASONS: LookAheadReason[] = ['weather', 'trade before', 'materials', 'crew', 'other']

export function GcVerifyCard({
  project,
  rows,
  today,
  onVerify,
  onCrewMark,
  onPass,
  onFail,
  onReload,
}: {
  project: GcProject
  rows: ScheduleRow[]
  today: string
  /** A trade's mark checked, or corrected (`verifiedMark`): a record. */
  onVerify: (mark: LookAheadMark) => Promise<void>
  /** Our own crew's mark for the week (`crewMark`): a record, checked as it is made. */
  onCrewMark: (mark: LookAheadMark) => Promise<void>
  /** An inspection passed today, or failed: the bar form's own presses. */
  onPass: (lineId: string) => Promise<void>
  onFail: (lineId: string, failure: InspectionFailure, activities: ScheduleActivity[], words: string) => Promise<void>
  onReload?: () => void
}) {
  const { waiting, ourCrew, inspections } = verifyList(project, rows, today)
  if (waiting.length === 0 && ourCrew.length === 0 && inspections.length === 0) {
    return (
      <Card>
        <div data-verify-card>
          <strong>To verify</strong> <span style={{ color: 'var(--text-muted)' }}>· nothing waits on our superintendent.</span>
        </div>
      </Card>
    )
  }
  const thisWeek = mondayOf(today)
  const marks = waiting.length + ourCrew.length
  return (
    <Card style={{ border: '1px solid var(--border-strong)' }}>
      <div data-verify-card style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
        <strong>To verify</strong>
        {marks > 0 && (
          <Chip tone="amber">
            {marks} {marks === 1 ? 'mark' : 'marks'}
          </Chip>
        )}
        {inspections.length > 0 && (
          <Chip tone="violet">
            {inspections.length} {inspections.length === 1 ? 'inspection' : 'inspections'}
          </Chip>
        )}
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        Our superintendent checks each trade's mark on the job. Only a verified mark counts toward the look-ahead.
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {waiting.map(({ mark, row }) => (
          <VerifyLine
            key={`${mark.weekOf}-${mark.lineId}`}
            row={row}
            weekOf={mark.weekOf}
            saysDone={mark.done}
            saysReason={mark.reason ?? null}
            onReload={onReload}
            onVerify={(done, reason) => onVerify(verifiedMark(mark, done, reason, today))}
          />
        ))}
        {ourCrew.map((row) => (
          <VerifyLine
            key={`crew-${row.activity.lineId}`}
            row={row}
            weekOf={thisWeek}
            saysDone={null}
            saysReason={null}
            onReload={onReload}
            onVerify={(done, reason) => onCrewMark(crewMark(row, thisWeek, done, reason, today))}
          />
        ))}
        {inspections.map((insp) => (
          <div key={insp.activity.lineId} data-verify-inspection={insp.activity.lineId} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <div>
              <strong>{insp.label}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                · {insp.company} · planned {shortDate(insp.activity.start)} to {shortDate(insp.activity.finish)}
              </span>
            </div>
            <GcInspectionCheck
              project={project}
              activity={insp.activity}
              today={today}
              onPass={() => onPass(insp.activity.lineId)}
              onFail={(failure, activities, words) => onFail(insp.activity.lineId, failure, activities, words)}
              {...(onReload ? { onReload } : {})}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * One mark to verify. `saysDone` null: our own crew's activity, which we mark ourselves. A "done" marked not done asks
 * why; a "not done" corrected to done needs no reason.
 */
function VerifyLine({
  row,
  weekOf,
  saysDone,
  saysReason,
  onVerify,
  onReload,
}: {
  row: ScheduleRow
  weekOf: string
  saysDone: boolean | null
  saysReason: LookAheadReason | null
  onVerify: (done: boolean, reason: LookAheadReason | null) => Promise<void>
  onReload?: (() => void) | undefined
}) {
  const [reason, setReason] = useState<LookAheadReason>('other')
  const press = useSchedulePress(onReload)
  const ours = saysDone === null
  const mark = (done: boolean, why: LookAheadReason | null) => void press.run(() => onVerify(done, why), 'The mark did not save.')
  const reasonPick = (
    <select value={reason} onChange={(e) => setReason(e.target.value as LookAheadReason)} style={input} aria-label={`Why not, ${row.label}`}>
      {REASONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  )
  return (
    <div data-verify-line={row.activity.lineId} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
      <div>
        <strong>
          {row.trade} · {row.label}
        </strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          · {row.company} · week of {shortDate(weekOf)}
        </span>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {ours ? 'Our own crew. Mark it yourself.' : saysDone ? 'They say done.' : `They say not done${saysReason ? `: ${saysReason}` : ''}.`} Reported{' '}
        {Math.round(row.actual)}%, planned {Math.round(row.plannedToday)}% by today.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {ours ? (
          <>
            <Btn kind="primary" disabled={press.busy} onClick={() => mark(true, null)}>
              Done
            </Btn>
            {reasonPick}
            <Btn disabled={press.busy} onClick={() => mark(false, reason)}>
              Not done
            </Btn>
          </>
        ) : saysDone ? (
          <>
            <Btn kind="primary" disabled={press.busy} onClick={() => mark(true, null)}>
              Right, done
            </Btn>
            {reasonPick}
            <Btn disabled={press.busy} onClick={() => mark(false, reason)}>
              Not done
            </Btn>
          </>
        ) : (
          <>
            <Btn kind="primary" disabled={press.busy} onClick={() => mark(false, null)}>
              Right, not done
            </Btn>
            <Btn disabled={press.busy} onClick={() => mark(true, null)}>
              It is done
            </Btn>
          </>
        )}
      </div>
      <PressNote refused={press.refused} failed={press.failed} />
    </div>
  )
}
