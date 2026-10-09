/**
 * GC mode, the real build, the schedule's PR 9a: the job's own work (G-38), an inspection passed or failed, and the dates
 * to meet, on real data (the plan is to-dos/gc-mode/mockups/schedule-pr9.md on branch spike/gc-mode). Ported from the GC
 * mode prototype's `GcBuildingSchedule.tsx` (`AddActivityCard`, `MilestonesCard`, `InspectionCheck` and the opened
 * activity's own buttons), their words kept: the prototype dispatched each press to its reducer, and here each is a
 * callback the Schedule window carries to the database. A plan write someone else beat says what changed, keeps what the
 * person typed and reads the schedule again (G-134). A failed inspection pushes with main's `pushAfter`, the known
 * difference (`failInspectionPress`).
 */
import { useState, type ReactNode } from 'react'
import { addDays } from '../../lib/gc/building'
import { ADDED_WHO, addedActivityProblem } from '../../lib/gc/schedule/addedActivity'
import { daysBetween } from '../../lib/gc/schedule/network'
import { activityName, inspectedTrades, substantialCompletionOn, type ScheduleItem } from '../../lib/gc/schedule/schedule'
import { failInspectionPress, ownWorkPress } from '../../lib/gc/schedule/scheduleWindow'
import type { InspectionFailure, ScheduleActivity, ScheduleMilestone } from '../../lib/gc/schedule/types'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import type { GcProject } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcScheduleRefusal } from './GcScheduleMoves'
import { Btn, Card, input } from './gcUi'

const rowBox = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

/** What a plan write someone else beat says under its buttons: nothing of this press saved, and the chart reads again. */
const NOT_SAVED = 'Nothing was saved. The chart shows the new dates now. Try it again on them.'

/**
 * A press's state: busy while it saves, what someone else changed when a plan write was refused (the schedule then reads
 * again), or a failure's words. `run` says whether the press saved.
 */
