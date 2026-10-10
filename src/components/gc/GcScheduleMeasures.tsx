/**
 * GC mode, the real build, the schedule's PR 7a: the Schedule tab's measures: work against the
 * plan, the projected finish, the dates to meet, the look-ahead and why the chart reads as it does.
 * Exported for the window: `Measures`, `LookAhead`, `ScheduleWhy` and `finishSentence`. Moved word
 * for word from the GC mode prototype (branch spike/gc-mode, `GcBuildingSchedule.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { Fragment, type ReactNode } from 'react'
import { activityName, daysBetween, LOOKAHEAD_WEEKS, markReason, MILESTONE_GRACE_DAYS, RELIABILITY_WEEKS, scheduleMeasures, substantialCompletionOn, type LookAheadState, type ProjectedFinish } from '../../lib/gc/schedule/schedule'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import type { ScheduleActivity } from '../../lib/gc/schedule/types'
import { Card, Chip, Why, type Tone } from './gcUi'
import type { LateFinish } from '../../lib/gc/lateFinish'
import type { FinishOutlook } from '../../lib/gc/schedule/finishOutlook'
import { GcAskForDays } from './GcAskForDays'
import type { RecoveryOffer } from '../../lib/gc/schedule/recovery'

export function ScheduleWhy() {
  return (
    <Why>
      Each activity is a line of a trade's statement of work, or a stage our own crew runs. We draw the dates and what each
      waits on while buying out. Start locks it as the baseline, the plan we measure against. Spare days are how long an
      activity can slip before the job finishes later. No spare days is the critical path. An inspection is an activity of its
      own. It belongs to the job and has no dollars. It counts on the critical path, not in work done.
    </Why>
  )
}

export function Measures({
  m,
  late,
  best,
  outlook,
  onAsk,
  askNote,
}: {
  m: ReturnType<typeof scheduleMeasures>
  late?: LateFinish
  best?: RecoveryOffer
  outlook?: FinishOutlook
  onAsk?: () => void
  /** Under the whose-days line when this reader has no Ask for the days (PR 16b-ii): who asks instead. */
  askNote?: string
}) {
  const behind = m.work.daysBehind
  const nextMilestone = m.milestones.find((r) => r.state === 'due')
  const lateOnes = m.milestones.filter((r) => r.state === 'late' || r.state === 'missed')
  const rel = m.reliability
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem' }}>
      <Measure
        label="Work done against the plan"
        value={`${Math.round(m.work.donePct)}% done`}
        tone={behind > 7 ? 'red' : behind > 0 ? 'amber' : 'green'}
        chip={behind > 0 ? `${behind} ${behind === 1 ? 'day' : 'days'} behind` : behind < 0 ? `${-behind} days ahead` : 'on plan'}
      >
        {Math.round(m.work.plannedPct)}% was planned by today, weighted by what each line is worth.
      </Measure>
      <Measure label="Critical path" value={`${m.critical.length} ${m.critical.length === 1 ? 'activity' : 'activities'}`} tone={m.critical.length > 0 ? 'amber' : 'green'} chip="no spare days">
        {m.critical.length > 0 ? m.critical.map(activityName).join(', ') : 'Every open activity has spare days.'}
      </Measure>
      <Measure
        label="Milestones hit"
        value={m.hitRate.of > 0 ? `${m.hitRate.hit} of ${m.hitRate.of}` : 'none yet'}
        tone={lateOnes.length > 0 ? 'red' : 'green'}
        chip={`within ${MILESTONE_GRACE_DAYS} days`}
      >
        {lateOnes.map((r) => `${r.milestone.label} is ${r.daysLate} days late.`).join(' ')}{' '}
        {nextMilestone ? `Next: ${nextMilestone.milestone.label} ${shortDate(nextMilestone.due)}.` : ''}
      </Measure>
      <Measure
        label="Look-ahead done as planned"
        value={rel.of > 0 ? `${Math.round((rel.done / rel.of) * 100)}%` : 'none yet'}
        tone={rel.of > 0 && rel.done / rel.of < 0.8 ? 'amber' : 'green'}
        chip={`last ${RELIABILITY_WEEKS} weeks`}
      >
        {rel.done} of {rel.of} verified marks were done. {rel.waiting > 0 ? `${rel.waiting} ${rel.waiting === 1 ? 'mark waits' : 'marks wait'} on our superintendent.` : ''}
      </Measure>
      {m.finish && <FinishMeasure finish={m.finish} contract={m.contract} {...(late ? { late } : {})} {...(best ? { best } : {})} {...(outlook ? { outlook } : {})} {...(onAsk ? { onAsk } : {})} {...(askNote ? { askNote } : {})} />}
    </div>
  )
}

/**
 * When the job finishes as the schedule stands today (owner, 2026-10-04), against substantial
 * completion in the contract, in days. The late fee in dollars stays on Bill the owner.
 */
/** The projected finish and the contract's day, as the Projected finish card says them: the printed chart's head reads it too (G-21). */
export function finishSentence(finish: ProjectedFinish, contract: ReturnType<typeof substantialCompletionOn>): string {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  return `${finish.why} ${contract ? `The contract says substantial completion by ${shortDate(contract.on)}${contract.days > 0 ? `, with ${days(contract.days)} by change order` : ''}.` : 'No substantial completion milestone to measure against.'}`
}

