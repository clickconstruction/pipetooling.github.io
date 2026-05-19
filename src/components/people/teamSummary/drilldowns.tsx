// All 11 drilldown body components for the Team Summary modal.
//
// Each component takes the structured data already computed by
// `derivePersonTeamSummary` in `People.tsx` (Hours/Gross/Net/Profit
// breakdowns, per-bucket session lines, overhead rate decomposition)
// and renders the same content the iframe HTML-string version did,
// translated to JSX. Behavior parity is the goal — no math changes.
//
// Layout / typography per v2.547: running totals are part of the modal
// title (rendered in TeamSummaryDrilldownModal), explanation copy moves
// to the bottom as `<p class="caption">`, money/hour cells use
// `tabular-nums` via the `.num` class, negatives render `-$N` in red.

import type {
  GrossRevenueBreakdown,
  HoursBreakdown,
  NetRevenueBreakdown,
  OverheadRateDecomp,
  OverheadSessionLine,
  ProfitAfterOverheadBreakdown,
  TeamSummaryBreakdown,
} from './types'
import type { CSSProperties } from 'react'
import {
  dayHeaderLabel,
  fmtH,
  fmtMoney,
  fmtMoneyPerHr,
  fmtPct,
  fmtPct1,
} from './formatters'
import { compactAddressForHoursDisplay } from './addressDisplay'
import { useJobFormModal } from '../../../contexts/JobFormModalContext'

// Link-style button used inside drilldown table cells (e.g. "Where the
// field hrs went" Job column) that open the Edit Job modal in the
// parent. Visually mirrors the dotted-underline blue text used by
// ClickCell in TeamSummaryInline so the affordance is consistent.
const editJobLinkBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: '#2563eb',
  textDecoration: 'underline dotted',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  textAlign: 'left',
}

const negStyle: React.CSSProperties = { color: '#b91c1c' }
const dashStyle: React.CSSProperties = { color: '#9ca3af' }

/** "<em>—</em>" cell content used for missing values. */
function DashCell() {
  return <span style={dashStyle}>&mdash;</span>
}

/**
 * Renders one Hours-breakdown day section. When `clickableDay` is true
 * and `onOpenDayEditor` is provided, the day header becomes a button
 * that opens DashboardMyTimeDayEditorModal for (personName, date).
 */
