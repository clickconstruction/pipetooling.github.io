import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  WORK_MONTHS_SHOWN,
  firstName,
  nearestOpenNotice,
  noticeStateText,
  workMonthLabel,
  workMonthShort,
  type JobWorkMonths,
  type MonthNotice,
  type WorkMonth,
} from '../../lib/jobs/forecastWorkMonths'

/**
 * The work months under a Payment forecast row: one line per month — the
 * weeks as bars (height = hours, the people count above, hatched when
 * sessions await approval), the month's totals, and on sub jobs that
 * month's § 53.056 notice with its state and a Send notice… door. A role
 * line under the months teaches the rule once (sub = one notice per unpaid
 * month + one affidavit from the last month; direct = one affidavit from the
 * completion month).
 */

function fmtHours(h: number): string {
  return h.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function fmtLong(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${formatYmdMonthDay(ymd)}, ${m[1]}`
}

function noticeChipColors(n: MonthNotice): { bg: string; fg: string } {
  switch (n.state) {
    case 'due':
      return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
    case 'closing':
      return { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'sent':
      return { bg: 'var(--bg-subtle)', fg: 'var(--text-green-800)' }
    default:
      return { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
  }
}

/** The collapsed row's chip — only when a month's notice is due or closing. */
export function ForecastNoticeChip({ job }: { job: JobWorkMonths | null | undefined }) {
  const hit = nearestOpenNotice(job)
  if (!hit) return null
  const c = noticeChipColors(hit.notice)
  return (
    <span
      title={`§ 53.056 notice for ${hit.month.label} work is due ${fmtLong(hit.notice.due)} — open the row for the months`}
      style={{
        display: 'inline-block',
        marginLeft: '0.4rem',
        padding: '0 6px',
        borderRadius: 5,
        fontSize: '0.68rem',
        fontWeight: 600,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        background: c.bg,
        color: c.fg,
        verticalAlign: 'middle',
      }}
    >
      ⏱ {workMonthShort(hit.month.key)} notice {noticeStateText(hit.notice)}
    </span>
  )
}

function MonthLine({
  month,
  maxWeekHours,
  isSub,
  todayYmd,
  onSendNotice,
}: {
  month: WorkMonth
  maxWeekHours: number
  isSub: boolean
  todayYmd: string
  onSendNotice?: () => void
}) {
  const n = month.notice
  const hot = n && (n.state === 'due' || n.state === 'closing')
  return (
    <div
      data-testid={`work-month-${month.key}`}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}
    >
      <span style={{ width: 78, fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.15 }}>
        {workMonthShort(month.key)}
        <span style={{ display: 'block', fontWeight: 500, color: 'var(--text-faint)', fontSize: '0.68rem' }}>{month.key.slice(0, 4)}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 30, width: 150 }} aria-label={`${month.weeks.length} ${month.weeks.length === 1 ? 'week' : 'weeks'} worked`}>
        {month.weeks.map((w) => {
          const height = Math.max(3, Math.round((26 * w.hours) / Math.max(1, maxWeekHours)))
          const pend = w.pendingHours > 0
          return (
            <span
              key={w.start}
              title={`Week of ${formatYmdMonthDay(w.start)} (${w.daysSince}d ago) · ${w.people.map(firstName).join(', ')} · ${fmtHours(w.hours)} h · ${w.dayCount} ${w.dayCount === 1 ? 'day' : 'days'}${pend ? ` · ${fmtHours(w.pendingHours)} h awaiting approval` : ''}`}
              style={{
                position: 'relative',
                width: 22,
                height,
                borderRadius: '2px 2px 0 0',
                background: pend
                  ? 'repeating-linear-gradient(135deg, var(--text-link) 0 2px, var(--bg-blue-tint) 2px 4px)'
                  : 'var(--text-link)',
              }}
            >
              <span style={{ position: 'absolute', top: -11, left: 0, right: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                {w.people.length}
              </span>
            </span>
          )
        })}
      </span>
      <span style={{ flex: '1 1 220px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-700)' }}>{month.people.length}</strong> {month.people.length === 1 ? 'person' : 'people'} ·{' '}
        <strong style={{ color: 'var(--text-700)' }}>{fmtHours(month.hours)}</strong> h · {month.dayCount} {month.dayCount === 1 ? 'day' : 'days'} ·{' '}
        <span title="Share of this job's hours — a proxy for how much of the open balance this month's work represents">{month.hoursShare}% of hours</span>
        {month.pendingHours > 0 ? (
          <>
            {' '}
            · <span title="Sessions not yet approved do not count toward the lien clock">{fmtHours(month.pendingHours)} h pending</span>
          </>
        ) : null}
      </span>
      {isSub && n ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          {n.state !== 'open' ? (
            <span style={{ padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', ...noticeChipColors(n), color: noticeChipColors(n).fg, background: noticeChipColors(n).bg }}>
              {noticeStateText(n)}
            </span>
          ) : null}
          <span style={{ fontSize: '0.75rem', color: hot ? 'var(--text-red-600)' : 'var(--text-muted)', fontWeight: hot ? 600 : 400 }}>
            by {formatYmdMonthDay(n.due)}
          </span>
          {n.state !== 'sent' && n.state !== 'closed' && onSendNotice && n.due >= todayYmd ? (
            <button
              type="button"
              onClick={onSendNotice}
              title={`Open the Lien instruments window on the § 53.056 notice for ${month.label}`}
              style={{ padding: '1px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-700)' }}
            >
              Send notice…
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

export default function ForecastWorkMonthsPanel({
  job,
  customerName,
  isCommercial,
  todayYmd,
  onSendNotice,
}: {
  job: JobWorkMonths
  customerName: string | null
  /** The customer's Comm tag — on a direct job it prompts the "is someone else the owner?" question. */
  isCommercial: boolean
  todayYmd: string
  /** Opens the Lien instruments window on the notice tab (sub jobs). */
  onSendNotice?: (jobId: string) => void
}) {
  const isSub = job.role === 'sub'
  const shown = job.months.length > WORK_MONTHS_SHOWN ? job.months.slice(-WORK_MONTHS_SHOWN) : job.months
  const earlier = job.months.length - shown.length
  const maxWeekHours = Math.max(1, ...job.months.flatMap((m) => m.weeks.map((w) => w.hours)))
  const kindUnknown = !job.propertyKind
  const residential = job.propertyKind === 'residential'
  const affidavit = job.affidavitDue ? fmtLong(job.affidavitDue) : '—'
  const lastLabel = workMonthLabel(job.lastMonthKey)
  return (
    <div
      role="region"
      aria-label="Work months"
      style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', padding: '0.4rem 0.75rem 0.55rem 2.1rem', fontSize: '0.78rem' }}
    >
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 2 }}>
        <span style={{ width: 78 }}>Work month</span>
        <span style={{ width: 150 }}>Weeks · people above</span>
        <span style={{ flex: 1 }}>What counts</span>
        {isSub ? <span>§ 53.056 notice</span> : null}
      </div>
      {earlier > 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '0.2rem 0' }}>
          + {earlier} earlier {earlier === 1 ? 'month' : 'months'}
        </div>
      ) : null}
      {shown.map((m) => (
        <MonthLine
          key={m.key}
          month={m}
          maxWeekHours={maxWeekHours}
          isSub={isSub}
          todayYmd={todayYmd}
          onSendNotice={onSendNotice ? () => onSendNotice(job.jobId) : undefined}
        />
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.6rem', paddingTop: '0.35rem', marginTop: '0.2rem', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {isSub ? (
          <>
            <strong style={{ color: 'var(--text-700)' }}>Sub job</strong>
            <span>· a GC is on the job, so each unpaid month needs its own notice to the owner and the GC</span>
            <span>
              · affidavit for all of it by <strong style={{ color: 'var(--text-700)' }}>{affidavit}</strong> ({residential ? '3rd' : '4th'} month after {lastLabel}, the last month worked)
            </span>
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--text-700)' }}>Direct with owner</strong>
            <span>· no monthly notice</span>
            <span>
              · one affidavit by <strong style={{ color: 'var(--text-700)' }}>{affidavit}</strong> ({residential ? '3rd' : '4th'} month after {lastLabel}, the month work completed)
            </span>
            {isCommercial ? (
              <span title="A builder entered as the customer with no GC on the job reads as a direct contract with the owner. If someone else owns the site, set the GC on the job — the notice clock changes.">
                · if {customerName ?? 'the customer'} is a GC and someone else owns the site, set the GC on the job
              </span>
            ) : null}
          </>
        )}
        {kindUnknown ? (
          <span
            title="No property record is linked. Commercial dates are shown; a residential property would be a month earlier on every line. Link the property on Edit Job → Property record."
            style={{ padding: '0 6px', borderRadius: 5, fontSize: '0.66rem', fontWeight: 600, lineHeight: '18px', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
          >
            property kind unknown
          </span>
        ) : null}
        {job.pendingSessions > 0 ? (
          <span>
            · {job.pendingSessions} {job.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval
          </span>
        ) : null}
      </div>
    </div>
  )
}
