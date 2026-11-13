import { useState, type CSSProperties, type ReactNode } from 'react'
import { SearchableMultiSelect } from '../../SearchableMultiSelect'
import { SearchableSelect } from '../../SearchableSelect'
import { ChecklistCrewTagsRow } from '../ChecklistCrewTagsRow'
import { ChecklistScheduleCalendar } from '../ChecklistScheduleCalendar'
import { TaskPlaceRow } from '../TaskPlaceRow'
import { TaskSpotPhotoField, type TaskSpotPhotoDraft } from '../TaskSpotPhotoField'
import { crewChipState, type CrewView } from '../../../lib/checklistCrewTags'
import { REMINDER_PRESETS, dayBeforeApplicable, reminderSummary } from '../../../lib/checklistReminderOptions'
import { parseLines } from '../../../lib/taskCriteria'
import type { TaskPlaceDraft } from '../../../lib/tasks/taskPlace'
import {
  dropSoloSelfWhenAddingOthers,
  taskAddRow,
  taskFaces,
  taskPersonName,
  toggleFace,
  whenBarChoice,
  whenBarDayLabel,
  whenBarPick,
  type TaskAddKey,
  type TaskAddPress,
} from '../../../lib/tasks/newTaskWindow'
import { TaskFacesRow, type TaskCrewFace } from './TaskFacesRow'
import { TaskWhenBar } from './TaskWhenBar'
import { TaskAddRow } from './TaskAddRow'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The fields the rows read and write. Both task windows keep them in their own form under these names. */
export interface TaskFormValue {
  links: string[]
  assigned_to_user_ids: string[]
  repeat_days_of_week: number[]
  repeat_days_after: number
  repeat_end_date: string
  start_date: string
  due_date: string
  show_until_completed: boolean
  notify_on_complete_user_id: string
  reminder_time: string
  reminder_daily: boolean
  remind_day_before: boolean
  escalate_enabled: boolean
  escalate_days: number
}

type Person = { id: string; name: string; email: string }

type Props = {
  value: TaskFormValue
  /** A patch of the fields that changed. The window merges it into its form. */
  onChange: (patch: Partial<TaskFormValue>) => void
  when: 'today' | 'date' | 'repeat'
  onWhen: (when: 'today' | 'date' | 'repeat') => void
  repeatMode: 'weekly' | 'after_done'
  onRepeatMode: (mode: 'weekly' | 'after_done') => void
  /** The Done when… lines, one a row, as typed. */
  linesText: string
  onLinesText: (text: string) => void
  /** The words under the lines box. */
  linesHint: string
  asksForPhoto: boolean
  onAsksForPhoto: (next: boolean) => void
  place: TaskPlaceDraft | null
  onPlace: (next: TaskPlaceDraft | null) => void
  spotPhoto: TaskSpotPhotoDraft | null
  onSpotPhoto: (next: TaskSpotPhotoDraft | null) => void
  /** The window is saving: the photo press waits. */
  busy: boolean
  users: Person[]
  meId: string | null
  /** The people given to last, from `recentAssigneeIds`. */
  recentIds: readonly string[]
  /** People who get a face though they are not recent: whoever the window opened on. */
  seatIds: readonly string[]
  /**
   * The New task window's rule: a task that was only the giver's becomes the other person's alone when one is
   * added. An edit adds a person beside whoever is there, so it turns the rule off.
   */
  soloSelfRule: boolean
  canSeeReach: boolean
  pushEnabledIds: Set<string> | null
  phone: boolean
  todayStr: string
  /** The id of the people search box, for the window's Tab cycle. */
  searchId: string
  /** Tab on the people search box. The window sends the focus on. */
  onSearchTab?: (shift: boolean) => void
  /** Put link `[n]` into the task's words at the cursor. */
  onLinkToken: (index: number) => void
  /** A press of the Add row to open with, such as `link` for a task that arrives with links. */
  initialOpen?: TaskAddKey | null
  /** Shown under the due day's box: an edit says when the day was first set. */
  dueNote?: ReactNode
  /** Shown under the When row: an edit says what a save does to the days already made. */
  whenNote?: ReactNode
  /** The layer of what the rows open through a portal, over the window that holds them. Left out, each keeps its own. */
  pickerZIndex?: number
}

const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)', alignItems: 'center' }
const labStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const panelStyle: CSSProperties = { gridColumn: '1 / -1', padding: '9px 10px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', minWidth: 0, fontSize: '0.875rem' }
const takeOff: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.8125rem', fontFamily: 'inherit' }
const choiceStyle: CSSProperties = { flex: '0 1 auto', padding: '0.45rem 0.7rem', fontSize: '0.875rem', borderRadius: 9, cursor: 'pointer' }
const lit = (on: boolean): CSSProperties => ({
  border: on ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-800)' : 'var(--text-700)',
  fontWeight: on ? 600 : 400,
})

