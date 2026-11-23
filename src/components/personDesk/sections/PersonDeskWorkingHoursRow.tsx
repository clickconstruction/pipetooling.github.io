/**
 * Working hours on a person's sheet (punch list #429, PR 3): a start and an end for each day, set by a dev or the
 * controller in 15-minute blocks. Days that share their hours are one line, and a line changes whole: a press on
 * its hours opens the line's own field there, with its start, its end, when it starts and what the change comes
 * to, pay included. Anyone else who reads the sheet sees the same lines with no press and a tag that says who can.
 *
 * The rules are `workingHours.ts` and `workingHoursEdit.ts`; the door is `set_working_hours` through
 * `workingHoursIo.ts`. The looks are the `.vip…` classes (values in place) and the `.wh…` classes in `index.css`.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { AvailableHoursAnswer } from '../../../lib/people/utilization'
import type { Segment, WeekDays } from '../../../lib/people/weekAvailability'
import {
  formatHours,
  halfDay,
  setRowInForce,
  usualWorkingDay,
  workingClockChoices,
  workingDayHours,
  workingDaysCountWords,
  workingDaysLabel,
  workingHoursComing,
  workingHoursHistory,
  workingHoursLines,
  workingHoursStarts,
  workingLineHoursWords,
  workingRangesWords,
  workingWeekFromPaidWeek,
  workingWeekHours,
  workingWeekLineWords,
  type WorkingHoursLine,
} from '../../../lib/people/workingHours'
import { FIRST_WORKING_DAYS, FIRST_WORKING_RANGE, NO_WORKING_WEEK, workingHoursFieldPlan, workingSundayWords, type WorkingHoursFacts } from '../../../lib/people/workingHoursEdit'
import { supabaseWorkingHoursIo, type WorkingHoursIo } from '../../../lib/people/workingHoursIo'
import { salariedWeekWords } from '../../../lib/salariedEffectiveHours'
import { ValueSentence, WorkedOutValue } from '../../valuesInPlace/ValuesInPlace'
import { DeskRow, LockTag } from '../personDeskShared'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const START_CHOICES = workingClockChoices('start')
const END_CHOICES = workingClockChoices('end')

/** The open field: one line's days and the ranges typed for them. `picking` asks which day leaves the line. */
type Open = { dows: number[]; segs: Segment[]; start: 'this' | 'next'; reason: string; picking: boolean }
/** The first time, for a person on a set week: only the start is asked, and each day runs its paid hours. */
type Starter = { startMinute: number; start: 'this' | 'next' }