function HoursDaySection(props: {
  personName: string
  d: HoursBreakdown['dailyRows'][number]
  showCounted: boolean
  clickableDay: boolean
  onOpenDayEditor?: (personName: string, workDate: string) => void
}) {
  const { personName, d, showCounted, clickableDay, onOpenDayEditor } = props
  const countedHrs = d.crewAllocations.reduce((s, a) => s + a.hours, 0)
  const headerInner = (
    <>
      <span className="day-link-date">{dayHeaderLabel(d.date)}</span>
      <span className="day-hours">{`· ${fmtH(d.hours)} hrs`}</span>
      {showCounted ? (
        <span className="day-hours">{`· ${fmtH(countedHrs)} hrs counted`}</span>
      ) : null}
    </>
  )
  const allocs = d.crewAllocations.slice().sort((a, b) => b.pct - a.pct)
  return (
    <div className="hours-day-section">
      {clickableDay ? (
        <button
          type="button"
          className="hours-day-header day-link"
          onClick={() => onOpenDayEditor?.(personName, d.date)}
          title="Open My Time for this day"
          aria-label={`Open My Time for ${personName} on ${d.date}`}
        >
          {headerInner}
        </button>
      ) : (
        <div className="hours-day-header">{headerInner}</div>
      )}
      <div className="hours-day-allocs">
        {allocs.length === 0 ? (
          <div className="hours-day-noalloc">No crew assignment</div>
        ) : (
          allocs.map((a, i) => {
            // Drop the redundant trailing state + ZIP ("TX 78209") so
            // each line reads as "street city" — when every job is in
            // Texas, the trailing fragment is noise. Title shows the
            // full address on hover for the rare case someone needs it.
            const compactAddr = compactAddressForHoursDisplay(a.address)
            return (
              <div className="hours-day-alloc" key={`${a.hcp}-${i}`}>
                <span className="alloc-pct">{`(${fmtPct1(a.pct)})`}</span>{' '}
                <span className="alloc-jobnum">{a.hcp}</span>
                {' | '}
                <span className="alloc-jobname">
                  {a.jobName ? a.jobName : <DashCell />}
                </span>
                {compactAddr ? (
                  <>
                    {' '}
                    <span className="alloc-address" title={a.address}>
                      {`- ${compactAddr}`}
                    </span>
                  </>
                ) : null}
                {showCounted ? (
                  <span className="alloc-counted">{`· ${fmtH(a.hours)} hrs counted`}</span>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function HoursBreakdownBody(props: {
  hb: HoursBreakdown
  personName: string
  clickableDay: boolean
  onOpenDayEditor?: (personName: string, workDate: string) => void
}) {
  const { hb, personName, clickableDay, onOpenDayEditor } = props
  const srcLabel =
    hb.source === 'salary'
      ? 'Salaried (8 hrs/weekday)'
      : hb.source === 'hourly'
        ? 'Hourly (from people_hours / clock sessions)'
        : 'Unknown (no pay config row)'
  const modeLabel = hb.onlyPaidJobs
    ? 'Only paid jobs (sub labor + crew assignments)'
    : 'All days in period (clocked / salary)'
  // Sort dailyRows by date asc so the day-by-day story reads naturally.
  const sortedDailyRows = hb.dailyRows
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const sub = hb.subLaborRows
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  return (
    <>
      {hb.onlyPaidJobs ? (
        <>
          {sortedDailyRows.some((d) => d.crewAllocations.length > 0) ? (
            <>
              <h3>Crew jobs (per day)</h3>
              <div className="hours-day-list">
                {sortedDailyRows
                  .filter((d) => d.crewAllocations.length > 0)
                  .map((d) => (
                    <HoursDaySection
                      key={d.date}
                      personName={personName}
                      d={d}
                      showCounted
                      clickableDay={clickableDay}
                      onOpenDayEditor={onOpenDayEditor}
                    />
                  ))}
              </div>
              <div className="hours-day-total">
                Crew subtotal: {fmtH(hb.totals.crew)} hrs
              </div>
            </>
          ) : null}
          {hb.subLaborRows.length > 0 ? (
            <>
              <h3>Sub labor jobs</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>HCP</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.map((s, i) => (
                    <tr key={`${s.hcp}-${s.date}-${i}`}>
                      <td>{s.date}</td>
                      <td>{s.hcp}</td>
                      <td className="num">{fmtH(s.hours)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>
                      Sub labor subtotal
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtH(hb.totals.subLabor)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          ) : null}
          <p className="caption">
            Total = crew ({fmtH(hb.totals.crew)}) + sub labor (
            {fmtH(hb.totals.subLabor)}) = {fmtH(hb.totals.totalHours)} hrs.
            Each crew line shows <em>(pct) Job # | Job Name</em>; pct is the
            share of the day attributed to that job.
          </p>
        </>
      ) : (
        <>
          {sortedDailyRows.length > 0 ? (
            <div className="hours-day-list">
              {sortedDailyRows.map((d) => (
                <HoursDaySection
                  key={d.date}
                  personName={personName}
                  d={d}
                  showCounted={false}
                  clickableDay={clickableDay}
                  onOpenDayEditor={onOpenDayEditor}
                />
              ))}
            </div>
          ) : (
            <p className="caption">No daily hours recorded in this period.</p>
          )}
          {hb.subLaborRows.length > 0 ? (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>
                Sub labor jobs (informational — not counted in this mode)
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>HCP</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.map((s, i) => (
                    <tr key={`${s.hcp}-${s.date}-${i}`}>
                      <td>{s.date}</td>
                      <td>{s.hcp}</td>
                      <td className="num">{fmtH(s.hours)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>
                      Sub labor subtotal
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtH(hb.totals.subLabor)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          ) : null}
          <p className="caption">
            Sub labor hours are not added in this mode — toggle &ldquo;Only
            paid jobs&rdquo; in Review to count them.
          </p>
        </>
      )}
      <div style={{ marginTop: '1rem', color: '#374151' }}>
        <div>
          <strong>Source:</strong> {srcLabel}
        </div>
        <div>
          <strong>Counting mode:</strong> {modeLabel}
        </div>
      </div>
    </>
  )
}

export function GrossRevenueBody(props: { gb: GrossRevenueBreakdown }) {
  const { gb } = props
  if (!gb.jobs || gb.jobs.length === 0) {
    return (
      <>
        <p className="caption">
          No jobs contributed to revenue in this period.
        </p>
        <p className="caption">
          Gross Revenue is each job&rsquo;s <strong>Value Created</strong>{' '}
          (Total Bill &times; % Complete) multiplied by your{' '}
          <strong>share</strong> on that job (your labor cost in this period
          &divide; total labor on the job, all-time).
        </p>
      </>
    )
  }
  const centerCell: React.CSSProperties = { textAlign: 'center' }
  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={centerCell}>Job</th>
            <th className="num" style={centerCell}>Total Bill</th>
            <th className="num" style={centerCell}>% Complete</th>
            <th className="num" style={centerCell}>Value Created</th>
            <th className="num" style={centerCell}>Your cost<br />(period)</th>
            <th className="num" style={centerCell}>Total labor<br />(lifetime)</th>
            <th className="num" style={centerCell}>Share</th>
            <th className="num" style={centerCell}>Allocated</th>
          </tr>
        </thead>
        <tbody>
          {gb.jobs.map((j) => {
            const isAssumed = j.pctCompleteSource === 'assumed'
            const jobName = j.jobName || '—'
            return (
              <tr key={j.jobId}>
                <td style={centerCell}>
                  {j.hcp ? (
                    <>
                      <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                        {j.hcp}
                      </span>{' '}
                    </>
                  ) : null}
                  {jobName}
                </td>
                <td className="num" style={centerCell}>{fmtMoney(j.totalBill)}</td>
                <td className="num" style={centerCell}>
                  {fmtPct(j.pctComplete)}
                  {isAssumed ? (
                    <div
                      style={{
                        fontSize: '0.7em',
                        lineHeight: 1.1,
                        color: '#6b7280',
                        marginTop: '0.1em',
                      }}
                    >
                      (assumed)
                    </div>
                  ) : null}
                </td>
                <td className="num" style={centerCell}>{fmtMoney(j.valueCreated)}</td>
                <td className="num" style={centerCell}>{fmtMoney(j.costInPeriod)}</td>
                <td className="num" style={centerCell}>{fmtMoney(j.totalLaborOnJob)}</td>
                <td className="num" style={centerCell}>{fmtPct1(j.ratio * 100)}</td>
                <td className="num" style={centerCell}>{fmtMoney(j.allocatedRevenue)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
            <td className="num" style={{ ...centerCell, fontWeight: 600 }}>{fmtMoney(gb.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="caption">
        Allocated = Value Created &times; (Your cost &divide; Total labor).
        Sorted by allocated revenue.
      </p>
      <p className="caption">
        Gross Revenue is each job&rsquo;s <strong>Value Created</strong>{' '}
        (Total Bill &times; % Complete) multiplied by your{' '}
        <strong>share</strong> on that job (your labor cost in this period
        &divide; total labor on the job, all-time).
      </p>
    </>
  )
}

export function NetRevenueBody(props: { nb: NetRevenueBreakdown }) {
  const { nb } = props
  if (!nb.jobs || nb.jobs.length === 0) {
    return (
      <>
        <p className="caption">
          No jobs contributed to net revenue in this period.
        </p>
        <p className="caption">
          Net Revenue is each job&rsquo;s{' '}
          <strong>Net Revenue (before overhead)</strong> &mdash; Value
          Created minus parts and total labor &mdash; multiplied by your{' '}
          <strong>share</strong> on that job (your labor cost in this period
          &divide; total labor on the job, all-time).
        </p>
      </>
    )
  }
  return (
    <>
      <table>
        <thead>
          <tr>
            <th className="num">HCP</th>
            <th>Job</th>
            <th className="num">Value<br />Created</th>
            <th className="num">&minus; Parts</th>
            <th className="num">&minus; Total<br />labor</th>
            <th className="num">= Net Rev<br />(job)</th>
            <th className="num">Your cost<br />(period)</th>
            <th className="num">Share</th>
            <th className="num">Allocated</th>
          </tr>
        </thead>
        <tbody>
          {nb.jobs.map((j) => (
            <tr key={j.jobId}>
              <td className="num">{j.hcp}</td>
              <td>{j.jobName || '—'}</td>
              <td className="num">{fmtMoney(j.valueCreated)}</td>
              {/* Parts + Total labor are stored as positive costs but
                  the column headers ("− Parts", "− Total labor") imply
                  they're subtracted from Value Created. Render them
                  negative so the row reads as a literal "value − parts
                  − labor = net" arithmetic, matching how
                  OverheadLaborBody displays its Cost column. */}
              <td className="num">{fmtMoney(-(j.partsCost || 0))}</td>
              <td className="num">{fmtMoney(-(j.totalLaborOnJob || 0))}</td>
              <td className="num" style={j.revenueBeforeOverhead < 0 ? negStyle : undefined}>
                {fmtMoney(j.revenueBeforeOverhead)}
              </td>
              <td className="num">{fmtMoney(j.costInPeriod)}</td>
              <td className="num">{fmtPct1(j.ratio * 100)}</td>
              <td className="num" style={j.allocatedNet < 0 ? negStyle : undefined}>
                {fmtMoney(j.allocatedNet)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
            <td
              className="num"
              style={nb.total < 0 ? { ...negStyle, fontWeight: 600 } : { fontWeight: 600 }}
            >
              {fmtMoney(nb.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="caption">
        Allocated = Net Rev (job) &times; (Your cost &divide; Total labor).
        Net Rev (job) = Value Created &minus; Parts &minus; Total labor.
        Sorted by allocated net.
      </p>
      <p className="caption">
        Net Revenue is each job&rsquo;s{' '}
        <strong>Net Revenue (before overhead)</strong> &mdash; Value Created
        minus parts and total labor &mdash; multiplied by your{' '}
        <strong>share</strong> on that job (your labor cost in this period
        &divide; total labor on the job, all-time).
      </p>
    </>
  )
}

export function ProfitBody(props: {
  pb: ProfitAfterOverheadBreakdown
  overheadRate: number | null
}) {
  const { pb, overheadRate } = props
  if (overheadRate == null) {
    return (
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.5rem', color: '#b91c1c' }}>
          Overhead rate is unavailable. Open the Review tab and let the
          rate finish loading, then reopen Team Summary.
        </div>
        <div style={{ fontSize: '1.05rem' }}>
          <strong>Net Revenue: {fmtMoney(pb.totalNet)}</strong>
        </div>
      </div>
    )
  }
  const fieldHrs = pb.fieldHours != null ? pb.fieldHours : pb.totalHours
  const overheadHrs = pb.overheadHours != null ? pb.overheadHours : 0
  const fieldOverhead = fieldHrs * overheadRate
  const overheadHoursOverhead = overheadHrs * overheadRate
  // Charge overhead on every hour the person worked in the period —
  // office, bid, AND field. Field hours are billed and produce revenue,
  // overhead hours are not, but both consume the same per-hour overhead
  // burden under this convention (per the user's request that overhead
  // hours be "included in deduction").
  const totalOverhead = fieldOverhead + overheadHoursOverhead
  const totalProfit = pb.totalNet - totalOverhead
  const rows = (pb.jobs || [])
    .map((j) => {
      const oh = j.hoursInPeriod * overheadRate
      const profit = j.allocatedNet - oh
      return {
        hcp: j.hcp,
        jobName: j.jobName,
        allocatedNet: j.allocatedNet,
        hoursInPeriod: j.hoursInPeriod,
        overhead: oh,
        profit,
        jobId: j.jobId,
      }
    })
    .sort((a, b) => b.profit - a.profit)
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Overhead rate (Method A):</strong> ${overheadRate.toFixed(2)} per hour
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Net Revenue:</strong> {fmtMoney(pb.totalNet)}
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Total hours:</strong> {fmtH(pb.totalHours)} (field {fmtH(fieldHrs)}
          {overheadHrs > 0.005 ? <> + overhead {fmtH(overheadHrs)}</> : null})
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>&minus; Overhead deduction:</strong>{' '}
          {fmtH(pb.totalHours)} &times; ${overheadRate.toFixed(2)} = {fmtMoney(totalOverhead)}
        </div>
        {overheadHrs > 0.005 ? (
          <div style={{ marginBottom: '0.25rem', paddingLeft: '1.5rem', color: '#6b7280' }}>
            ({fmtMoney(fieldOverhead)} field + {fmtMoney(overheadHoursOverhead)} overhead hours)
          </div>
        ) : null}
        <div style={{ fontSize: '1.05rem' }}>
          <strong>
            Profit (after overhead):{' '}
            <span style={totalProfit < 0 ? negStyle : undefined}>{fmtMoney(totalProfit)}</span>
          </strong>
        </div>
      </div>
      {rows.length === 0 && overheadHrs < 0.005 && pb.unaccountedHours < 0.01 ? (
        <p className="caption">No jobs contributed to net revenue in this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th className="num">Net Rev<br />(allocated)</th>
              <th className="num">Your hours<br />(period)</th>
              <th className="num">&minus; Overhead<br />(hrs &times; rate)</th>
              <th className="num">= Profit<br />(after overhead)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const jobName = r.jobName || '—'
              return (
                <tr key={r.jobId}>
                  <td>
                    {r.hcp ? (
                      <>
                        <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                          {r.hcp}
                        </span>{' '}
                      </>
                    ) : null}
                    {jobName}
                  </td>
                  <td className="num" style={r.allocatedNet < 0 ? negStyle : undefined}>
                    {fmtMoney(r.allocatedNet)}
                  </td>
                  <td className="num">{fmtH(r.hoursInPeriod)}</td>
                  {/* Overhead is computed as a positive cost (hrs × rate)
                      but the column header ("− Overhead (hrs × rate)")
                      implies it's subtracted from Net Rev to reach
                      Profit. Render negative so the row reads as literal
                      "net + (−overhead) = profit" arithmetic — same
                      convention as Net Revenue's Parts / Total labor and
                      OverheadLaborBody's Cost column. */}
                  <td className="num">{fmtMoney(-r.overhead)}</td>
                  <td className="num" style={r.profit < 0 ? negStyle : undefined}>
                    {fmtMoney(r.profit)}
                  </td>
                </tr>
              )
            })}
            {/* Overhead hours (office + bid) — charged the rate but
                produce no revenue, so the row contributes purely to
                the deduction. Rendered as a single combined line so
                the user can see the total drag without splitting
                office vs bid further (the per-bucket detail lives in
                the Overhead hours breakdown modal). */}
            {overheadHrs > 0.005 ? (
              <tr style={{ background: '#f9fafb' }}>
                <td>
                  <em>Overhead hours</em>
                </td>
                <td className="num">{fmtMoney(0)}</td>
                <td className="num">{fmtH(overheadHrs)}</td>
                <td className="num">{fmtMoney(-overheadHoursOverhead)}</td>
                <td className="num" style={negStyle}>
                  {fmtMoney(-overheadHoursOverhead)}
                </td>
              </tr>
            ) : null}
            {pb.unaccountedHours > 0.01 ? (
              <tr style={{ background: '#fff7ed' }}>
                <td>
                  <em>Unallocated hours</em>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    Hours worked in the period that were not tied to a job, but still incur overhead.
                  </div>
                </td>
                <td className="num">{fmtMoney(0)}</td>
                <td className="num">{fmtH(pb.unaccountedHours)}</td>
                <td className="num">{fmtMoney(-(pb.unaccountedHours * overheadRate))}</td>
                <td className="num" style={negStyle}>
                  {fmtMoney(-(pb.unaccountedHours * overheadRate))}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                Total<br />(all hours)
              </td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(pb.totalNet)}</td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtH(pb.totalHours)}</td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(-totalOverhead)}</td>
              <td
                className="num"
                style={totalProfit < 0 ? { ...negStyle, fontWeight: 600 } : { fontWeight: 600 }}
              >
                {fmtMoney(totalProfit)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      <p className="caption">
        Per-job overhead = your hours on that job &times; rate. Profit
        (job) = Allocated Net Rev &minus; Overhead. Job rows sorted by
        profit. Overhead hours ({fmtH(overheadHrs)}) are charged the
        same rate as field hours but contribute no revenue, so they
        appear as a single deduction-only row.
      </p>
      <p className="caption">
        Profit (after overhead) = Net Revenue &minus; (<strong>all hours</strong>{' '}
        &times; rate). The rate is the rolling 90-day overhead spend
        per field hour; we apply it to every hour the person worked
        (field + office + bid) so the deduction reflects this person&rsquo;s
        full share of the overhead burden.
      </p>
    </>
  )
}

export function GrossPerHourBody(props: { entry: TeamSummaryBreakdown }) {
  const { entry } = props
  const totalHours = entry.pb.totalHours
  const totalGross = entry.gb.total
  const rate = totalHours > 0 ? totalGross / totalHours : 0
  if (!entry.gb.jobs || entry.gb.jobs.length === 0) {
    return (
      <>
        <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Gross Revenue:</strong> {fmtMoney(totalGross)}
          </div>
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Total hours:</strong> {fmtH(totalHours)}
          </div>
          <div style={{ fontSize: '1.05rem' }}>
            <strong>Gross Revenue/hr: {fmtMoneyPerHr(rate)}</strong>
          </div>
        </div>
        <p className="caption">No jobs contributed to revenue in this period.</p>
      </>
    )
  }
  const hoursByJob = new Map(entry.pb.jobs.map((j) => [j.jobId, j.hoursInPeriod]))
  const rows = entry.gb.jobs
    .map((j) => {
      const h = hoursByJob.get(j.jobId) || 0
      const perHr = h > 0 ? j.allocatedRevenue / h : null
      return {
        jobId: j.jobId,
        hcp: j.hcp,
        jobName: j.jobName,
        allocatedRevenue: j.allocatedRevenue,
        hoursInPeriod: h,
        perHr,
      }
    })
    .sort(
      (a, b) => (b.perHr == null ? -1 : b.perHr) - (a.perHr == null ? -1 : a.perHr),
    )
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Gross Revenue:</strong> {fmtMoney(totalGross)}
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Total hours:</strong> {fmtH(totalHours)}
        </div>
        <div style={{ fontSize: '1.05rem' }}>
          <strong>Gross Revenue/hr: {fmtMoneyPerHr(rate)}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th className="num">HCP</th>
            <th>Job</th>
            <th className="num">Allocated<br />Gross Rev</th>
            <th className="num">Your hours<br />(period)</th>
            <th className="num">$/hr<br />(this job)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.jobId}>
              <td className="num">{r.hcp}</td>
              <td>{r.jobName || '—'}</td>
              <td className="num">{fmtMoney(r.allocatedRevenue)}</td>
              <td className="num">{fmtH(r.hoursInPeriod)}</td>
              <td className="num">{r.perHr == null ? <DashCell /> : fmtMoneyPerHr(r.perHr)}</td>
            </tr>
          ))}
          {entry.pb.unaccountedHours > 0.01 ? (
            <tr style={{ background: '#fff7ed' }}>
              <td className="num">&mdash;</td>
              <td>
                <em>Unallocated hours</em>
                <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Hours worked in the period that weren&rsquo;t tied to a job &mdash; they dilute the headline rate but contribute no revenue.
                </div>
              </td>
              <td className="num">{fmtMoney(0)}</td>
              <td className="num">{fmtH(entry.pb.unaccountedHours)}</td>
              <td className="num"><DashCell /></td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(totalGross)}</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtH(totalHours)}</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoneyPerHr(rate)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="caption">
        Headline rate = Total Gross Revenue &divide; Total hours (including
        any unallocated hours). Per-job rate = Allocated Gross &divide; Your
        hours on that job. Sorted by per-job rate.
      </p>
      <p className="caption">
        Gross Revenue/hr is your <strong>total Gross Revenue</strong>{' '}
        divided by your <strong>total hours</strong> in the period. Per-job
        rates show how much each job paid per hour you spent on it.
      </p>
    </>
  )
}

export function NetPerHourBody(props: { entry: TeamSummaryBreakdown }) {
  const { entry } = props
  const totalHours = entry.pb.totalHours
  const totalNet = entry.nb.total
  const rate = totalHours > 0 ? totalNet / totalHours : 0
  const hoursByJob = new Map(entry.pb.jobs.map((j) => [j.jobId, j.hoursInPeriod]))
  const rows = (entry.nb.jobs || [])
    .map((j) => {
      const h = hoursByJob.get(j.jobId) || 0
      const perHr = h > 0 ? j.allocatedNet / h : null
      return {
        jobId: j.jobId,
        hcp: j.hcp,
        jobName: j.jobName,
        allocatedNet: j.allocatedNet,
        hoursInPeriod: h,
        perHr,
      }
    })
    .sort(
      (a, b) =>
        (b.perHr == null ? -Infinity : b.perHr) -
        (a.perHr == null ? -Infinity : a.perHr),
    )
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          Net Revenue/hr is your <strong>total Net Revenue (before overhead)</strong>{' '}
          divided by your <strong>total hours</strong> in the period. Per-job
          rates show how much each job kept (after parts and labor) per hour
          you spent on it.
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Net Revenue:</strong> {fmtMoney(totalNet)}
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Total hours:</strong> {fmtH(totalHours)}
        </div>
        <div style={{ fontSize: '1.05rem' }}>
          <strong>
            Net Revenue/hr:{' '}
            <span style={rate < 0 ? negStyle : undefined}>{fmtMoneyPerHr(rate)}</span>
          </strong>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="caption">No jobs contributed to net revenue in this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="num">HCP</th>
              <th>Job</th>
              <th className="num">Allocated<br />Net Rev</th>
              <th className="num">Your hours<br />(period)</th>
              <th className="num">$/hr<br />(this job)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.jobId}>
                <td className="num">{r.hcp}</td>
                <td>{r.jobName || '—'}</td>
                <td className="num" style={r.allocatedNet < 0 ? negStyle : undefined}>
                  {fmtMoney(r.allocatedNet)}
                </td>
                <td className="num">{fmtH(r.hoursInPeriod)}</td>
                <td
                  className="num"
                  style={r.perHr != null && r.perHr < 0 ? negStyle : undefined}
                >
                  {r.perHr == null ? <DashCell /> : fmtMoneyPerHr(r.perHr)}
                </td>
              </tr>
            ))}
            {entry.pb.unaccountedHours > 0.01 ? (
              <tr style={{ background: '#fff7ed' }}>
                <td className="num">&mdash;</td>
                <td>
                  <em>Unallocated hours</em>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    Hours worked in the period that weren&rsquo;t tied to a job &mdash; they dilute the headline rate but contribute no net revenue.
                  </div>
                </td>
                <td className="num">{fmtMoney(0)}</td>
                <td className="num">{fmtH(entry.pb.unaccountedHours)}</td>
                <td className="num"><DashCell /></td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
              <td
                className="num"
                style={totalNet < 0 ? { ...negStyle, fontWeight: 600 } : { fontWeight: 600 }}
              >
                {fmtMoney(totalNet)}
              </td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtH(totalHours)}</td>
              <td
                className="num"
                style={rate < 0 ? { ...negStyle, fontWeight: 600 } : { fontWeight: 600 }}
              >
                {fmtMoneyPerHr(rate)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      <p className="caption">
        Headline rate = Total Net Revenue &divide; Total hours (including
        any unallocated hours). Per-job rate = Allocated Net &divide; Your
        hours on that job. Sorted by per-job rate.
      </p>
    </>
  )
}

export function ProfitPerHourBody(props: {
  entry: TeamSummaryBreakdown
  overheadRate: number | null
}) {
  const { entry, overheadRate } = props
  const totalHours = entry.pb.totalHours
  const fieldHrs = entry.pb.fieldHours != null ? entry.pb.fieldHours : totalHours
  const overheadHrs = entry.pb.overheadHours != null ? entry.pb.overheadHours : 0
  const totalNet = entry.nb.total
  if (overheadRate == null) {
    return (
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.5rem', color: '#b91c1c' }}>
          Overhead rate is unavailable. Open the Review tab and let the
          rate finish loading, then reopen Team Summary.
        </div>
        <div>
          <strong>Net Revenue:</strong> {fmtMoney(totalNet)}
        </div>
        <div>
          <strong>Total hours:</strong> {fmtH(totalHours)}
        </div>
      </div>
    )
  }
  // Charge overhead on every hour (field + office + bid) so this stays
  // consistent with the Profit (after overhead) breakdown modal and the
  // Team Summary column. See ProfitBody above and
  // enrichTeamSummaryRowsForInline in formatters.ts.
  const fieldOverhead = fieldHrs * overheadRate
  const overheadHoursOverhead = overheadHrs * overheadRate
  const totalOverhead = fieldOverhead + overheadHoursOverhead
  const totalProfit = totalNet - totalOverhead
  const rate = totalHours > 0 ? totalProfit / totalHours : 0
  const hoursByJob = new Map(entry.pb.jobs.map((j) => [j.jobId, j.hoursInPeriod]))
  const rows = (entry.nb.jobs || [])
    .map((j) => {
      const h = hoursByJob.get(j.jobId) || 0
      const netPerHr = h > 0 ? j.allocatedNet / h : null
      const profitPerHr = netPerHr == null ? null : netPerHr - overheadRate
      return {
        jobId: j.jobId,
        hcp: j.hcp,
        jobName: j.jobName,
        allocatedNet: j.allocatedNet,
        hoursInPeriod: h,
        netPerHr,
        profitPerHr,
      }
    })
    .sort(
      (a, b) =>
        (b.profitPerHr == null ? -Infinity : b.profitPerHr) -
        (a.profitPerHr == null ? -Infinity : a.profitPerHr),
    )
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Overhead rate (Method A):</strong> ${overheadRate.toFixed(2)} per hour
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Net Revenue:</strong> {fmtMoney(totalNet)}
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Total hours:</strong> {fmtH(totalHours)} (field {fmtH(fieldHrs)}
          {overheadHrs > 0.005 ? <> + overhead {fmtH(overheadHrs)}</> : null})
        </div>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>&minus; Overhead deduction:</strong>{' '}
          {fmtH(totalHours)} &times; ${overheadRate.toFixed(2)} = {fmtMoney(totalOverhead)}
        </div>
        {overheadHrs > 0.005 ? (
          <div style={{ marginBottom: '0.25rem', paddingLeft: '1.5rem', color: '#6b7280' }}>
            ({fmtMoney(fieldOverhead)} field + {fmtMoney(overheadHoursOverhead)} overhead hours)
          </div>
        ) : null}
        <div style={{ marginBottom: '0.25rem' }}>
          <strong>Profit (after overhead):</strong>{' '}
          <span style={totalProfit < 0 ? negStyle : undefined}>{fmtMoney(totalProfit)}</span>
        </div>
        <div style={{ fontSize: '1.05rem' }}>
          <strong>
            Profit/hr (after overhead):{' '}
            <span style={rate < 0 ? negStyle : undefined}>{fmtMoneyPerHr(rate)}</span>
          </strong>
        </div>
      </div>
      {rows.length === 0 && overheadHrs < 0.005 && entry.pb.unaccountedHours < 0.01 ? (
        <p className="caption">No jobs contributed to net revenue in this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="num">HCP</th>
              <th>Job</th>
              <th className="num">Net Rev/hr<br />(this job)</th>
              <th className="num">&minus; Overhead<br />rate</th>
              <th className="num">= Profit/hr<br />(this job)</th>
              <th className="num">Your hours<br />(period)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.jobId}>
                <td className="num">{r.hcp}</td>
                <td>{r.jobName || '—'}</td>
                <td
                  className="num"
                  style={r.netPerHr != null && r.netPerHr < 0 ? negStyle : undefined}
                >
                  {r.netPerHr == null ? <DashCell /> : fmtMoneyPerHr(r.netPerHr)}
                </td>
                <td className="num">
                  {r.hoursInPeriod > 0 ? `$${overheadRate.toFixed(2)}/hr` : <DashCell />}
                </td>
                <td
                  className="num"
                  style={r.profitPerHr != null && r.profitPerHr < 0 ? negStyle : undefined}
                >
                  {r.profitPerHr == null ? <DashCell /> : fmtMoneyPerHr(r.profitPerHr)}
                </td>
                <td className="num">{fmtH(r.hoursInPeriod)}</td>
              </tr>
            ))}
            {/* Overhead hours (office + bid) — earn no revenue but
                still incur the per-hour overhead, so they show as
                a flat −$rate/hr drag. Surfaces the same data the
                Profit breakdown modal calls out so the two
                drilldowns reconcile visually. */}
            {overheadHrs > 0.005 ? (
              <tr style={{ background: '#f9fafb' }}>
                <td className="num">&mdash;</td>
                <td>
                  <em>Overhead hours</em>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    Office + bid time. No revenue, but still charged
                    the overhead rate now that overhead hours are
                    included in the deduction.
                  </div>
                </td>
                <td className="num">{fmtMoneyPerHr(0)}</td>
                <td className="num">${overheadRate.toFixed(2)}/hr</td>
                <td className="num" style={negStyle}>{fmtMoneyPerHr(-overheadRate)}</td>
                <td className="num">{fmtH(overheadHrs)}</td>
              </tr>
            ) : null}
            {entry.pb.unaccountedHours > 0.01 ? (
              <tr style={{ background: '#fff7ed' }}>
                <td className="num">&mdash;</td>
                <td>
                  <em>Unallocated hours</em>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    Hours worked in the period that weren&rsquo;t tied to a job &mdash; they earn no net revenue but still incur overhead.
                  </div>
                </td>
                <td className="num">{fmtMoneyPerHr(0)}</td>
                <td className="num">${overheadRate.toFixed(2)}/hr</td>
                <td className="num" style={negStyle}>{fmtMoneyPerHr(-overheadRate)}</td>
                <td className="num">{fmtH(entry.pb.unaccountedHours)}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Headline rate</td>
              <td
                className="num"
                style={rate < 0 ? { ...negStyle, fontWeight: 600 } : { fontWeight: 600 }}
              >
                {fmtMoneyPerHr(rate)}
              </td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtH(totalHours)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <p className="caption">
        Per-job: Profit/hr = (Allocated Net &divide; Your hours) &minus;
        Overhead rate. Headline rate = (Net Revenue &minus; Total overhead)
        &divide; Total hours, where{' '}
        <strong>total overhead = All hours &times; rate</strong> (every
        hour the person worked &mdash; field + office + bid &mdash; is
        charged the rate). Sorted by per-job profit/hr.
      </p>
      <p className="caption">
        Profit/hr (after overhead) divides your{' '}
        <strong>Profit (after overhead)</strong> by your{' '}
        <strong>total hours</strong>. The overhead deduction is{' '}
        <strong>all hours &times; rate</strong> &mdash; office and bid
        hours are charged the same per-hour overhead as field hours
        even though they earn no revenue, which is why those rows show
        a flat &minus;$&nbsp;rate per hour.
      </p>
    </>
  )
}

/** Helper used by OverheadHoursBody: hierarchical session list under a bucket header. */
function OverheadSessionsSection(props: {
  label: string
  sessions: OverheadSessionLine[]
  bucketTotalHrs: number
  /**
   * When true, render the section header (and an empty-state caption)
   * even with no sessions. Used for the Bids bucket so reviewers can
   * always confirm "0.0 hrs of bid work in this period" at a glance,
   * rather than the section silently disappearing.
   */
  alwaysShow?: boolean
  emptyMessage?: string
}) {
  const { label, sessions, bucketTotalHrs, alwaysShow, emptyMessage } = props
  if (sessions.length === 0 && !alwaysShow) return null
  // Group by workDate, preserving the original sort order coming from
  // the parent (derivePersonTeamSummary already orders by date/time).
  const byDate = new Map<string, OverheadSessionLine[]>()
  const datesInOrder: string[] = []
  for (const s of sessions) {
    if (!byDate.has(s.workDate)) {
      byDate.set(s.workDate, [])
      datesInOrder.push(s.workDate)
    }
    byDate.get(s.workDate)!.push(s)
  }
  return (
    <>
      <h3 style={{ textAlign: 'center' }}>
        {label}
        <span style={{ marginLeft: '0.5rem' }}>{`· ${fmtH(bucketTotalHrs)} hrs`}</span>
      </h3>
      {sessions.length === 0 ? (
        <p className="caption" style={{ textAlign: 'center' }}>
          {emptyMessage ||
            `No approved ${label.toLowerCase()} sessions in this period.`}
        </p>
      ) : (
        <div className="hours-day-list">
          {datesInOrder.map((dateKey) => {
            const daySessions = byDate.get(dateKey)!
            const dayTotal = daySessions.reduce((s, x) => s + (x.hours || 0), 0)
            return (
              <div className="hours-day-section" key={dateKey}>
                <div className="hours-day-header">
                  {dayHeaderLabel(dateKey)}
                  <span className="day-hours">{`· ${fmtH(dayTotal)} hrs`}</span>
                </div>
                <div className="hours-day-allocs">
                  {daySessions.map((ss, sj) => {
                    const pct = dayTotal > 0 ? (ss.hours / dayTotal) * 100 : 0
                    return (
                      <div className="hours-day-alloc" key={`${dateKey}-${sj}`}>
                        <span className="alloc-pct">{`(${fmtPct1(pct)})`}</span>{' '}
                        {ss.bucket === 'bid' ? (
                          <>
                            <span className="alloc-jobnum">{ss.bidHcp || 'B?'}</span>
                            {' | '}
                            <span className="alloc-jobname">
                              {ss.bidName ? ss.bidName : <DashCell />}
                            </span>
                            {ss.bidAddress ? (
                              <>
                                {' '}
                                <span className="alloc-address">{`- ${ss.bidAddress}`}</span>
                              </>
                            ) : null}
                          </>
                        ) : ss.startTime && ss.endTime ? (
                          <span className="alloc-jobname">{`${ss.startTime} → ${ss.endTime}`}</span>
                        ) : (
                          <span className="alloc-jobname">Office session</span>
                        )}
                        <span className="alloc-counted">{`· ${fmtH(ss.hours)} hrs`}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export function OverheadHoursBody(props: { entry: TeamSummaryBreakdown }) {
  const { entry } = props
  const officeHrs = entry.officeHours || 0
  const bidHrs = entry.bidHours || 0
  const totalOverhead = officeHrs + bidHrs
  const totalWork = entry.hb.totals?.totalHours || 0
  const fieldHrs = entry.fieldHours || 0
  const sessions = entry.overheadSessions || []
  const officeSessions = sessions.filter((s) => s.bucket === 'office')
  const bidSessions = sessions.filter((s) => s.bucket === 'bid')
  return (
    <>
      <OverheadSessionsSection
        label="Office"
        sessions={officeSessions}
        bucketTotalHrs={officeHrs}
      />
      <OverheadSessionsSection
        label="Bids"
        sessions={bidSessions}
        bucketTotalHrs={bidHrs}
        alwaysShow
        emptyMessage="No approved bid sessions in this period."
      />
      {officeSessions.length === 0 && bidSessions.length === 0 ? (
        <p className="caption" style={{ textAlign: 'center' }}>
          No approved office sessions in this period either.
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Bucket</th>
            <th className="num">Hours</th>
            <th className="num" style={{ textAlign: 'left' }}>Share of total work</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Overhead (office + bid)</td>
            <td className="num">{fmtH(totalOverhead)}</td>
            <td className="num" style={{ textAlign: 'left' }}>
              {totalWork > 0 ? fmtPct1((totalOverhead / totalWork) * 100) : <DashCell />}
            </td>
          </tr>
          <tr>
            <td>Field (residual)</td>
            <td className="num">{fmtH(fieldHrs)}</td>
            <td className="num" style={{ textAlign: 'left' }}>
              {totalWork > 0 ? fmtPct1((fieldHrs / totalWork) * 100) : <DashCell />}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>Total work</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtH(totalWork)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <p className="caption">
        Field hrs = Total work hrs &minus; Overhead hrs. For salaried
        people, total work is their weekday salary days (8 hrs/weekday);
        for hourly, it is people_hours / clock sessions.{' '}
        <strong>
          Every hour worked is charged the per-hour overhead in the
          &ldquo;Profit (after overhead)&rdquo; column
        </strong>{' '}
        &mdash; field, office, and bid hours all incur the same rate.
      </p>
      <p className="caption">
        Overhead hours are approved clock sessions on the configured Office
        job or on any bid &mdash; the same buckets that feed the rolling
        90-day overhead rate.
      </p>
    </>
  )
}

export function OverheadLaborBody(props: { entry: TeamSummaryBreakdown }) {
  const { entry } = props
  const officeHrs = entry.officeHours || 0
  const bidHrs = entry.bidHours || 0
  const fieldHrs = entry.fieldHours || 0
  const overheadHrs = officeHrs + bidHrs
  const wage = entry.hourlyWage || 0
  const overheadLaborCost = entry.overheadLaborCost || 0
  const src = entry.payConfigSource
  const srcLabel =
    src === 'salary'
      ? 'Salaried (weekday hrs × hourly_wage from people_pay_config)'
      : src === 'hourly'
        ? 'Hourly (people_hours / clock sessions × hourly_wage)'
        : 'Unknown (no people_pay_config row — wage treated as $0)'
  const officeCost = -(officeHrs * wage)
  const bidCost = -(bidHrs * wage)
  const hasCost = overheadLaborCost < 0
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div>
          <strong>Hourly wage:</strong>{' '}
          {wage > 0 ? `$${wage.toFixed(2)}/hr` : <span style={dashStyle}>not configured</span>}
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '1.05rem', textAlign: 'center' }}>
          <strong>Overhead labor: {fmtMoney(overheadLaborCost)}</strong>{' '}
          ({fmtH(overheadHrs)} overhead hrs &times; ${(wage || 0).toFixed(2)}/hr)
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Bucket</th>
            <th className="num">Hours</th>
            <th className="num">Cost</th>
            <th className="num" style={{ textAlign: 'left' }}>Share</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Office (configured office job)</td>
            <td className="num">{fmtH(officeHrs)}</td>
            <td className="num">{fmtMoney(officeCost)}</td>
            <td className="num" style={{ textAlign: 'left' }}>
              {hasCost ? fmtPct1((officeCost / overheadLaborCost) * 100) : <DashCell />}
            </td>
          </tr>
          <tr>
            <td>Bid (any bid_id)</td>
            <td className="num">{fmtH(bidHrs)}</td>
            <td className="num">{fmtMoney(bidCost)}</td>
            <td className="num" style={{ textAlign: 'left' }}>
              {hasCost ? fmtPct1((bidCost / overheadLaborCost) * 100) : <DashCell />}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>Total overhead labor</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtH(overheadHrs)}</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(overheadLaborCost)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <h3>For context: this person&rsquo;s field labor</h3>
      <table>
        <thead>
          <tr>
            <th>Bucket</th>
            <th className="num">Hours</th>
            <th className="num">Cost</th>
            <th>Where it shows up</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Field (everything not Office or Bid)</td>
            <td className="num">{fmtH(fieldHrs)}</td>
            <td className="num" style={dashStyle}>{fmtMoney(-(fieldHrs * wage))}</td>
            <td style={{ color: '#6b7280' }}>
              Already in <strong>Net Revenue</strong>.
            </td>
          </tr>
        </tbody>
      </table>
      {wage <= 0 ? (
        <p className="caption" style={{ color: '#b45309' }}>
          No <code>hourly_wage</code> is set for this person in{' '}
          <code>people_pay_config</code>, so the cost columns above show as
          $0. Set their wage on the People &rarr; Hours &rarr; Pay config row
          to make this column meaningful.
        </p>
      ) : null}
      <p className="caption">
        Overhead labor is what the company paid this person for hours that
        are <strong>not</strong> billed to a field job &mdash; the
        configured Office job and any time clocked into a bid. Field labor
        is excluded here on purpose: it is already subtracted at the
        per-job level inside Net Revenue (
        <code>job net = revenue − parts − total labor</code>), so showing
        it again would visually double-count.
      </p>
      <p className="caption">
        Office and bid hours fund the rolling 90-day overhead pool (office
        labor + bid labor + office parts), which is then deducted from
        every person as <code>total hours × rate</code> in the
        &ldquo;Profit (after overhead)&rdquo; column &mdash; every hour
        worked (field + office + bid) is charged the per-hour overhead.
        This Overhead labor column simply makes the office + bid wage
        contribution visible in each person&rsquo;s own row &mdash; it
        does <strong>not</strong> change Gross, Net, or Profit numbers.
      </p>
      <div style={{ marginTop: '1rem', color: '#374151' }}>
        <strong>Source:</strong> {srcLabel}
      </div>
    </>
  )
}

export function FieldHoursBody(props: {
  entry: TeamSummaryBreakdown
  overheadRate: number | null
}) {
  const { entry, overheadRate } = props
  // Read the Edit Job modal opener from context so the Job column can
  // become a clickable link. The hook returns null when the provider
  // isn't mounted (e.g. the standalone popup window or unit tests), in
  // which case the Job cell falls back to plain text.
  const jobModal = useJobFormModal()
  const openEditJob = jobModal?.openEditJob ?? null
  const hb = entry.hb
  const pb = entry.pb
  const totalWork = hb.totals?.totalHours || 0
  const officeHrs = entry.officeHours || 0
  const bidHrs = entry.bidHours || 0
  const fieldHrs = entry.fieldHours || 0
  const jobs = (pb.jobs || []).slice()
  const allocatedFieldHrs = jobs.reduce((s, j) => s + (j.hoursInPeriod || 0), 0)
  const unaccountedFieldHrs = pb.unaccountedHours || 0
  const srcLabel =
    hb.source === 'salary'
      ? 'Salaried (8 hrs/weekday)'
      : hb.source === 'hourly'
        ? 'Hourly (from people_hours / clock sessions)'
        : 'Unknown (no pay config row)'
  const modeLabel = hb.onlyPaidJobs
    ? 'Only paid jobs (sub labor + crew assignments on jobs marked paid in full)'
    : 'All days in period (clocked / salary, minus office + bid)'
  const ohRateNote =
    overheadRate != null
      ? `$${overheadRate.toFixed(2)} per hour × ${fmtH(fieldHrs + officeHrs + bidHrs)} all hours = ${fmtMoney(
          (fieldHrs + officeHrs + bidHrs) * overheadRate,
        )} overhead charged in "Profit (after overhead)" (field component: ${fmtH(fieldHrs)} × $${overheadRate.toFixed(
          2,
        )} = ${fmtMoney(fieldHrs * overheadRate)})`
      : 'Overhead rate unavailable — reload Review.'
  const jobsForDisplay = jobs
    .slice()
    .sort((a, b) => (b.hoursInPeriod || 0) - (a.hoursInPeriod || 0))
    .filter((j) => (j.hoursInPeriod || 0) > 0.005)
  return (
    <>
      <h3 style={{ textAlign: 'center' }}>Where the field hrs went</h3>
      {jobsForDisplay.length === 0 && unaccountedFieldHrs < 0.01 ? (
        <p className="caption">
          No field hours were recorded against any job in this period.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th className="num">Your field hrs<br />(period)</th>
              <th className="num" style={{ textAlign: 'left' }}>
                Share of<br />field hrs
              </th>
            </tr>
          </thead>
          <tbody>
            {jobsForDisplay.map((j) => {
              const share = fieldHrs > 0 ? (j.hoursInPeriod / fieldHrs) * 100 : 0
              // Job# folds into the Job cell so we can drop a column —
              // "<hcp> <name>" with a single space; muted hcp prefix
              // lets the eye still scan the column by job#. Falls back
              // to em-dash when the job name is blank.
              const jobName = j.jobName || '—'
              const hcpPrefix = j.hcp ? (
                <>
                  <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                    {j.hcp}
                  </span>{' '}
                </>
              ) : null
              const canEdit = !!openEditJob && !!j.jobId
              return (
                <tr key={j.jobId}>
                  <td>
                    {canEdit ? (
                      <button
                        type="button"
                        style={editJobLinkBtnStyle}
                        title={`Open Edit Job for ${j.hcp ? `${j.hcp} ` : ''}${jobName}`}
                        onClick={() => openEditJob?.(j.jobId)}
                      >
                        {hcpPrefix}
                        {jobName}
                      </button>
                    ) : (
                      <>
                        {hcpPrefix}
                        {jobName}
                      </>
                    )}
                  </td>
                  <td className="num">{fmtH(j.hoursInPeriod)}</td>
                  <td className="num" style={{ textAlign: 'left' }}>
                    {fieldHrs > 0 ? fmtPct1(share) : <DashCell />}
                  </td>
                </tr>
              )
            })}
            {unaccountedFieldHrs > 0.005 ? (
              <tr style={{ background: '#fff7ed' }}>
                <td>
                  <em>Unallocated field hrs</em>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    Field-type hours not tied to a specific job allocation
                    (e.g. salary day with no crew assignment).
                  </div>
                </td>
                <td className="num">{fmtH(unaccountedFieldHrs)}</td>
                <td className="num" style={{ textAlign: 'left' }}>
                  {fieldHrs > 0
                    ? fmtPct1((unaccountedFieldHrs / fieldHrs) * 100)
                    : <DashCell />}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                Total field hrs
              </td>
              <td className="num" style={{ fontWeight: 600 }}>
                {fmtH(allocatedFieldHrs + unaccountedFieldHrs)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
      <h3 style={{ textAlign: 'center' }}>How field hrs is computed</h3>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th className="num">Hours</th>
          </tr>
        </thead>
        <tbody>
          {hb.onlyPaidJobs ? (
            <>
              <tr>
                <td>Sub labor + crew hours on paid-in-full jobs</td>
                <td className="num">{fmtH(totalWork)}</td>
              </tr>
              <tr>
                <td>
                  <em>Office + bid hours are not in this mode by construction</em>
                </td>
                <td className="num"><DashCell /></td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td>
                  Total work hrs (
                  {hb.source === 'salary'
                    ? 'salary days'
                    : 'people_hours / clock sessions'}
                  )
                </td>
                <td className="num">{fmtH(totalWork)}</td>
              </tr>
              <tr>
                <td>&minus; Office hrs (clock on configured office job)</td>
                <td className="num">{fmtH(officeHrs)}</td>
              </tr>
              <tr>
                <td>&minus; Bid hrs (clock on any bid)</td>
                <td className="num">{fmtH(bidHrs)}</td>
              </tr>
            </>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>= Field hrs</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtH(fieldHrs)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="caption">
        Each crew assignment&rsquo;s hours = day total × pct. The day total
        is <code>peopleHours</code> (or 8 hrs on a salary weekday). Office
        time has its own crew row and is filtered from this field-revenue
        rollup; its share of the day appears as overhead. {ohRateNote}
      </p>
      <div style={{ marginTop: '1rem', color: '#374151' }}>
        <div>
          <strong>Source:</strong> {srcLabel}
        </div>
        <div>
          <strong>Counting mode:</strong> {modeLabel}
        </div>
      </div>
    </>
  )
}

export function OverheadRateBody(props: { overheadDecomp: OverheadRateDecomp }) {
  const d = props.overheadDecomp
  const officeLabor = d.officeLabor90d || 0
  const bidLabor = d.bidLabor90d || 0
  const officeParts = d.officeParts90d || 0
  const fieldHours = d.fieldHours90d || 0
  const fieldLaborUsd = d.fieldLaborUsd90d || 0
  const invoices = d.invoices90d || 0
  const totalOverhead = officeLabor + bidLabor + officeParts
  const ratePerHour = d.ratePerHour
  const ratePerLaborDollar = d.ratePerLaborDollar
  const ratePerRevenueDecimal = d.ratePerRevenueDecimal
  const components = [
    { label: 'Office labor (approved clock to office job)', value: officeLabor },
    { label: 'Bid labor (approved clock to any bid)', value: bidLabor },
    { label: 'Office parts (Tally on office job)', value: officeParts },
  ]
  return (
    <>
      <div style={{ marginBottom: '0.75rem', color: '#374151' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          Rolling 90-day overhead rate. Method A is{' '}
          <strong>$ per field hour</strong>: it spreads the overhead pool
          (office labor, bid labor, office parts) over the hours that
          actually produce billable field work. The Team Summary applies
          this rate against{' '}
          <code>all hours × rate</code> when deducting overhead from each
          person in the &ldquo;Profit (after overhead)&rdquo; column
          &mdash; office and bid hours fund the pool but are still charged
          the per-hour overhead so every hour the person worked reflects
          its full share of the overhead burden.
        </div>
        {d.windowStart && d.windowEnd ? (
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Window:</strong> {d.windowStart} &rarr; {d.windowEnd}
          </div>
        ) : null}
        <div style={{ fontSize: '1.05rem' }}>
          <strong>Rate:</strong>{' '}
          {ratePerHour == null ? (
            <span style={dashStyle}>unavailable</span>
          ) : (
            `$${Number(ratePerHour).toFixed(2)} per field hour`
          )}
        </div>
      </div>
      <h3>Numerator &mdash; overhead $ pool (90d)</h3>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th className="num">$ (90d)</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {components.map((c) => {
            const share = totalOverhead > 0 ? (c.value / totalOverhead) * 100 : 0
            return (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td className="num">{fmtMoney(c.value)}</td>
                <td className="num">{totalOverhead > 0 ? fmtPct1(share) : <DashCell />}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>Total overhead</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(totalOverhead)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <h3>Denominator &mdash; field labor (90d)</h3>
      <table>
        <thead>
          <tr>
            <th>Measure</th>
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Field hours (approved clock on non-office, non-bid jobs)</td>
            <td className="num">{fmtH(fieldHours)} hrs</td>
          </tr>
          <tr>
            <td>Field labor $ (same sessions &times; wage)</td>
            <td className="num">{fmtMoney(fieldLaborUsd)}</td>
          </tr>
        </tbody>
      </table>
      <h3>Resulting rates</h3>
      <table>
        <thead>
          <tr>
            <th>Rate</th>
            <th className="num">Value</th>
            <th>How it is used</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Method A &mdash; per field hour</td>
            <td className="num">
              {ratePerHour == null ? <DashCell /> : `$${Number(ratePerHour).toFixed(2)}/hr`}
            </td>
            <td>
              Used to deduct overhead in the Team Summary: Profit after
              overhead = Net &minus; <strong>field hours</strong> &times;
              rate. Office and bid hours are not charged (they fund the
              rate).
            </td>
          </tr>
          <tr>
            <td>Method B &mdash; per field labor $</td>
            <td className="num">
              {ratePerLaborDollar == null ? (
                <DashCell />
              ) : (
                `$${Number(ratePerLaborDollar).toFixed(2)} / $1 labor`
              )}
            </td>
            <td>Reference only: ratio of overhead pool to field labor dollars.</td>
          </tr>
          <tr>
            <td>Method C &mdash; per revenue $ (invoices sent)</td>
            <td className="num">
              {ratePerRevenueDecimal == null ? (
                <DashCell />
              ) : (
                `${(Number(ratePerRevenueDecimal) * 100).toFixed(1)}% of revenue`
              )}
            </td>
            <td>Reference only: invoices sent in window = {fmtMoney(invoices)}.</td>
          </tr>
        </tbody>
      </table>
      <p className="caption">
        Method A is the headline rate. Sessions used: approved, not revoked,
        not rejected, with a clock-out. Wages come from{' '}
        <code>people_pay_config.hourly_wage</code>. Office job is the one
        configured in People &rarr; Overhead settings.
      </p>
    </>
  )
}
