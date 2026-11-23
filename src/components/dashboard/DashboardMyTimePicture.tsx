/**
 * My Time's picture (the owner, 2026-11-23): the time a person has added up, and the days it came from. One big
 * figure for the week chosen, a column for each of its seven days, and a column for each of the last eight weeks
 * that opens that week's days. It counts time and grades nothing: no quota, no percent, one colour.
 *
 * Pure drawing over `MyTimeWeek[]` from `src/lib/dashboard/myTimeWeeks.ts`. The section owns the read, the week
 * chosen and what a press on a day opens. The looks are the `.myTime…` classes in `src/index.css`.
 */
import type { ReactNode } from 'react'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import {
  myTimeCappedSentence,
  myTimeColumnPct,
  myTimeDayLabel,
  myTimeDayShort,
  myTimeDayTop,
  myTimeDuration,
  myTimeDurationWords,
  myTimeHm,
  myTimeOnClockSentence,
  myTimeWeekLabel,
  myTimeWeekRange,
  myTimeWeekSunday,
  myTimeWeekTop,
  type MyTimeDay,
  type MyTimeWeek,
} from '../../lib/dashboard/myTimeWeeks'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

export function DashboardMyTimePicture({
  weeks,
  selected,
  onSelect,
  canPressDay,
  onDayPress,
  children,
}: {
  /** The weeks, the current one last. */
  weeks: readonly MyTimeWeek[]
  /** The week whose days are drawn. */
  selected: number
  onSelect: (index: number) => void
  /** A day the person can open themself. A salaried person's days are the office's, so none of theirs is. */
  canPressDay?: (day: MyTimeDay, week: MyTimeWeek) => boolean
  onDayPress?: (ymd: string) => void
  /** A quiet line at the foot of the picture. */
  children?: ReactNode
}) {
  const week = weeks[selected]
  if (!week) return null
  const total = myTimeHm(week.seconds)
  const today = week.days.find((d) => d.kind === 'today') ?? null
  const dayTop = myTimeDayTop(week)
  const weekTop = myTimeWeekTop(weeks)
  const pressable = (d: MyTimeDay) => Boolean(onDayPress && canPressDay?.(d, week))
  const anyPress = week.days.some(pressable)
  const currentIndex = weeks.findIndex((w) => w.current)
  const label = myTimeWeekLabel(weeks, selected)
  return (
    <div className="myTimePic" data-testid="my-time-picture">
      <div className="myTimeNav">
        <button type="button" className="myTimeArrow" aria-label="The week before" disabled={selected <= 0} onClick={() => onSelect(selected - 1)}>
          ‹
        </button>
        <span className="myTimeNavLabel" aria-live="polite">
          {label}
        </span>
        <button type="button" className="myTimeArrow" aria-label="The week after" disabled={selected >= weeks.length - 1} onClick={() => onSelect(selected + 1)}>
          ›
        </button>
      </div>
      <div className="myTimeHeads">
        <div className="myTimeBig" aria-label={`${label}: ${myTimeDurationWords(week.seconds)}`}>
          {total.h}
          <small>h</small> {total.m}
          <small>m</small>
        </div>
        {today ? (
          <div className="myTimeSide">
            Today<b>{myTimeDuration(today.seconds)}</b>
          </div>
        ) : (
          <div className="myTimeSide">{myTimeWeekRange(week.week)}</div>
        )}
      </div>
      {today?.openSince ? (
        <div className="myTimeLive">
          <i aria-hidden />
          <span>
            <ValueSentence text={myTimeOnClockSentence(formatDenverTimeOnly(Date.parse(today.openSince)))} />
          </span>
        </div>
      ) : null}
      {week.days
        .filter((d) => d.capped)
        .map((d) => (
          <div key={d.ymd} className="myTimeAlert" role="note">
            <i aria-hidden>!</i>
            <span>
              <ValueSentence text={myTimeCappedSentence(d, pressable(d))} />
            </span>
          </div>
        ))}
      <div className="myTimeDays">
        {week.days.map((d) => {
          const hm = myTimeHm(d.seconds)
          const come = d.kind === 'come'
          const cls = `myTimeDay${d.capped ? ' myTimeDay--stopped' : ''}${d.kind === 'today' ? ' myTimeDay--today' : ''}${d.openSince ? ' myTimeDay--running' : ''}${come ? ' myTimeDay--come' : ''}${!come && d.seconds === 0 ? ' myTimeDay--zero' : ''}`
          const pct = myTimeColumnPct(d.seconds, dayTop)
          const inner = (
            <>
              <span className="myTimeDayName">{myTimeDayShort(d.dow)}</span>
              <span className="myTimeDayDate">{Number(d.ymd.slice(8, 10))}</span>
              <span className="myTimeCol">
                {pct > 0 ? <i style={{ height: `${pct}%` }} /> : null}
                {d.capped ? <em aria-hidden>!</em> : null}
              </span>
              <span className="myTimeH">{come ? '' : `${hm.h}h`}</span>
              <span className="myTimeM">{!come && hm.m ? `${hm.m}m` : ''}</span>
            </>
          )
          return pressable(d) ? (
            <button key={d.ymd} type="button" className={cls} aria-label={`${myTimeDayLabel(d)}. Open the day`} onClick={() => onDayPress?.(d.ymd)}>
              {inner}
            </button>
          ) : (
            <div key={d.ymd} className={cls} role="img" aria-label={myTimeDayLabel(d)}>
              {inner}
            </div>
          )
        })}
      </div>
      {anyPress ? <div className="myTimeHint">Press a day to see its time.</div> : null}
      {!week.current && currentIndex >= 0 ? (
        <button type="button" className="myTimeBack" onClick={() => onSelect(currentIndex)}>
          Back to this week
        </button>
      ) : null}
      <div className="myTimeRule" />
      <p className="myTimeEyebrow">Your last {weeks.length} weeks</p>
      <div className="myTimeWeeks" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((w, i) => {
          const hm = myTimeHm(w.seconds)
          const pct = myTimeColumnPct(w.seconds, weekTop)
          const name = myTimeWeekLabel(weeks, i)
          return (
            <button key={w.week.start} type="button" className={`myTimeWeek${i === selected ? ' myTimeWeek--on' : ''}`} aria-pressed={i === selected} aria-label={`${name}, ${myTimeDurationWords(w.seconds)}`} onClick={() => onSelect(i)}>
              <span className="myTimeH">{hm.h}h</span>
              <span className="myTimeM">{hm.m ? `${hm.m}m` : ''}</span>
              <span className="myTimeCol">{pct > 0 ? <i style={{ height: `${pct}%` }} /> : null}</span>
              <span className="myTimeWeekDate">{w.current ? 'now' : myTimeWeekSunday(w.week)}</span>
            </button>
          )
        })}
      </div>
      <div className="myTimeHint">Each date is that week&rsquo;s Sunday. Press a week to see its days.</div>
      {children}
    </div>
  )
}