function usePress(onReload?: () => void) {
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<ScheduleChange[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const run = async (press: () => Promise<void>, fallback: string): Promise<boolean> => {
    setBusy(true)
    setRefused(null)
    setFailed(null)
    try {
      await press()
      return true
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        setRefused(refusal.changes)
        onReload?.()
      } else setFailed(formatErrorMessage(e, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, refused, failed, run }
}

/** A press's refusal or failure, in its words, under its buttons. */
function PressNote({ refused, failed }: { refused: ScheduleChange[] | null; failed: string | null }) {
  return (
    <>
      {refused && <GcScheduleRefusal changes={refused} what={NOT_SAVED} />}
      {failed && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.82rem' }}>
          {failed}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// An inspection, in the opened bar's form
// ---------------------------------------------------------------------------------------------

/**
 * An inspection not passed yet, on a job being built (the prototype's `InspectionCheck`): it passed today, a record, or
 * it failed, with what failed, whose work it was and the re-inspection day, a plan write that moves the inspection and
 * what waits on it.
 */
export function GcInspectionCheck({
  project,
  activity,
  today,
  hint,
  onPass,
  onFail,
  onReload,
}: {
  project: GcProject
  activity: ScheduleActivity
  today: string
  hint?: string
  onPass: () => Promise<void>
  /** The failure, the bars as it leaves them and its line in the log (`failInspectionPress`). */
  onFail: (failure: InspectionFailure, activities: ScheduleActivity[], words: string) => Promise<void>
  /** Someone else saved first: read the schedule again. */
  onReload?: () => void
}) {
  const [failing, setFailing] = useState(false)
  const press = usePress(onReload)
  const fails = activity.inspection?.failed ?? []
  const last = fails[fails.length - 1]
  const whose = (ids: string[]) =>
    project.packages
      .filter((k) => ids.includes(k.id))
      .map((k) => k.trade)
      .join(', ')
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
      {last && (
        <div style={{ color: 'var(--text-red-700)' }}>
          Failed {shortDate(last.on)}
          {last.packageIds.length > 0 ? ` on the ${whose(last.packageIds)} work` : ''}: {last.note} Re-inspection {shortDate(last.reinspectOn)}.
          {fails.length > 1 ? ` It has failed ${fails.length} times.` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={press.busy} onClick={() => void press.run(onPass, 'The pass did not save.')}>
          It passed today
        </Btn>
        {!failing && <Btn onClick={() => setFailing(true)}>It failed</Btn>}
        {!failing && hint && <span style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {!failing && <PressNote refused={press.refused} failed={press.failed} />}
      {failing && (
        <InspectionFailForm
          project={project}
          activity={activity}
          today={today}
          busy={press.busy}
          note={<PressNote refused={press.refused} failed={press.failed} />}
          onCancel={() => setFailing(false)}
          onFail={async (note, packageIds, reinspectOn) => {
            const made = failInspectionPress(project, activity.lineId, { note, packageIds, reinspectOn }, today)
            if (!made) return
            // Saved, the form closes; refused, it stays open with the person's words.
            if (await press.run(() => onFail(made.failure, made.activities, made.words), 'The failure did not save.')) setFailing(false)
          }}
        />
      )}
    </div>
  )
}

function InspectionFailForm({
  project,
  activity,
  today,
  busy,
  note: saved,
  onFail,
  onCancel,
}: {
  project: GcProject
  activity: ScheduleActivity
  today: string
  busy: boolean
  /** The press's refusal or failure. */
  note: ReactNode
  onFail: (note: string, packageIds: string[], reinspectOn: string) => void
  onCancel: () => void
}) {
  const inspected = inspectedTrades(project, activity)
  const others = project.packages.filter((k) => !inspected.includes(k) && (k.sow?.status === 'signed' || k.selfPerform))
  const [picked, setPicked] = useState<string[]>(inspected.map((k) => k.id))
  const [note, setNote] = useState('')
  const [again, setAgain] = useState(addDays(today, 3))
  const problem = !note.trim() ? 'Say what failed first.' : !again || again <= today ? 'The re-inspection is after today.' : null
  const box = (id: string, trade: string) => (
    <label key={id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <input type="checkbox" checked={picked.includes(id)} onChange={(e) => setPicked((list) => (e.target.checked ? [...list, id] : list.filter((x) => x !== id)))} />
      <span>{trade}</span>
    </label>
  )
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' } as const
  return (
    <div style={{ padding: '0.65rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.55rem' }}>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>What failed · the trades read this in their portal</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="The main bonding jumper is missing at the service panel."
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </label>
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>Whose work</span>
        <div style={{ display: 'flex', gap: '0.25rem 0.9rem', flexWrap: 'wrap' }}>
          {inspected.map((k) => box(k.id, k.trade))}
          {others.map((k) => box(k.id, k.trade))}
        </div>
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>Re-inspection</span>
        <input type="date" value={again} min={addDays(today, 1)} onChange={(e) => setAgain(e.target.value)} style={input} />
        <span style={{ color: 'var(--text-muted)' }}>The inspection moves to that day. What waits on it moves out.</span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={problem !== null || busy} title={problem ?? undefined} onClick={() => onFail(note, picked, again)}>
          Record the failure
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Keep it
        </Btn>
      </div>
      {saved}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The job's own work (G-38)
// ---------------------------------------------------------------------------------------------

/** The job's own work's buttons in its form (G-38): done today, not done after all, or off the schedule. */
export function GcOwnWorkButtons({
  activity,
  today,
  onDone,
  onRemove,
  onReload,
}: {
  activity: ScheduleActivity
  today: string
  /** Done that day, a record, or not done after all (null). */
  onDone: (on: string | null) => Promise<void>
  /** Off the schedule, a plan write. */
  onRemove: () => Promise<void>
  onReload?: () => void
}) {
  const press = usePress(onReload)
  const added = activity.added
  if (!added) return null
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>{added.who}. Nobody reports it: mark it here.</span>
        {added.doneOn ? (
          <Btn kind="plain" disabled={press.busy} onClick={() => void press.run(() => onDone(null), 'It did not save.')}>
            Not done after all
          </Btn>
        ) : (
          <Btn kind="primary" disabled={press.busy} onClick={() => void press.run(() => onDone(today), 'It did not save.')}>
            Mark it done today
          </Btn>
        )}
        <Btn kind="quiet" disabled={press.busy} onClick={() => void press.run(onRemove, 'The work did not come off.')}>
          Take it off the schedule
        </Btn>
      </div>
      <PressNote refused={press.refused} failed={press.failed} />
    </div>
  )
}

/**
 * An activity that is no trade's line (the Gantt, G-38): mobilize, cure time, the customer's own
 * work. Named, given to someone, dated, and tied in: what it waits on and what waits on it.
 */
export function GcAddOwnWork({
  project,
  items,
  today,
  by,
  onAdd,
  onReload,
}: {
  project: GcProject
  items: ScheduleItem[]
  today: string
  by: string
  /** The bars as the new work leaves them and its line in the log (`ownWorkPress`), a plan write. */
  onAdd: (activities: ScheduleActivity[], words: string) => Promise<void>
  onReload?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [whoPick, setWhoPick] = useState<(typeof ADDED_WHO)[number]>('Cure time')
  const [whoText, setWhoText] = useState('')
  const [start, setStart] = useState(today)
  const [finish, setFinish] = useState(today)
  const [after, setAfter] = useState<string[]>([])
  const [holdsUp, setHoldsUp] = useState<string[]>([])
  const press = usePress(onReload)
  const who = whoPick === 'Someone else' ? whoText : whoPick
  const problem = addedActivityProblem(label, who, start, finish)
  const candidates = items.filter((r) => r.actual < 100)
  const reset = () => {
    setOpen(false)
    setLabel('')
    setWhoText('')
    setAfter([])
    setHoldsUp([])
  }
  if (!open) {
    return (
      <Card>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong>Something that is no trade's line</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>Mobilize, cure time, the customer's own work: a bar of its own, with what it waits on and what waits on it. No dollars; the office marks it done.</span>
          <Btn onClick={() => setOpen(true)}>Add an activity</Btn>
        </div>
      </Card>
    )
  }
  const pick = (list: string[], set: (next: string[]) => void, id: string, on: boolean) => set(on ? [...list, id] : list.filter((x) => x !== id))
  const list = (title: string, chosen: string[], set: (next: string[]) => void, skip: string[]) => (
    <div>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.15rem 0.75rem' }}>
        {candidates
          .filter((r) => !skip.includes(r.activity.lineId))
          .map((r) => (
            <label key={r.activity.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={chosen.includes(r.activity.lineId)} onChange={(e) => pick(chosen, set, r.activity.lineId, e.target.checked)} />
              <span>
                {activityName(r)} <span style={{ color: 'var(--text-muted)' }}>· {shortDate(r.activity.start)} to {shortDate(r.activity.finish)}</span>
              </span>
            </label>
          ))}
      </div>
    </div>
  )
  return (
    <Card style={{ border: '2px solid #2563eb' }}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
        <strong>An activity that is no trade's line</strong>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Slab cure" aria-label="What it is" style={{ ...rowBox, width: '16rem' }} />
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Whose</span>
            <select value={whoPick} onChange={(e) => setWhoPick(e.target.value as (typeof ADDED_WHO)[number])} aria-label="Whose it is" style={rowBox}>
              {ADDED_WHO.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          {whoPick === 'Someone else' && <input value={whoText} onChange={(e) => setWhoText(e.target.value)} placeholder="Who" aria-label="Who it is" style={{ ...rowBox, width: '12rem' }} />}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="The day it starts" style={rowBox} />
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Finishes</span>
            <input type="date" value={finish} min={start} onChange={(e) => setFinish(e.target.value)} aria-label="The day it finishes" style={rowBox} />
          </label>
          {start && finish && finish >= start && <span style={{ color: 'var(--text-muted)' }}>{daysBetween(start, finish) + 1} days</span>}
        </div>
        {list('It waits on', after, setAfter, holdsUp)}
        {list('It holds up', holdsUp, setHoldsUp, after)}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            kind="primary"
            disabled={problem !== null || press.busy}
            title={problem ?? undefined}
            onClick={() => {
              const made = ownWorkPress(project, { label, who, start, finish, after, holdsUp }, by)
              if (!made) return
              void press.run(() => onAdd(made.activities, made.words), 'The work did not go on the schedule.').then((saved) => {
                if (saved) reset()
              })
            }}
          >
            Put it on the schedule
          </Btn>
          <Btn kind="quiet" onClick={reset}>
            Cancel
          </Btn>
          {problem && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{problem}</span>}
          {holdsUp.length > 0 && <span style={{ color: 'var(--text-amber-800)', fontSize: '0.82rem' }}>What waits on it moves out if it has to.</span>}
        </div>
        <PressNote refused={press.refused} failed={press.failed} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// The dates to meet
// ---------------------------------------------------------------------------------------------

/** The milestones: each one's day and the trade it belongs to. Add, move or take one off. */
export function GcMilestones({
  project,
  milestones,
  onSave,
  onRemove,
  door,
}: {
  project: GcProject
  milestones: ScheduleMilestone[]
  /** A milestone set, new or changed: a record. */
  onSave: (m: ScheduleMilestone) => Promise<void>
  /** A milestone taken off: a record. */
  onRemove: (id: string) => Promise<void>
  /** Their dates from a file on a job being built (G-145): the button, or why it is closed. */
  door?: ReactNode
}) {
  const [label, setLabel] = useState('')
  const [planned, setPlanned] = useState('')
  const [packageId, setPackageId] = useState('')
  const press = usePress()
  const save = (m: ScheduleMilestone) => press.run(() => onSave(m), 'The milestone did not save.')
  const sorted = [...milestones].sort((a, b) => (a.planned < b.planned ? -1 : 1))
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <span style={{ fontWeight: 700 }}>Milestones</span>
        {door}
      </div>
      <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
        {sorted.map((m) => (
          <MilestoneLine
            // Keyed by its day too: a date changed from elsewhere (their dates, G-145) draws the line again, never a stale box Save would put back.
            key={`${m.id}:${m.planned}:${m.packageId ?? ''}`}
            project={project}
            milestone={m}
            busy={press.busy}
            onSave={(next) => void save(next)}
            onRemove={() => void press.run(() => onRemove(m.id), 'The milestone did not come off.')}
          />
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A new milestone" style={{ ...rowBox, minWidth: '12rem' }} aria-label="New milestone" />
          <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} style={rowBox} aria-label="New milestone's day" />
          <TradePick project={project} value={packageId} onChange={setPackageId} />
          <Btn
            disabled={!label.trim() || !planned || press.busy}
            onClick={() => {
              void save({ id: `${project.id}-ms-${milestones.length + 1}-${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, planned, packageId: packageId || null, metOn: null }).then((saved) => {
                if (!saved) return
                setLabel('')
                setPlanned('')
                setPackageId('')
              })
            }}
          >
            Add milestone
          </Btn>
        </div>
        <PressNote refused={press.refused} failed={press.failed} />
      </div>
    </Card>
  )
}

function MilestoneLine({ project, milestone, busy, onSave, onRemove }: { project: GcProject; milestone: ScheduleMilestone; busy: boolean; onSave: (m: ScheduleMilestone) => void; onRemove: () => void }) {
  const [planned, setPlanned] = useState(milestone.planned)
  const [packageId, setPackageId] = useState(milestone.packageId ?? '')
  const changed = planned !== milestone.planned || packageId !== (milestone.packageId ?? '')
  // Substantial completion moves with the days signed change orders add (owner, 2026-10-04).
  const sub = /substantial completion/i.test(milestone.label) ? substantialCompletionOn(project) : null
  const moved = sub && sub.days > 0 ? sub : null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ minWidth: '12rem' }}>
        {milestone.label}
        {milestone.metOn && <span style={{ color: 'var(--text-muted)' }}> · met {shortDate(milestone.metOn)}</span>}
        {moved && moved.planned === milestone.planned && (
          <span style={{ color: 'var(--text-amber-800)' }}>
            {' '}
            · {shortDate(moved.on)} with {moved.days} {moved.days === 1 ? 'day' : 'days'} by change order
          </span>
        )}
      </span>
      <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} style={rowBox} aria-label={`${milestone.label} day`} />
      <TradePick project={project} value={packageId} onChange={setPackageId} />
      <Btn disabled={!changed || !planned || busy} onClick={() => onSave({ ...milestone, planned, packageId: packageId || null })}>
        Save
      </Btn>
      <Btn kind="quiet" disabled={busy} onClick={onRemove}>
        Take off
      </Btn>
    </div>
  )
}

function TradePick({ project, value, onChange }: { project: GcProject; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={rowBox} aria-label="Whose milestone">
      <option value="">The job's own</option>
      {project.packages.map((k) => (
        <option key={k.id} value={k.id}>
          {k.trade}
        </option>
      ))}
    </select>
  )
}
