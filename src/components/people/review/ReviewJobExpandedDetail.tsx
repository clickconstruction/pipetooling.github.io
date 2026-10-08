import { formatCurrency } from '../../../lib/format'
import { formatJobLedgerNumberLabel, resolveJobLedgerPrefix, type LedgerPrefixMap } from '../../../lib/ledgerDisplayPrefixes'
import type { ReviewOverheadRates } from '../../../lib/people/loadReviewOverheadRates'
import type { ReviewCrewJob, ReviewLaborJob } from '../../../lib/people/reviewPersonTypes'
import { fmtMoney } from '../teamSummary/formatters'
import { signedCurrency } from './reviewFormat'

/**
 * People → Review → Jobs Worked: the detail row under an expanded job (punch list #46 row 8, the
 * Review map's step 6, v2.4909). The labor-sheet row and the crew-day row drew the same 235-line
 * grid twice, byte for byte; it lives here once. Per-hour mirrors, the Gross Revenue, Costs and Net
 * Revenue chains, Parts and Subs, and the three overhead methods with their tooltips. Moved
 * verbatim from PeopleReviewTab: the person's name and the overhead rates come in as props
 * instead of from the tab's closure.
 */
export function ReviewJobExpandedDetail({
  job: j,
  personName,
  prefixMap,
  overheadRates: reviewOverheadRates,
}: {
  job: ReviewLaborJob | ReviewCrewJob
  /** The person the panel is about; the labels read "User" when none is picked. */
  personName: string | undefined
  prefixMap: LedgerPrefixMap
  overheadRates: ReviewOverheadRates
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
          <span style={{ color: 'var(--text-muted)' }}>{`${personName ?? 'User'}'s Gross Revenue/hr`}</span>
          <span>{(() => {
            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
          })()}</span>
          <span style={{ color: 'var(--text-muted)' }}>{`${personName ?? 'User'}'s Net Revenue/hr`}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {(() => {
              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
              return <span style={{ color: v != null && v < 0 ? 'var(--text-red-700)' : undefined }}>{v != null ? fmtMoney(v) : '—'}</span>
            })()}
            <span
              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
            </span>
          </span>
          <span
            style={{ color: 'var(--text-muted)' }}
            title={(() => {
              const r = reviewOverheadRates.ratePerHour
              if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate ($/hr). Loading or no overhead data yet."
              return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr.`
            })()}
          >{`${personName ?? 'User'}'s Profit/hr`}</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerHour
            if (r == null) return '—'
            const netRevPerHr = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
            if (netRevPerHr == null) return '—'
            const profitPerHr = netRevPerHr - r
            return <span style={{ color: profitPerHr < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(profitPerHr)}</span>
          })()}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
          <span style={{ color: 'var(--text-muted)' }}>Job Gross Revenue (total bill)</span>
          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)' }}>{(() => {
            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
            const numLabel = rawNum && rawNum !== '—'
              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
              : 'Job'
            return `${numLabel} Progress`
          })()}</span>
          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
          <span style={{ color: 'var(--text-muted)' }}>Value Created (revenue * progress)</span>
          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${personName ?? 'User'}'s % of Value Created`}</span>
          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${personName ?? 'User'}'s share of Value Created`}</span>
          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${personName ?? 'User'}'s Value Created this day`}</span>
          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
          <span style={{ color: 'var(--text-muted)' }}>{(() => {
            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
            const numLabel = rawNum && rawNum !== '—'
              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
              : 'this job'
            return `Total Labor on ${numLabel}`
          })()}</span>
          <span>{(() => {
            const totalLaborDollars = j.totalLaborOnJob
            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
          })()}</span>
          <span style={{ color: 'var(--text-muted)' }}>Rest of Teams Labor</span>
          <span>{(() => {
            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
          })()}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
            const name = personName ?? 'User'
            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
            const numLabel = rawNum && rawNum !== '—'
              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
              : 'this job'
            return `${name}'s labor on ${numLabel}`
          })()}</span>
          <span style={{ paddingLeft: '1rem' }}>{(() => {
            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
          })()}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
            const name = personName ?? 'User'
            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
            const numLabel = rawNum && rawNum !== '—'
              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
              : 'this job'
            return `${name}'s labor on ${numLabel} this day`
          })()}</span>
          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
          })()}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${personName ?? 'User'}'s Labor Rate`}</span>
          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
          <span>{(() => {
            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
          })()}</span>
          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ color: 'var(--text-muted)' }}>Parts:</span>
          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)' }}>Subs:</span>
          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
          <span style={{ color: 'var(--text-muted)' }}>Net Revenue (before overhead)</span>
          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${personName ?? 'User'}'s Net Revenue on Job`}</span>
          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${personName ?? 'User'}'s Net Revenue this Day`}</span>
          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? signedCurrency(j.allocatedRevenueBeforeOverhead) : '—'}</span>
          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            A. Overhead by labor hours
            <span
              title={(() => {
                const r = reviewOverheadRates.ratePerHour
                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
              })()}
              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
            </span>
          </span>
          <span
            style={{ color: 'var(--text-muted)' }}
            title="Profit (Method A) = Net Revenue (before overhead) − this method's overhead amount."
          >Profit</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerHour
            if (r == null || j.totalJobHours <= 0) return '—'
            return `$${formatCurrency(j.totalJobHours * r)}`
          })()}</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerHour
            if (r == null || j.totalJobHours <= 0) return '—'
            const profit = j.revenueBeforeOverhead - (j.totalJobHours * r)
            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
          })()}</span>
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            B. Overhead by revenue
            <span
              title={(() => {
                const r = reviewOverheadRates.ratePerRevenueDecimal
                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
              })()}
              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
            </span>
          </span>
          <span
            style={{ color: 'var(--text-muted)' }}
            title="Profit (Method B) = Net Revenue (before overhead) − this method's overhead amount."
          >Profit</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerRevenueDecimal
            if (r == null || j.valueCreated <= 0) return '—'
            return `$${formatCurrency(j.valueCreated * r)}`
          })()}</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerRevenueDecimal
            if (r == null || j.valueCreated <= 0) return '—'
            const profit = j.revenueBeforeOverhead - (j.valueCreated * r)
            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
          })()}</span>
          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            C. Overhead by direct labor cost
            <span
              title={(() => {
                const r = reviewOverheadRates.ratePerLaborDollar
                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
              })()}
              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
            </span>
          </span>
          <span
            style={{ color: 'var(--text-muted)' }}
            title="Profit (Method C) = Net Revenue (before overhead) − this method's overhead amount."
          >Profit</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerLaborDollar
            if (r == null || j.totalLaborOnJob <= 0) return '—'
            return `$${formatCurrency(j.totalLaborOnJob * r)}`
          })()}</span>
          <span>{(() => {
            if (reviewOverheadRates.loading) return '…'
            const r = reviewOverheadRates.ratePerLaborDollar
            if (r == null || j.totalLaborOnJob <= 0) return '—'
            const profit = j.revenueBeforeOverhead - (j.totalLaborOnJob * r)
            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
          })()}</span>
        </div>
      </td>
    </tr>
  )
}
