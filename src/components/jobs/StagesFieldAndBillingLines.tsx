import { Fragment, type MouseEvent as ReactMouseEvent } from 'react'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import {
  stripBillParts,
  stripDoneParts,
  stripEndsParts,
  stripLastParts,
  stripNextParts,
  type StripLineParts,
} from '../../lib/jobs/stagesScheduleStrip'
import {
  deriveStagesBillingActivityDetail,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
} from '../../lib/stagesJobReferenceDates'
import { formatEstimatedCompletionDisplay } from '../../lib/jobs/jobFormatting'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { crewBillLineRepeatsDates } from '../../lib/jobs/stagesRowDoors'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { renderStagesScheduleStripCells, stagesWhenForJob, type StagesRowRenderContext } from './jobsStagesRowShared'

/** Moved out of `jobsStagesRowShared.tsx` in v2.5109 (the Stages map's step 9); the body is the old render function's, verbatim. */

/** One labeled line of the column's words: the main fact beside the label, the sub-fact under it. */
function whenLine(label: string, tone: string, parts: StripLineParts, onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void, title: string) {
  return (
    <button type="button" className={`stagesWhenLine ${tone}`} onClick={onClick} title={title}>
      <b>{label}</b>
      <span>
        {parts.main}
        {parts.sub ? (
          // Each part stays whole; the line may break only between parts, so a long
          // "tomorrow · 8 AM–4 PM" stacks inside the column instead of running under the Job cell.
          <span className="stagesWhenSub">
            {parts.sub.split(' · ').map((chunk, i, all) => (
              <Fragment key={i}>
                <span className="stagesWhenChunk">
                  {chunk}
                  {i < all.length - 1 ? ' ·' : ''}
                </span>
                {/* the break opportunity must sit outside the no-wrap span */}
                {i < all.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function StagesFieldAndBillingLines({
  ctx,
  job,
  datesBilledYmd,
}: {
  ctx: StagesRowRenderContext
  job: JobWithDetails
  /**
   * The date the row's dates block prints on its Billed line (`datesBlockBilledYmd`), when the row
   * draws one. A Billed line here would repeat it, so it goes (v2.4324); a Paid line stays.
   */
  datesBilledYmd?: string | null
}) {
  const { showToast, stagesManHoursByJobId, stagesManHoursLoading, stagesLaborBreakdownByJobId, openJobCalendar } = ctx
  const jYmd = deriveStagesFieldReferenceYmd({
    lastWorkDate: job.last_work_date,
    lastScheduleWorkDate: job.last_schedule_work_date ?? null,
  })
  const bDetail = deriveStagesBillingActivityDetail(job)
  const todayYmd = scheduleTodayDateKey()
  // The old j: / b: codes survive in the hover text for anyone who learned them (v2.3792).
  const jCode = jYmd ? formatEstimatedCompletionDisplay(jYmd) : null
  const jTitle = [deriveStagesFieldTooltip({
    lastWorkDate: job.last_work_date,
    lastScheduleWorkDate: job.last_schedule_work_date ?? null,
    resolvedYmd: jYmd,
  }), jCode ? `j: ${jCode}.` : null]
    .filter(Boolean)
    .join(' ') || null
  const billParts = bDetail ? stripBillParts(bDetail, todayYmd) : null
  const bill =
    billParts && crewBillLineRepeatsDates({ billLabel: billParts.label, jobStatus: job.status, datesBilledYmd: datesBilledYmd ?? null })
      ? null
      : billParts
  const bTitle = bDetail ? `${bDetail.tooltip} · b: ${formatEstimatedCompletionDisplay(bDetail.ymd) ?? '—'}` : undefined
  const lineStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
    // "j: T+106 (mon)" / "b: T+120 (mon)" / "22h 46m" must never wrap — a
    // dangling "(mon)" line reads as a fourth row of the stack (owner report).
    whiteSpace: 'nowrap',
  } as const
  const when = stagesWhenForJob(ctx, job)
  // v2.4351: a sub's sheet lists the job and nobody has clocked in on it — said here now
  // that the words under the money bar are gone.
  const crew = ctx.crewByJobId.get(job.id)
  const onSubSheet = !!crew?.sheet && !crew.lastWorkYmd
  const openCal = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    openJobCalendar(job)
  }
  return (
    <>
      {renderStagesScheduleStripCells(ctx, job, when, { cellPx: 12, extraTitle: jTitle, marginTop: '0.45rem' })}
      <div className="stagesWhen">
        {when.kind === 'scheduled' ? (
          <>
            {whenLine('Next', 'isNext', stripNextParts(when, todayYmd), openCal, 'Next scheduled appointment — open the job calendar')}
            {whenLine('Ends', 'isEnds', stripEndsParts(when, todayYmd), openCal, 'Last day on the calendar — open the job calendar')}
          </>
        ) : when.kind === 'done' ? (
          whenLine('Done', 'isMuted isReached', stripDoneParts(when.lastYmd, when.lastKind, todayYmd, { onSubSheet }), openCal, 'Nothing on the calendar — open the job calendar')
        ) : (
          <>
            {/* v2.4510: the flag is the door a planner takes; the Assign work… line under Activity is gone (the green calendar opens the same sheet). */}
            {ctx.canOpenJobScheduleModal ? (
              <button
                type="button"
                className={`stagesWhenFlag isDoor${when.tone === 'amber' ? ' isAmber' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  ctx.openQuickAssignForJob(job)
                }}
                title="Not scheduled. Click to assign work: pick people and a time"
                aria-label="Not scheduled. Assign work"
              >
                Not scheduled
              </button>
            ) : (
              <span className={`stagesWhenFlag${when.tone === 'amber' ? ' isAmber' : ''}`}>Not scheduled</span>
            )}
            {whenLine('Activity', 'isMuted isReached', stripLastParts(when.lastYmd, when.lastKind, todayYmd, { onSubSheet }), openCal, 'Latest field activity — open the job calendar')}
          </>
        )}
      </div>
      {bill ? (
        <div className="stagesWhen" style={{ margin: '0 0 1px' }}>
          {whenLine(
            bill.label,
            'isMuted isReached',
            bill,
            (e) => {
              e.stopPropagation()
              showToast(bTitle ?? 'Billing-activity date', 'info', 2500, { clientX: e.clientX, clientY: e.clientY })
            },
            bTitle ?? 'Billing-activity date',
          )}
        </div>
      ) : null}
      {(() => {
        const known = stagesManHoursByJobId.has(job.id)
        const total = stagesManHoursByJobId.get(job.id) ?? 0
        const display =
          stagesManHoursLoading && !known ? '…' : formatDecimalWorkHoursToHhMm(total)
        const breakdown = stagesLaborBreakdownByJobId.get(job.id) ?? []
        const tip = breakdown.length
          ? breakdown
              .map((p) => `${p.personName} ${formatDecimalWorkHoursToHhMm(p.hours)}`)
              .join(' · ')
          : 'Man-hours applied (crew assignments)'
        const openStory = ctx.openJobHoursStory
        const openSessionNotes = ctx.openSessionNotesForJob
        const storyTarget = {
          jobId: job.id,
          hcpNumber: job.hcp_number,
          clickNumber: job.click_number,
          jobName: job.job_name,
          onOpenSessionNotes: openSessionNotes ? () => openSessionNotes(job) : null,
        }
        return (
          <div
            role={openStory ? 'button' : undefined}
            tabIndex={openStory ? 0 : undefined}
            onClick={
              openStory
                ? (e) => {
                    e.stopPropagation()
                    openStory(storyTarget)
                  }
                : undefined
            }
            onKeyDown={
              openStory
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      openStory(storyTarget)
                    }
                  }
                : undefined
            }
            style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: openStory ? 'pointer' : undefined }}
            title={openStory ? `${tip} — click for the job's work story` : tip}
            aria-label={`Man-hours applied: ${display === '…' ? 'loading' : display}${openStory ? ' — open the work story' : ''}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {display}
          </div>
        )
      })()}
    </>
  )
}