function FinishMeasure({
  finish,
  contract,
  late,
  best,
  outlook,
  onAsk,
  askNote,
}: {
  finish: ProjectedFinish
  contract: ReturnType<typeof substantialCompletionOn>
  late?: LateFinish
  best?: RecoveryOffer
  outlook?: FinishOutlook
  onAsk?: () => void
  askNote?: string
}) {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  // The days past come from the one call Bill the customer and the customer's words read too (G-98).
  const past = late ? late.risk.past : contract ? daysBetween(contract.on, finish.on) : null
  const chip =
    past === null
      ? finish.behind > 0
        ? `${days(finish.behind)} past the plan at Start`
        : 'on the plan'
      : past > 0
        ? `${days(past)} past the contract`
        : past === 0
          ? 'no days to spare'
          : `${days(-past)} to spare`
  const tone: Tone = past === null ? (finish.behind > 0 ? 'amber' : 'green') : past > 0 ? 'red' : past === 0 ? 'amber' : 'green'
  return (
    <Measure label="Projected finish" value={weekdayDate(finish.on)} tone={tone} chip={chip}>
      {finishSentence(finish, contract)}
      {/* The money at the contract's fee, whose days they are, and the change orders (G-98). */}
      {late && late.words.length > 0 && (
        <span data-tour="gc-late-finish" style={{ display: 'grid', gap: '0.15rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', color: 'var(--text-base)' }}>
          {late.words.map((w) => (
            <Fragment key={w}>
              <span>{w}</span>
              {/* Ask for the days (G-141), under the whose-days line. Not a span, so the paper (G-21) prints only the lines. */}
              {w === late.split && late.ask && onAsk && <GcAskForDays ask={late.ask} where="schedule" onAsk={onAsk} />}
              {w === late.split && late.ask && !onAsk && askNote && (
                <span data-ask-note style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {askNote}
                </span>
              )}
            </Fragment>
          ))}
        </span>
      )}
      {/* What the best way to get days back is worth against the contract (G-82), under G-98's lines. An offer, not a fact, so not on the paper: the list is under the measures. */}
      {late && late.words.length > 0 && best && (
        <span data-tour="gc-days-back-worth" style={{ display: 'block', marginTop: '0.15rem', color: best.lateAfter === 0 ? 'var(--text-green-800)' : 'var(--text-base)' }}>
          Getting {best.words.worth}
        </span>
      )}
      {/* The finish with weather and crews (G-57): its own ruled block, each rule named. Ours only: not on the paper, the portal or the letter until the owner says which line the customer hears. */}
      {outlook && (
        <span data-tour="gc-finish-outlook" style={{ display: 'grid', gap: '0.15rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', color: 'var(--text-base)' }}>
          <span style={{ fontWeight: 600, color: outlook.days > 0 ? 'var(--text-amber-800)' : 'var(--text-base)' }}>{outlook.words.line}</span>
          <span>{outlook.words.weather}</span>
          <span>{outlook.words.crews}</span>
        </span>
      )}
    </Measure>
  )
}

function Measure({ label, value, tone, chip, children }: { label: string; value: string; tone: Tone; chip: string; children: ReactNode }) {
  return (
    <Card>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <Chip tone={tone}>{chip}</Chip>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{children}</div>
    </Card>
  )
}

const MARK_WORDS: Record<LookAheadState, { tone: Tone; word: string }> = {
  done: { tone: 'green', word: 'done' },
  not: { tone: 'red', word: 'not done' },
  waiting: { tone: 'amber', word: 'waiting on our superintendent' },
  unmarked: { tone: 'grey', word: 'not marked yet' },
}

export function LookAhead({ weeks }: { weeks: ReturnType<typeof scheduleMeasures>['lookAhead'] }) {
  return (
    <Card>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>The look-ahead · the next {LOOKAHEAD_WEEKS} weeks</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        Each week the trade marks each activity done or not in its portal. Our superintendent verifies the mark. Only a verified
        mark counts.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '0.75rem' }}>
        {weeks.map((w, i) => (
          <div key={w.weekOf} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.65rem', display: 'grid', gap: '0.35rem', alignContent: 'start' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {i === 0 ? 'This week' : i === 1 ? 'Next week' : 'In two weeks'} · {shortDate(w.weekOf)}
            </div>
            {w.items.length === 0 && w.inspections.length === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nothing planned.</span>}
            {w.items.map(({ row, mark, state }) => (
              <div key={row.activity.lineId} style={{ fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  {row.trade} · {row.label} <span style={{ color: 'var(--text-muted)' }}>· {row.company}</span>
                </span>
                {i === 0 && (
                  <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip tone={MARK_WORDS[state].tone}>{MARK_WORDS[state].word}</Chip>
                    {mark && state === 'waiting' && (
                      <span style={{ color: 'var(--text-muted)' }}>they say {mark.done ? 'done' : `not done${mark.reason ? `, ${mark.reason}` : ''}`}</span>
                    )}
                    {mark && state === 'not' && markReason(mark) && <span style={{ color: 'var(--text-muted)' }}>{markReason(mark)}</span>}
                  </span>
                )}
              </div>
            ))}
            {w.inspections.map((insp) => (
              <div key={insp.activity.lineId} style={{ fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  {insp.label} <span style={{ color: 'var(--text-muted)' }}>· {insp.company} · {shortDate(insp.activity.start)} to {shortDate(insp.activity.finish)}</span>
                </span>
                <span>
                  <InspectionChip activity={insp.activity} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** An inspection in the look-ahead: passed, failed and when again, or just planned. */
function InspectionChip({ activity }: { activity: ScheduleActivity }) {
  const inspection = activity.inspection
  const fails = inspection?.failed ?? []
  const last = fails[fails.length - 1]
  if (inspection?.passedOn) return <Chip tone="green">passed {shortDate(inspection.passedOn)}</Chip>
  if (last) return <Chip tone="red">failed, again {shortDate(last.reinspectOn)}</Chip>
  return <Chip tone="violet">inspection</Chip>
}