export function PersonDeskWorkingHoursRow({
  userId,
  displayName,
  viewer,
  pay,
  lastReportEndYmd,
  changeKey,
  onChanged,
  onHours,
  io: ioIn,
  todayYmd: todayIn,
}: {
  /** The person's login. Working hours are kept on the account, so a roster row with no login has none. */
  userId: string | null
  displayName: string
  viewer: PersonDeskViewer
  /** The pay row as the sheet read it; null while it loads or with none. */
  pay: { isSalary: boolean; paidWeek: readonly number[] } | null
  lastReportEndYmd: string | null
  changeKey: number
  onChanged: () => void
  /** The set week in force today, for the pay form beside this row: null with none. */
  onHours?: (days: WeekDays | null) => void
  io?: WorkingHoursIo
  todayYmd?: string
}) {
  const io = useMemo(() => ioIn ?? supabaseWorkingHoursIo(), [ioIn])
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const todayYmd = todayIn ?? todayYmdInAppTz()
  const [rows, setRows] = useState<AvailableHoursAnswer[] | undefined>(undefined)
  const [names, setNames] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [starter, setStarter] = useState<Starter | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveWhy, setSaveWhy] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)

  const canSet = (viewer.isDev || viewer.role === 'controller') && !viewer.readOnly

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const read = await io.rows(userId)
      setRows(read)
      setFailed(null)
      const setters = read.filter((r) => r.kind === 'set' && r.set_by).map((r) => r.set_by as string)
      setNames(setters.length ? await io.names(setters).catch(() => ({})) : {})
    } catch (e) {
      setFailed(formatErrorMessage(e, 'The working hours did not load'))
    }
  }, [io, userId])
  useEffect(() => {
    void load()
  }, [load, changeKey])

  const inForce = rows ? setRowInForce(rows, todayYmd) : null
  const current: WeekDays | null = inForce?.days ?? null
  const coming = rows ? workingHoursComing(rows, todayYmd) : null
  useEffect(() => {
    if (rows !== undefined) onHours?.(current)
    // The week is the message; the callback's identity is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, JSON.stringify(current)])

  const firstName = displayName.trim().split(/\s+/)[0] || displayName
  const facts: WorkingHoursFacts = { current, isSalary: !!pay?.isSalary, paidWeek: pay?.isSalary ? pay.paidWeek : null, firstName, todayYmd, lastReportEndYmd }
  const starts = workingHoursStarts(todayYmd)
  const plan = open ? workingHoursFieldPlan(facts, open) : null
  const paidHours = pay?.isSalary ? pay.paidWeek.reduce((a, h) => a + (Number(h) || 0), 0) : 0

  async function save(days: WeekDays | null, effectiveFrom: string, reason: string | null, done: string) {
    if (!userId) return
    setBusy(true)
    setSaveWhy(null)
    try {
      await io.save({ userId, days, effectiveFrom, reason })
      setOpen(null)
      setStarter(null)
      showToast(done, 'success')
      await load()
      onChanged()
    } catch (e) {
      // The field stays open with what was typed, and says the database's own reason.
      setSaveWhy(formatErrorMessage(e, 'The working hours did not save'))
    } finally {
      setBusy(false)
    }
  }

  async function takeOff() {
    const ok = await confirmDialog({
      message: `Take working hours off ${displayName}? From this week nothing holds them to a start and an end.${pay?.isSalary ? ' Their set week on pay stays as it is.' : ''} What the hours were is kept under Earlier hours.`,
      confirmLabel: 'Take working hours off',
      danger: true,
    })
    if (ok) await save(null, starts.thisWeek, null, 'Working hours taken off')
  }

  const lock = canSet ? null : <LockTag label="dev or controller" title="A dev or the controller sets working hours. They are shown so you know where they stand." />

  if (!userId) {
    return (
      <DeskRow label="Working hours" stack>
        <span style={{ color: 'var(--text-muted)' }}>Needs a login. Working hours are kept on the person&rsquo;s account.</span>
      </DeskRow>
    )
  }
  if (failed) {
    return (
      <DeskRow label="Working hours" stack>
        <span role="alert" style={{ color: 'var(--text-red-600)' }}>
          {failed}
        </span>
        <button type="button" className="whQuiet" onClick={() => void load()}>
          Read them again
        </button>
      </DeskRow>
    )
  }
  if (rows === undefined) {
    return (
      <DeskRow label="Working hours" stack>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </DeskRow>
    )
  }

  /** The field under an open line: its ranges, when it starts, what it comes to, and the small moves. */
  const field = (o: Open) => {
    if (!plan) return null
    const setSeg = (i: number, which: 0 | 1, minute: number) => {
      const segs = o.segs.map(([s, e]): Segment => [s, e])
      const seg = segs[i]
      if (!seg) return
      seg[which] = minute
      setOpen({ ...o, segs })
    }
    const base = current ?? NO_WORKING_WEEK
    const others = usualWorkingDay(base, o.dows)
    const sameAsOthers = !!others && others.length === o.segs.length && others.every(([s, e], i) => s === o.segs[i]![0] && e === o.segs[i]![1])
    const usual = o.dows.length === 1 && others && !sameAsOthers ? others : null
    const first = o.segs[0]
    return (
      <div className="whField" data-working-hours-field>
        <div className="whFieldLine">
          <span className="whFieldLabel">{workingDaysLabel(o.dows)} from</span>
          {o.segs.length === 0 ? (
            <WorkedOutValue>Off</WorkedOutValue>
          ) : (
            o.segs.map(([s, e], i) => (
              <Fragment key={i}>
                {i > 0 ? <span className="whFieldLabel">then</span> : null}
                <select className="vipInput" aria-label={i === 0 ? 'Start' : 'Start after the break'} value={String(s)} onChange={(ev) => setSeg(i, 0, Number(ev.target.value))}>
                  {START_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className="whFieldLabel">to</span>
                <select className="vipInput" aria-label={i === 0 && o.segs.length > 1 ? 'End before the break' : 'End'} value={String(e)} onChange={(ev) => setSeg(i, 1, Number(ev.target.value))}>
                  {END_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Fragment>
            ))
          )}
        </div>
        <div className="whFieldLine">
          <span className="whFieldLabel">Starts</span>
          <span className="whSeg" role="group" aria-label="When these hours start">
            <button type="button" aria-pressed={plan.startLocked || o.start === 'this'} onClick={() => setOpen({ ...o, start: 'this' })}>
              This week
            </button>
            <button type="button" aria-pressed={!plan.startLocked && o.start === 'next'} disabled={plan.startLocked} onClick={() => setOpen({ ...o, start: 'next' })}>
              Next week
            </button>
          </span>
          <span className="vipNote" style={{ width: 'auto', minWidth: 0 }}>
            {plan.startLocked ? 'A change in pay starts this week.' : `From ${workingSundayWords(plan.effectiveFrom)}.`}
          </span>
        </div>
        <div className="vipNote" data-working-hours-comes-to>
          {/* One span around the sentence: the note's own rule puts a space between its pieces, and would part a value from its full stop. */}
          <span>
            <ValueSentence text={plan.sentence} />
          </span>
        </div>
        {plan.pay ? (
          <div className={plan.pay.moves ? 'whPay whPay--moves' : 'whPay'} data-working-hours-pay>
            <ValueSentence text={plan.pay.words} />
          </div>
        ) : null}
        {o.picking ? (
          <div className="whFieldLine" data-working-hours-pick>
            <span className="whFieldLabel">Which day?</span>
            {o.dows.map((d) => (
              <button key={d} type="button" className="whChip" onClick={() => setOpen({ ...o, dows: [d], picking: false })}>
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        ) : null}
        {plan.needsReason ? (
          <div className="whFieldLine">
            <label className="whFieldLabel" htmlFor="working-hours-why">
              Why
            </label>
            <input id="working-hours-why" className="vipInput vipReason" value={o.reason} placeholder="It goes on the pay log" onChange={(ev) => setOpen({ ...o, reason: ev.target.value })} />
          </div>
        ) : null}
        <div className="whFieldLine">
          <button type="button" className="vipKeep" disabled={busy || !plan.keep.ok} onClick={() => void save(plan.week, plan.effectiveFrom, plan.needsReason ? o.reason.trim() : null, 'Working hours saved')}>
            Keep
          </button>
          <button type="button" className="vipCancel" disabled={busy} onClick={() => {
              setOpen(null)
              setSaveWhy(null)
            }}>
            Cancel
          </button>
          {!plan.keep.ok && plan.keep.why ? <span className="vipNote vipWhy" style={{ width: 'auto', minWidth: 0 }}>{plan.keep.why}</span> : null}
        </div>
        {saveWhy ? (
          <div role="alert" className="vipNote vipWhy">
            {saveWhy}
          </div>
        ) : null}
        <div className="whFieldLine whMoves">
          {o.dows.length > 1 && !o.picking ? (
            <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, picking: true })}>
              Give one day its own hours
            </button>
          ) : null}
          {o.dows.length === 1 && first ? (
            <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, segs: halfDay(o.segs) })}>
              Half day
            </button>
          ) : null}
          {usual ? (
            <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, segs: usual.map(([s, e]): Segment => [s, e]) })}>
              Same as the other days
            </button>
          ) : null}
          {o.segs.length === 1 && first && first[1] - first[0] >= 90 ? (
            <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, segs: withBreak(first) })}>
              Add a break
            </button>
          ) : null}
          {o.segs.length === 2 ? (
            <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, segs: [[o.segs[0]![0], o.segs[1]![1]]] })}>
              Take the break out
            </button>
          ) : null}
          <button type="button" className="whQuiet" onClick={() => setOpen({ ...o, segs: o.segs.length ? [] : (others ?? [FIRST_WORKING_RANGE]).map(([s, e]): Segment => [s, e]) })}>
            {o.segs.length ? (o.dows.length > 1 ? 'Make them days off' : 'Make it a day off') : o.dows.length > 1 ? 'Give them hours' : 'Give it hours'}
          </button>
        </div>
      </div>
    )
  }

  /** The lines as drawn: a day picked out of a line sits on its own while its field is open. */
  const shown: WorkingHoursLine[] = []
  for (const line of workingHoursLines(current ?? NO_WORKING_WEEK)) {
    if (open && current && line.days.includes(open.dows[0] ?? -1) && open.dows.length < line.days.length) {
      shown.push({ days: line.days.filter((d) => !open.dows.includes(d)), segs: line.segs })
      shown.push({ days: [...open.dows], segs: line.segs })
    } else shown.push(line)
  }
  const isOpenLine = (line: WorkingHoursLine) => !!open && line.days.length === open.dows.length && line.days.every((d, i) => d === open.dows[i])

  /** The first time, for a person on a set week: one question, the start. */
  const starterField = (s: Starter) => {
    if (!pay) return null
    const week = workingWeekFromPaidWeek(pay.paidWeek, s.startMinute)
    const firstDay = week?.find((d) => d.length > 0)?.[0] ?? null
    const sameLength = week ? new Set(week.filter((d) => d.length > 0).map((d) => d[0]![1] - d[0]![0])).size === 1 : false
    return (
      <div className="whField" data-working-hours-starter>
        <div className="whFieldLine">
          <label className="whFieldLabel" htmlFor="working-hours-starter">
            Each day starts at
          </label>
          <select id="working-hours-starter" className="vipInput" value={String(s.startMinute)} onChange={(ev) => setStarter({ ...s, startMinute: Number(ev.target.value) })}>
            {START_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="whFieldLabel">Starts</span>
          <span className="whSeg" role="group" aria-label="When these hours start">
            <button type="button" aria-pressed={s.start === 'this'} onClick={() => setStarter({ ...s, start: 'this' })}>
              This week
            </button>
            <button type="button" aria-pressed={s.start === 'next'} onClick={() => setStarter({ ...s, start: 'next' })}>
              Next week
            </button>
          </span>
        </div>
        {week && firstDay ? (
          <div className="vipNote">
            {sameLength ? (
              <>
                Each day would be <WorkedOutValue>{workingRangesWords([firstDay])}</WorkedOutValue>. The end is worked out from their set week.
              </>
            ) : (
              <>
                The week would be <WorkedOutValue>{workingWeekLineWords(week)}</WorkedOutValue>. Each end is worked out from their set week.
              </>
            )}
          </div>
        ) : (
          <div className="vipNote vipWhy">A day would run past midnight from that start. Pick an earlier one.</div>
        )}
        {week ? <div className="whPay">Each day keeps its length, so pay does not move.</div> : null}
        {saveWhy ? (
          <div role="alert" className="vipNote vipWhy">
            {saveWhy}
          </div>
        ) : null}
        <div className="whFieldLine">
          <button type="button" className="vipKeep" disabled={busy || !week} onClick={() => week && void save(week, s.start === 'this' ? starts.thisWeek : starts.nextWeek, null, 'Working hours set')}>
            Set these hours
          </button>
          <button type="button" className="vipCancel" disabled={busy} onClick={() => {
              setStarter(null)
              setSaveWhy(null)
            }}>
            Cancel
          </button>
          <button
            type="button"
            className="whQuiet"
            onClick={() => {
              setStarter(null)
              setOpen({ dows: [...FIRST_WORKING_DAYS], segs: [[FIRST_WORKING_RANGE[0], FIRST_WORKING_RANGE[1]]], start: 'this', reason: '', picking: false })
            }}
          >
            Set other hours
          </button>
        </div>
      </div>
    )
  }

  // ---------- nobody has set hours ----------
  if (!current) {
    return (
      <DeskRow label="Working hours" stack actions={lock}>
        <div className="whBlock" data-working-hours="none">
          {!open && !starter ? (
            <div className="whFieldLine">
              <span>
                Not set yet.{' '}
                {pay?.isSalary && paidHours > 0 ? (
                  <>
                    {firstName} is on a set week of <WorkedOutValue>{salariedWeekWords(pay.paidWeek)}</WorkedOutValue>.
                  </>
                ) : null}
              </span>
              {canSet ? (
                <button
                  type="button"
                  className="vipKeep"
                  onClick={() =>
                    pay?.isSalary && paidHours > 0
                      ? setStarter({ startMinute: FIRST_WORKING_RANGE[0], start: 'this' })
                      : setOpen({ dows: [...FIRST_WORKING_DAYS], segs: [[FIRST_WORKING_RANGE[0], FIRST_WORKING_RANGE[1]]], start: 'this', reason: '', picking: false })
                  }
                >
                  Set working hours
                </button>
              ) : null}
            </div>
          ) : null}
          {starter && pay ? starterField(starter) : null}
          {open ? (
            <div className="whLines">
              <span className="whDays">{workingDaysLabel(open.dows)}</span>
              <span />
              <WorkedOutValue>{`${formatHours(workingDayHours(open.segs))} h${open.dows.length > 1 && open.segs.length ? ' a day' : ''}`}</WorkedOutValue>
              {field(open)}
            </div>
          ) : null}
          {!canSet ? <p className="whLegend">A dev or the controller sets working hours.</p> : null}
        </div>
      </DeskRow>
    )
  }

  // ---------- hours are set ----------
  const earlier = workingHoursHistory(rows)
  const setBy = inForce?.set_by ? (names[inForce.set_by] ?? null) : null
  return (
    <DeskRow label="Working hours" stack actions={lock}>
      <div className="whBlock" data-working-hours="set">
        <div className="whLines">
          {shown.map((line) => {
            const openHere = isOpenLine(line)
            const words = workingRangesWords(line.segs)
            return (
              <Fragment key={line.days.join('-')}>
                <span className="whDays">{workingDaysLabel(line.days)}</span>
                <span>
                  {openHere ? null : canSet ? (
                    <button type="button" className="vipChange" aria-label={`${workingDaysLabel(line.days)}: ${words}. Change`} disabled={busy} onClick={() => {
                        setSaveWhy(null)
                        setOpen({ dows: [...line.days], segs: line.segs.map(([s, e]): Segment => [s, e]), start: 'this', reason: '', picking: false })
                      }}>
                      {words}
                    </button>
                  ) : (
                    <span className="vipLocked">{words}</span>
                  )}
                </span>
                {line.segs.length || openHere ? (
                  <WorkedOutValue>{openHere && open ? `${formatHours(workingDayHours(open.segs))} h${open.dows.length > 1 && open.segs.length ? ' a day' : ''}` : workingLineHoursWords(line)}</WorkedOutValue>
                ) : (
                  <span className="whZero">0 h</span>
                )}
                {openHere && open ? field(open) : null}
              </Fragment>
            )
          })}
          <span className="whRule" />
          <span className="whDays">Week</span>
          <span className="whMuted">{workingDaysCountWords(plan?.week ?? current)}</span>
          <WorkedOutValue>{`${formatHours(workingWeekHours(plan?.week ?? current))} h`}</WorkedOutValue>
          {inForce ? (
            <>
              <span className="whDays">Since</span>
              <span className="whWide">
                <WorkedOutValue>{workingSundayWords(inForce.effective_from)}</WorkedOutValue>
                {setBy ? (
                  <>
                    {' '}
                    <span className="whMuted">set by</span> <WorkedOutValue>{setBy}</WorkedOutValue>
                  </>
                ) : null}
              </span>
            </>
          ) : null}
          {coming ? (
            <>
              <span className="whDays">Coming</span>
              <span className="whWide" data-working-hours-coming>
                <span className="whNew">New from {workingSundayWords(coming.effective_from)}</span> {coming.days ? workingWeekLineWords(coming.days) : 'working hours come off'}
              </span>
            </>
          ) : null}
        </div>
        <p className="whLegend">
          {canSet ? 'Underlined values can be changed here. Bold ones are worked out.' : 'A dev or the controller sets working hours.'}{' '}
          {earlier.length > 0 ? (
            <button type="button" className="whQuiet" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)}>
              Earlier hours
            </button>
          ) : null}{' '}
          {canSet && !open ? (
            <button type="button" className="whQuiet" disabled={busy} onClick={() => void takeOff()}>
              Take working hours off
            </button>
          ) : null}
        </p>
        {saveWhy && !open ? (
          <div role="alert" className="vipNote vipWhy">
            {saveWhy}
          </div>
        ) : null}
        {showEarlier ? (
          <div className="whEarlier" data-working-hours-earlier>
            {earlier.map((r) => (
              <div key={`${r.effective_from}-${r.set_at}`} className="whEarlierRow">
                <span className="whMuted">From {workingSundayWords(r.effective_from)}</span>
                <span>{r.days ? `${workingWeekLineWords(r.days)}. ${formatHours(workingWeekHours(r.days))} h.` : 'Working hours taken off.'}</span>
                <span className="whEarlierWhy">
                  Saved {new Date(r.set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {r.set_by && names[r.set_by] ? ` by ${names[r.set_by]}` : ''}.{r.note ? ` ${r.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </DeskRow>
  )
}

/** A range with a half-hour break at its middle, on the quarter hour. */
function withBreak([s, e]: Segment): Segment[] {
  const mid = Math.round((s + e) / 2 / 15) * 15
  return [
    [s, mid - 15],
    [mid + 15, e],
  ]
}