/**
 * The rows of a task window under its words (punch list #331): **For**, **When**, **Where** and **Add**, with the
 * panel each one opens. The New task window and the Edit task window draw the same rows from here, so the two
 * cannot drift apart. The window keeps the form and the save; the rows keep only what is open.
 */
export function TaskFormRows(props: Props) {
  const { value, onChange, when, repeatMode, meId, users, todayStr, phone } = props
  const [addOpen, setAddOpen] = useState<TaskAddKey | null>(props.initialOpen ?? null)
  const [listOpen, setListOpen] = useState(false)
  /** People picked from the full list while the window is open. They take a face after Me. */
  const [pickedFromList, setPickedFromList] = useState<string[]>([])
  /** The day bar: Tomorrow was pressed, as against that day picked in the date box. */
  const [asTomorrow, setAsTomorrow] = useState(false)
  /** The crews, as the crew row inside the full list loaded them; the faces draw one each. */
  const [crews, setCrews] = useState<CrewView[]>([])
  const [customTimeOpen, setCustomTimeOpen] = useState(false)

  const nameOf = (id: string) => taskPersonName(users.find((u) => u.id === id))
  const assignees = value.assigned_to_user_ids
  const ruleMe = props.soloSelfRule ? meId : null
  const faces = taskFaces({ meId, roster: users, recentIds: props.recentIds, extraIds: [...props.seatIds, ...pickedFromList] })
  const assigneeMap = Object.fromEntries(assignees.map((id) => [id, true]))
  const crewFaces: TaskCrewFace[] = crews
    .filter((c) => c.memberUserIds.length > 0)
    .map((c) => ({ id: c.id, name: c.name, count: c.memberUserIds.length, state: crewChipState(c.memberUserIds, assigneeMap) }))
  // One tap staffs the whole crew; the solo-self rule applies to a crew like a single pick.
  const staffCrew = (memberIds: string[], checked: boolean) => {
    const proposed = checked ? [...assignees, ...memberIds.filter((id) => !assignees.includes(id))] : assignees.filter((id) => !memberIds.includes(id))
    onChange({ assigned_to_user_ids: checked ? dropSoloSelfWhenAddingOthers(assignees, proposed, ruleMe) : proposed })
  }
  const selectOptions = users.map((u) => ({ value: u.id, label: u.name?.trim() || u.email }))
  const whenChoice = whenBarChoice({ when, startDate: value.start_date }, todayStr, asTomorrow)
  const lineCount = parseLines(props.linesText).length
  const tellOtherName = value.notify_on_complete_user_id ? nameOf(value.notify_on_complete_user_id) : null
  const addPresses = taskAddRow({
    when,
    reminderTime: value.reminder_time,
    tellOtherName,
    linkCount: value.links.filter((u) => u.trim()).length,
    dueDate: value.due_date,
    lineCount,
    asksForPhoto: props.asksForPhoto,
    staysUntilDone: value.show_until_completed,
  })
  // A panel belongs to a press on the row, so it closes with a press that has left the row (Due by on a repeating task).
  const openPanel = addOpen && addPresses.some((p) => p.key === addOpen) ? addOpen : null
  const onAddPress = (press: TaskAddPress) => {
    if (press.key === 'photo') return props.onAsksForPhoto(!props.asksForPhoto)
    if (press.key === 'oneDay') return onChange({ show_until_completed: !value.show_until_completed })
    const opening = openPanel !== press.key
    setAddOpen(opening ? press.key : null)
    // A first link has its box waiting, so the press is one press to a place to type.
    if (opening && press.key === 'link' && value.links.length === 0) onChange({ links: [''] })
    if (opening && press.key === 'remind' && !value.reminder_time) setCustomTimeOpen(false)
  }
  const dayBefore = dayBeforeApplicable(when, value.start_date, todayStr)

  return (
    <>
      {/* ── For: who the task is for, as faces ── */}
      <div style={{ ...rowStyle, alignItems: 'start' }} role="group" aria-labelledby={`${props.searchId}-label`}>
        <span id={`${props.searchId}-label`} style={{ ...labStyle, paddingTop: 13 }}>
          For
        </span>
        <TaskFacesRow
          faces={faces}
          pickedIds={assignees}
          onToggle={(id) => onChange({ assigned_to_user_ids: toggleFace(assignees, id, ruleMe) })}
          crews={crewFaces}
          onCrew={(crewId) => {
            const crew = crews.find((c) => c.id === crewId)
            if (crew) staffCrew(crew.memberUserIds, crewChipState(crew.memberUserIds, assigneeMap) !== 'all')
          }}
          listOpen={listOpen}
          onList={() => setListOpen((o) => !o)}
          phone={phone}
        />
        {/* The full list, in place. It stays mounted while closed, since the crew row inside it loads the crews the faces draw. */}
        <div
          hidden={!listOpen}
          data-testid="new-task-everyone"
          style={panelStyle}
          onKeyDown={(e) => {
            if (e.key !== 'Tab' || !props.onSearchTab) return
            if ((e.target as HTMLElement).id !== props.searchId) return
            e.preventDefault()
            props.onSearchTab(e.shiftKey)
          }}
        >
          <SearchableMultiSelect
            id={props.searchId.replace(/-search$/, '')}
            searchPlaceholder="Search people…"
            options={selectOptions}
            value={assignees}
            onChange={(ids) => {
              // A person picked here takes a seat right after Me, so the pick shows on the row.
              setPickedFromList((prev) => [...prev, ...ids.filter((id) => id !== meId && !props.recentIds.includes(id) && !props.seatIds.includes(id) && !prev.includes(id))])
              onChange({ assigned_to_user_ids: dropSoloSelfWhenAddingOthers(assignees, ids, ruleMe) })
            }}
            listAriaLabel="Assign to"
            pinSelectedToTop
            keyboardSelect
          />
          <div style={{ marginTop: 8 }}>
            {/* Crew chips (People → Teams): one tap staffs the whole crew, and New crew and Edit live here. */}
            <ChecklistCrewTagsRow users={users} assignees={assigneeMap} currentUserId={meId} onStaffCrew={staffCrew} onCrewsLoaded={setCrews} />
          </div>
        </div>
      </div>

      {/* ── When: one joined bar, over the When control of v2.2058 ── */}
      <div style={rowStyle}>
        <span style={labStyle}>When</span>
        <TaskWhenBar
          choice={whenChoice}
          dayLabel={whenBarDayLabel(whenChoice, value.start_date)}
          onPick={(choice) => {
            const next = whenBarPick(choice, { when, startDate: value.start_date }, todayStr)
            setAsTomorrow(choice === 'tomorrow')
            props.onWhen(next.when)
            onChange({ start_date: next.startDate })
          }}
        />
        {whenChoice === 'day' ? (
          <div style={panelStyle}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Do on</span>
              <input type="date" value={value.start_date} min={todayStr} onChange={(e) => onChange({ start_date: e.target.value })} style={{ padding: '0.4rem' }} />
            </label>
          </div>
        ) : null}
        {when === 'repeat' ? (
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Task cards (#273, v2.6617): the one thing a writer decides here without knowing it. */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="repeat-ring-hint">
              A repeating task keeps its tick. A one-off gets the % ring.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['weekly', 'Weekly on…'], ['after_done', "— days after it's done"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => props.onRepeatMode(key)} aria-pressed={repeatMode === key} style={{ ...choiceStyle, ...lit(repeatMode === key) }}>
                  {label}
                </button>
              ))}
            </div>
            {repeatMode === 'weekly' ? (
              <>
                <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Days of the week">
                  {DAYS.map((name, i) => {
                    const on = value.repeat_days_of_week.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        aria-label={name}
                        onClick={() =>
                          onChange({ repeat_days_of_week: on ? value.repeat_days_of_week.filter((d) => d !== i) : [...value.repeat_days_of_week, i].sort((a, b) => a - b) })
                        }
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '0.35rem 0',
                          borderRadius: 8,
                          fontSize: '0.8125rem',
                          fontWeight: on ? 700 : 400,
                          border: on ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                          background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          color: on ? 'var(--text-blue-800)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {name[0]}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                    <input type="date" value={value.start_date} onChange={(e) => onChange({ start_date: e.target.value })} style={{ padding: '0.4rem' }} />
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ends (optional)</span>
                    <input type="date" value={value.repeat_end_date} onChange={(e) => onChange({ repeat_end_date: e.target.value })} style={{ padding: '0.4rem' }} />
                  </label>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Repeat</span>
                  <input
                    type="number"
                    min={1}
                    value={value.repeat_days_after}
                    onChange={(e) => onChange({ repeat_days_after: Number(e.target.value) || 1 })}
                    style={{ padding: '0.4rem', width: 64 }}
                  />
                  <span>days after it's completed</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                  <input type="date" value={value.start_date} onChange={(e) => onChange({ start_date: e.target.value })} style={{ padding: '0.4rem' }} />
                </label>
              </div>
            )}
          </div>
        ) : null}
        {/* The schedule drawn (punch list #217, office-13): this week and the next three. It draws for a repeating
            task, a picked day and a one-off with a due day. Tomorrow needs no picture, the sentence says it, and a
            day that has passed is not on these weeks at all. */}
        {when !== 'repeat' && !value.due_date && (whenChoice === 'tomorrow' || value.start_date < todayStr) ? null : (
          <div style={{ gridColumn: '1 / -1', minWidth: 0 }} data-testid="new-task-calendar">
            <ChecklistScheduleCalendar
              input={{
                when,
                repeatMode,
                startDate: value.start_date,
                todayStr,
                daysOfWeek: value.repeat_days_of_week,
                daysAfter: value.repeat_days_after,
                endDate: value.repeat_end_date || null,
                dueDate: when !== 'repeat' ? value.due_date || null : null,
              }}
            />
          </div>
        )}
        {props.whenNote ? <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{props.whenNote}</div> : null}
      </div>

      {/* ── Where: the place and the photo of the spot on one row (#328) ── */}
      <div style={rowStyle}>
        <span style={labStyle}>Where</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 6, alignItems: 'center', minWidth: 0 }}>
          <TaskPlaceRow value={props.place} onChange={props.onPlace} variant="shelf" {...(props.pickerZIndex != null ? { sheetZIndex: props.pickerZIndex } : {})} />
          <TaskSpotPhotoField value={props.spotPhoto} onChange={props.onSpotPhoto} busy={props.busy} variant="press" />
        </div>
      </div>

      {/* ── Add: the rare things, each by name. A press opens that one thing here. ── */}
      <div style={{ ...rowStyle, alignItems: 'start', paddingBottom: 14 }}>
        <span style={{ ...labStyle, paddingTop: 9 }}>Add</span>
        <TaskAddRow presses={addPresses} openKey={openPanel} onPress={onAddPress} />

        {openPanel === 'remind' ? (
          /* Remind (v2.2096): open to every task creator — preset chips, plain-words options, reachability. */
          <div style={panelStyle} data-testid="new-task-panel-remind">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(() => {
                const isPreset = REMINDER_PRESETS.some((p) => p.time === value.reminder_time)
                const customVisible = customTimeOpen || (value.reminder_time !== '' && !isPreset)
                const chips: Array<{ label: string; active: boolean; onClick: () => void }> = [
                  {
                    label: 'No reminder',
                    active: !value.reminder_time && !customVisible,
                    onClick: () => {
                      onChange({ reminder_time: '' })
                      setCustomTimeOpen(false)
                    },
                  },
                  ...REMINDER_PRESETS.map((p) => ({
                    label: p.label,
                    active: !customVisible && value.reminder_time === p.time,
                    onClick: () => {
                      onChange({ reminder_time: p.time })
                      setCustomTimeOpen(false)
                    },
                  })),
                  { label: 'Custom…', active: customVisible, onClick: () => setCustomTimeOpen(true) },
                ]
                return chips.map((c) => (
                  <button key={c.label} type="button" aria-pressed={c.active} onClick={c.onClick} style={{ ...choiceStyle, ...lit(c.active) }}>
                    {c.label}
                  </button>
                ))
              })()}
            </div>
            {(customTimeOpen || (value.reminder_time !== '' && !REMINDER_PRESETS.some((p) => p.time === value.reminder_time))) && (
              <label style={{ display: 'block', marginTop: '0.6rem' }}>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Remind at (CST)</span>
                <input type="time" value={value.reminder_time} onChange={(e) => onChange({ reminder_time: e.target.value })} style={{ padding: '0.5rem' }} />
              </label>
            )}
            {value.reminder_time ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input type="checkbox" checked={value.reminder_daily} onChange={(e) => onChange({ reminder_daily: e.target.checked })} />
                  Keep reminding every day until it&apos;s done
                </label>
                {dayBefore && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <input type="checkbox" checked={value.remind_day_before} onChange={(e) => onChange({ remind_day_before: e.target.checked })} />
                    Also remind the day before it&apos;s due
                  </label>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.95rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={value.escalate_enabled} onChange={(e) => onChange({ escalate_enabled: e.target.checked })} />
                    Still not done after
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={value.escalate_days}
                    disabled={!value.escalate_enabled}
                    onChange={(e) => onChange({ escalate_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                    aria-label="Days overdue before reminding the creator"
                    style={{ width: 52, padding: '0.25rem 0.35rem' }}
                  />
                  <span>days? Remind me too</span>
                </div>
                {props.canSeeReach && props.pushEnabledIds && assignees.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.55rem' }}>
                    {assignees.map((uid) => (
                      <span key={uid}>
                        <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{nameOf(uid)}</b>{' '}
                        {props.pushEnabledIds?.has(uid) ? (
                          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{'📱'} phone alert</span>
                        ) : (
                          <>
                            <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{'✉️'} email</span>
                            <span> {'—'} no phone alerts set up</span>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const s = reminderSummary(
                    {
                      time: value.reminder_time,
                      dailyUntilDone: value.reminder_daily,
                      dayBefore: value.remind_day_before && dayBefore,
                      escalateAfterDays: value.escalate_enabled ? value.escalate_days : null,
                    },
                    assignees.map(nameOf).filter((n) => n !== '…'),
                  )
                  return s ? (
                    <div data-testid="new-task-reminder-summary" style={{ color: 'var(--text-green-700)', fontSize: '0.85rem' }}>
                      {s}
                    </div>
                  ) : null
                })()}
              </div>
            ) : null}
          </div>
        ) : null}

        {openPanel === 'tellOther' ? (
          /* Notify (v2.2058): who else hears when the task is done. The giver's own bell is beside Send. */
          <div style={panelStyle} data-testid="new-task-panel-tell">
            <span style={{ display: 'block', marginBottom: '0.35rem' }}>Who else hears when it is done?</span>
            <SearchableSelect
              id={`${props.searchId}-notify`}
              value={value.notify_on_complete_user_id}
              onChange={(id) => onChange({ notify_on_complete_user_id: id })}
              options={selectOptions}
              emptyOption={{ value: '', label: '— add someone else —' }}
              placeholder="— add someone else —"
              listAriaLabel="Also notify when completed"
              {...(props.pickerZIndex != null ? { portalZIndex: props.pickerZIndex } : {})}
              searchReplacesTrigger
              hideEmptyOptionInListWhenUnset
            />
          </div>
        ) : null}

        {openPanel === 'link' ? (
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="new-task-panel-link">
            {value.links.map((url, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  title="Put this link's number in the task's words"
                  onClick={() => props.onLinkToken(i)}
                  style={{ flexShrink: 0, padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  [{i + 1}]
                </button>
                <input
                  type="url"
                  value={url}
                  aria-label={`Link ${i + 1}`}
                  onChange={(e) => onChange({ links: value.links.map((u, j) => (j === i ? e.target.value : u)) })}
                  placeholder="URL"
                  style={{ flex: 1, minWidth: 0, padding: '0.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => onChange({ links: value.links.filter((_, j) => j !== i) })}
                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}
                  aria-label={`Remove link ${i + 1}`}
                  title="Remove link"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ links: [...value.links, ''] })} style={{ ...takeOff, alignSelf: 'flex-start', color: 'var(--text-link)' }}>
              Add another link
            </button>
          </div>
        ) : null}

        {openPanel === 'due' ? (
          /* Due by (v2.2351): optional deadline — on the list from its day, late after this. */
          <div style={panelStyle} data-testid="new-task-panel-due">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Due by</span>
              <input
                type="date"
                value={value.due_date}
                min={when === 'today' ? todayStr : value.start_date || undefined}
                onChange={(e) => onChange({ due_date: e.target.value })}
                style={{ padding: '0.4rem' }}
              />
            </label>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>The task is late after this day. A task with a due day stays until it is done.</div>
            {value.due_date ? (
              <button type="button" onClick={() => onChange({ due_date: '' })} style={{ ...takeOff, display: 'block', marginTop: '0.4rem' }}>
                Take it off
              </button>
            ) : null}
          </div>
        ) : null}
        {/* An edit's note on the due day shows whenever there is one, open panel or not: it is the task's history. */}
        {props.dueNote && when !== 'repeat' && value.due_date ? <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>{props.dueNote}</div> : null}

        {openPanel === 'lines' ? (
          /* Task cards (#273, PR 2): Done when…, the lines the person ticks; the card reads its percent from them. */
          <div style={panelStyle} data-testid="new-task-panel-lines">
            <textarea
              value={props.linesText}
              onChange={(e) => props.onLinesText(e.target.value)}
              rows={3}
              aria-label="Done when"
              placeholder="One line a row. Each becomes a box the person ticks."
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', fontSize: '1rem', fontFamily: 'inherit', lineHeight: 1.4 }}
            />
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{props.linesHint}</div>
          </div>
        ) : null}
      </div>
    </>
  )
}
