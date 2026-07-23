import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LaborJob } from '../../types/laborJob'
import type { TallyPartRow } from '../../types/tallyPart'
import type {
  JobSummaryClockSessionRow,
  JobSummaryInvoiceAllocationLine,
  JobSummaryMercuryAllocationRow,
} from '../../types/jobSummary'
import {
  formatCurrency,
  formatJobSummaryDurationMinutes,
  formatJobSummaryInvoiceDate,
  formatJobSummaryMercuryPostedAt,
  formatJobSummarySessionDateTime,
  formatJobSummarySessionTimeOnly,
  jobSummaryPartsCostIsZero,
} from '../jobs/jobFormatting'
import { formatDecimalWorkHoursToHhMm } from '../formatDecimalWorkHoursHhMm'
import {
  buildJobSummaryPersonSummaryRows,
  partitionUnattributedFromJobSummaryPersonRows,
} from '../jobSummaryPersonSummaryTable'
import {
  buildJobSummaryTeamLaborWorkDateTableRows,
  isJobSummaryNoWorkDateKey,
  type ByWorkDateEntry,
} from '../jobSummaryTeamLaborWorkDateTable'
import { buildPartsPerPersonCostRows, type TallyLineForPersonRollup } from '../partsPerPersonCostSummary'
import { normalizePersonNameKey } from '../personNameKey'
import { formatWorkDateYmdWeekdayLongFriendly } from '../../utils/dateUtils'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../mercuryRawDebitCard'
import { laborJobSubCost } from '../jobs/subLaborCost'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * Jobs → Job Summary "Print cost breakdown" (Stage A of the Jobs.tsx
 * decomposition — see docs/JOBS_TABS_ARCHITECTURE.md). Pure HTML builder:
 * the page resolves the lazy caches / fetch fallbacks (invoice lines, mercury
 * allocations + attribution names, clock sessions) and passes them in; the
 * window.open/print glue stays at the call site. Output bytes are unchanged
 * from the inline `printJobSummaryCostBreakdown`.
 */

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Structural slice of the page's TeamLaborRow (quirk #15 — Jobs.tsx has a local copy of the util type). */
export type JobSummaryPrintTeamLaborRow = {
  manHours: number
  breakdown: Array<{
    personName: string
    hours: number
    cost: number
    byWorkDate: ByWorkDateEntry[]
  }>
}

export type JobSummaryCostBreakdownInput = {
  job: JobWithDetails
  teamLaborRow: JobSummaryPrintTeamLaborRow | null
  teamLaborCost: number
  subLaborJobs: LaborJob[]
  partsFromTally: number
  billedMaterialsSum: number
  invoicesFromSupplyHouses: number
  cardCharges: number
  totalBill: number
  profit: number
  tallyPartsForJob: TallyPartRow[]
  mileageCost: number
  timePerMile: number
  invoiceRows: JobSummaryInvoiceAllocationLine[]
  /** True when the invoice-line fetch fallback failed (renders the historical unavailable note). */
  invoiceDetailUnavailable?: boolean
  mercuryRows: JobSummaryMercuryAllocationRow[]
  /** True when the mercury-allocation fetch fallback failed. */
  cardDetailUnavailable?: boolean
  clockSessions: JobSummaryClockSessionRow[]
  /** Whether the clock-session cache had this job (per-person session tables render only then). */
  clockSessionsLoaded: boolean
  nicknameByDebitCard: Record<string, string | undefined>
  /** Timestamp line under the H1; injectable for tests, defaults to now. */
  generated?: string
}

export function buildJobSummaryCostBreakdownHtml(input: JobSummaryCostBreakdownInput): string {
  const {
    job,
    teamLaborRow,
    teamLaborCost,
    subLaborJobs,
    partsFromTally,
    billedMaterialsSum,
    invoicesFromSupplyHouses,
    cardCharges,
    totalBill,
    profit,
    tallyPartsForJob,
    mileageCost,
    timePerMile,
    invoiceRows,
    mercuryRows,
    clockSessions,
    clockSessionsLoaded,
    nicknameByDebitCard,
  } = input
  const generated = input.generated ?? new Date().toLocaleString()
  const headerTitle = `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} — ${job.job_name ?? '—'} — ${job.job_address ?? '—'}`
  const invoiceNote = input.invoiceDetailUnavailable ? '<p class="muted">Invoice line detail unavailable.</p>' : ''
  const mercuryNote = input.cardDetailUnavailable ? '<p class="muted">Card charge line detail unavailable.</p>' : ''
  const mRows = mercuryRows

  const tallyRollupForPrint: TallyLineForPersonRollup[] = tallyPartsForJob.map((r) => ({
    part_id: r.part_id,
    quantity: r.quantity,
    price_at_time: r.price_at_time,
    fixture_cost: r.fixture_cost,
    created_by_user_id: r.created_by_user_id,
    created_by_name: r.created_by_name,
  }))
  const {
    rows: ppRowsPrint,
    footer: ppFooterPrint,
    sumsOk: ppSumsOkPrint,
  } = buildPartsPerPersonCostRows({
    parts: tallyRollupForPrint,
    billedMaterialsSum,
    invoiceJobTotal: invoicesFromSupplyHouses,
    mercuryRows: mRows,
    parentCardTotal: cardCharges,
  })
  const teamBreakdownLite = (teamLaborRow?.breakdown ?? []).map((b) => ({
    personName: b.personName,
    cost: b.cost,
    hours: b.hours,
  }))
  const personRowsPrint = buildJobSummaryPersonSummaryRows({
    teamBreakdown: teamBreakdownLite,
    ppRows: ppRowsPrint,
  })
  const { rows: personRowsForTablePrint, unattributedCard: unattributedCardPrint } =
    partitionUnattributedFromJobSummaryPersonRows(personRowsPrint)
  const partsCostPrint = partsFromTally + invoicesFromSupplyHouses + billedMaterialsSum + cardCharges
  const subLaborTotalPrint = subLaborJobs.reduce(
    (s, lj) => s + laborJobSubCost(lj, mileageCost, timePerMile),
    0,
  )
  const teamLaborCell = teamLaborCost === 0 ? '—' : `$${formatCurrency(teamLaborCost)}`
  const subLaborCell = jobSummaryPartsCostIsZero(subLaborTotalPrint) ? '—' : `$${formatCurrency(subLaborTotalPrint)}`
  const partsCostCell = jobSummaryPartsCostIsZero(partsCostPrint) ? '—' : `$${formatCurrency(partsCostPrint)}`
  const totalBillCell = totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`
  const profitCell = `$${formatCurrency(profit)}`
  const summaryTableHtml = `<h2 class="print-section">Summary</h2>
<table class="print-key-table"><thead><tr>
<th>Team labor</th><th>Sub labor</th><th>Parts cost</th><th>Total bill</th><th>Revenue before overhead</th>
</tr></thead><tbody><tr>
<td style="text-align:right">${teamLaborCell}</td>
<td style="text-align:right">${subLaborCell}</td>
<td style="text-align:right">${partsCostCell}</td>
<td style="text-align:right">${totalBillCell}</td>
<td style="text-align:right">${profitCell}</td>
</tr></tbody></table>`

  const personFilterNote =
    '<p class="muted print-note">All people. The cost breakdown person search in the app does not apply to this print.</p>'

  const hasUnassignedRowContentPrint =
    !jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) || !jobSummaryPartsCostIsZero(unattributedCardPrint)
  const unassignedRowTotalPrint = unattributedCardPrint + Number(invoicesFromSupplyHouses ?? 0)
  const unassignedSupplyRowPrint = hasUnassignedRowContentPrint
    ? `<tr>
<td>Unassigned</td>
<td style="text-align:right">—</td>
<td style="text-align:right">—</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(unattributedCardPrint) ? '—' : `$${formatCurrency(unattributedCardPrint)}`
      }</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? '—' : `$${formatCurrency(invoicesFromSupplyHouses)}`
      }</td>
<td style="text-align:right">${
        jobSummaryPartsCostIsZero(unassignedRowTotalPrint) ? '—' : `$${formatCurrency(unassignedRowTotalPrint)}`
      }</td>
</tr>`
    : ''

  let personSummaryHtml = `<h2 class="print-section">Person summary</h2>${personFilterNote}`
  if (personRowsForTablePrint.length === 0 && !hasUnassignedRowContentPrint) {
    personSummaryHtml += '<p class="muted">No per-person team labor or card data.</p>'
  } else {
    const prTr = personRowsForTablePrint
      .map((r) => {
        const rowSum = r.teamLabor + r.card
        return `<tr>
<td>${escapeHtml(r.displayName)}</td>
<td style="text-align:right">${formatDecimalWorkHoursToHhMm(r.hours)}</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(r.teamLabor) ? '—' : `$${formatCurrency(r.teamLabor)}`}</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(r.card) ? '—' : `$${formatCurrency(r.card)}`}</td>
<td style="text-align:right;color:#6b7280">—</td>
<td style="text-align:right">${jobSummaryPartsCostIsZero(rowSum) ? '—' : `$${formatCurrency(rowSum)}`}</td>
</tr>`
      })
      .join('')
    const sumCardFromRows = personRowsForTablePrint.reduce((s, r) => s + r.card, 0)
    const footHours = teamLaborRow ? formatDecimalWorkHoursToHhMm(teamLaborRow.manHours) : '—'
    const footTeam = jobSummaryPartsCostIsZero(teamLaborCost) ? '—' : `$${formatCurrency(teamLaborCost)}`
    const footCard = jobSummaryPartsCostIsZero(cardCharges) ? '—' : `$${formatCurrency(cardCharges)}`
    const footTotalNumeric = teamLaborCost + cardCharges + Number(invoicesFromSupplyHouses ?? 0)
    const footTotal =
      jobSummaryPartsCostIsZero(footTotalNumeric) ? '—' : `$${formatCurrency(footTotalNumeric)}`
    personSummaryHtml += `<table>
<thead><tr>
<th style="text-align:left">Name</th>
<th style="text-align:right">Hours</th>
<th style="text-align:right">Team labor cost</th>
<th style="text-align:right">Card charges</th>
<th style="text-align:right">Supply houses</th>
<th style="text-align:right">Total</th>
</tr></thead>
<tbody>${prTr}${unassignedSupplyRowPrint}
<tr style="font-weight:600">
<td>Total</td>
<td style="text-align:right">${footHours}</td>
<td style="text-align:right">${footTeam}</td>
<td style="text-align:right">${footCard}</td>
<td style="text-align:right">${
      jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? '—' : `$${formatCurrency(invoicesFromSupplyHouses)}`
    }</td>
<td style="text-align:right">${footTotal}</td>
</tr>
</tbody></table>`
    if (
      !jobSummaryPartsCostIsZero(cardCharges) &&
      Math.abs(sumCardFromRows + unattributedCardPrint - cardCharges) > 0.02
    ) {
      personSummaryHtml +=
        '<p class="muted" style="color:#b45309;font-size:0.85rem">Per-person card totals may not match job card total; check attributions.</p>'
    }
  }

  const clockLoaded = clockSessionsLoaded

  let teamLaborHtml = ''
  if (teamLaborRow && teamLaborRow.breakdown.length > 0) {
    const bodyRows = teamLaborRow.breakdown
      .map(
        (b) =>
          `<tr><td>${escapeHtml(b.personName)}</td><td style="text-align:right">${formatCurrency(b.hours)}</td></tr>`,
      )
      .join('')
    teamLaborHtml = `<h2>Team Labor</h2><table><thead><tr><th>Person</th><th style="text-align:right">Hours</th></tr></thead><tbody>${bodyRows}<tr style="font-weight:600"><td>Total</td><td style="text-align:right">${formatCurrency(teamLaborRow.manHours)}</td></tr></tbody></table>`
    if (clockLoaded && teamLaborRow) {
      for (const b of teamLaborRow.breakdown) {
        const sessionsForPerson = clockSessions.filter(
          (s) => normalizePersonNameKey(s.users?.name ?? '') === normalizePersonNameKey(b.personName),
        )
        const printCombinedRows = buildJobSummaryTeamLaborWorkDateTableRows(b.byWorkDate, sessionsForPerson)
        if (printCombinedRows.length === 0) {
          teamLaborHtml += `<p class="muted">No crew allocation or clock sessions for this person.</p>`
        } else {
          const trs = printCombinedRows
            .map((row) => {
              if (row.kind === 'alloc') {
                const w = isJobSummaryNoWorkDateKey(row.workDate)
                  ? '—'
                  : formatWorkDateYmdWeekdayLongFriendly(row.workDate)
                return `<tr><td>${escapeHtml(w)}</td><td>—</td><td>—</td><td>—</td><td style="text-align:right">${formatCurrency(row.hours)}</td><td style="text-align:right">$${formatCurrency(row.cost)}</td></tr>`
              }
              const s = row.session
              const dur =
                s.clocked_in_at && s.clocked_out_at
                  ? formatJobSummaryDurationMinutes(
                      new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime(),
                    )
                  : '—'
              const w = isJobSummaryNoWorkDateKey(row.workDate)
                ? '—'
                : formatWorkDateYmdWeekdayLongFriendly(row.workDate)
              return `<tr><td>${escapeHtml(w)}</td><td>${escapeHtml(formatJobSummarySessionTimeOnly(s.clocked_in_at))}</td><td>${escapeHtml(formatJobSummarySessionTimeOnly(s.clocked_out_at))}</td><td style="text-align:right">${escapeHtml(dur)}</td><td style="text-align:right">—</td><td style="text-align:right">—</td></tr>`
            })
            .join('')
          const printAllocTotals = printCombinedRows.reduce(
            (acc, r) => {
              if (r.kind === 'alloc') {
                acc.hours += r.hours
                acc.cost += r.cost
              }
              return acc
            },
            { hours: 0, cost: 0 },
          )
          const printTfoot = `<tfoot><tr style="font-weight:600;border-top:1px solid #ccc"><td colspan="4">Total</td><td style="text-align:right">${formatCurrency(printAllocTotals.hours)}</td><td style="text-align:right">$${formatCurrency(printAllocTotals.cost)}</td></tr></tfoot>`
          teamLaborHtml += `<table><thead><tr><th>Work date</th><th>In</th><th>Out</th><th style="text-align:right">Duration</th><th style="text-align:right">Hrs</th><th style="text-align:right">$</th></tr></thead><tbody>${trs}</tbody>${printTfoot}</table>`
        }
      }
      const nameKeys = new Set(teamLaborRow.breakdown.map((x) => normalizePersonNameKey(x.personName)))
      const orphan = clockSessions.filter((s) => {
        const kn = normalizePersonNameKey(s.users?.name ?? '')
        if (!kn) return true
        return !nameKeys.has(kn)
      })
      if (orphan.length > 0) {
        const or = orphan
          .map(
            (s) =>
              `<tr><td>${escapeHtml(s.users?.name ?? '—')}</td><td>${escapeHtml(s.work_date ? formatWorkDateYmdWeekdayLongFriendly(s.work_date) : '—')}</td><td>${escapeHtml(formatJobSummarySessionDateTime(s.clocked_in_at))}</td><td>${escapeHtml(formatJobSummarySessionDateTime(s.clocked_out_at))}</td></tr>`,
          )
          .join('')
        teamLaborHtml += `<h3 style="font-size:0.95rem;margin:0.75rem 0 0.35rem">Sessions not matched to a name above</h3><table><thead><tr><th>User</th><th>Work date</th><th>In</th><th>Out</th></tr></thead><tbody>${or}</tbody></table>`
      }
    }
  } else if (teamLaborCost === 0) {
    teamLaborHtml = `<h2>Team Labor</h2><p class="muted">No team labor for this job.</p>`
  } else {
    teamLaborHtml = `<h2>Team Labor</h2><p class="muted">Team labor total $${formatCurrency(teamLaborCost)} (no per-person breakdown).</p>`
  }

  let subLaborHtml = '<h2>Sub Labor</h2>'
  if (subLaborJobs.length > 0) {
    subLaborHtml += '<ul style="margin:0.35rem 0;padding-left:1.25rem">'
    for (const lj of subLaborJobs) {
      const c = laborJobSubCost(lj, mileageCost, timePerMile)
      subLaborHtml += `<li>${escapeHtml(lj.assigned_to_name ?? 'Contractor')}${lj.job_date ? ` · ${escapeHtml(lj.job_date)}` : ''}: $${formatCurrency(c)}</li>`
    }
    subLaborHtml += '</ul>'
  } else {
    subLaborHtml += '<p class="muted">No sub labor for this HCP.</p>'
  }

  let partsHtml = '<h2>Parts Cost</h2>'
  if (jobSummaryPartsCostIsZero(partsFromTally)) {
    partsHtml += `<p><strong>Parts from Tally</strong> $${formatCurrency(partsFromTally)}</p>`
  } else {
    partsHtml += `<h3 style="font-size:1rem">Parts from Tally — $${formatCurrency(partsFromTally)}</h3>`
    if (tallyPartsForJob.length > 0) {
      const tr = tallyPartsForJob
        .map((r) => {
          const lineCost =
            r.part_id == null
              ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
              : Number(r.price_at_time ?? 0) * Number(r.quantity)
          const label =
            r.part_id == null
              ? r.fixture_name || 'Fixture'
              : [r.part_name, r.fixture_name].filter(Boolean).join(' · ') || 'Part'
          return `<tr><td>${escapeHtml(label)}</td><td style="text-align:right">${r.quantity}</td><td style="text-align:right">$${formatCurrency(lineCost)}</td></tr>`
        })
        .join('')
      partsHtml += `<table><thead><tr><th>Fixture / Part</th><th style="text-align:right">Qty</th><th style="text-align:right">Line cost</th></tr></thead><tbody>${tr}</tbody></table>`
    } else {
      partsHtml += `<p class="muted">${partsFromTally > 0 ? 'Total reflects tally data; no line rows in view.' : 'No tally parts.'}</p>`
    }
  }
  if (jobSummaryPartsCostIsZero(billedMaterialsSum)) {
    partsHtml += `<p><strong>Other job charges</strong> $${formatCurrency(billedMaterialsSum)}</p>`
  } else {
    partsHtml += `<h3 style="font-size:1rem">Other job charges — $${formatCurrency(billedMaterialsSum)}</h3>`
    const matRows = [...(job.materials ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
    if (matRows.length > 0) {
      const mr = matRows
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.description?.trim() || '—')}</td><td style="text-align:right">$${formatCurrency(Number(m.amount ?? 0))}</td></tr>`,
        )
        .join('')
      partsHtml += `<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${mr}</tbody></table>`
    } else {
      partsHtml += `<p class="muted">${billedMaterialsSum > 0 ? 'No line items on file.' : 'No other job charges.'}</p>`
    }
  }
  if (jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) {
    partsHtml += `<p><strong>Invoices from supply houses</strong> $${formatCurrency(invoicesFromSupplyHouses)}</p>
<p class="muted">No allocated supply house invoices.</p>`
  } else {
    partsHtml += `<h3 style="font-size:1rem">Invoices from supply houses — $${formatCurrency(invoicesFromSupplyHouses)}</h3>${invoiceNote}`
    if (invoiceRows.length > 0) {
      const ir = invoiceRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.supply_house_name || '—')}</td><td>${escapeHtml(row.invoice_number)}</td><td>${escapeHtml(formatJobSummaryInvoiceDate(row.invoice_date))}</td><td style="text-align:right">$${formatCurrency(row.allocated_amount)}</td></tr>`,
        )
        .join('')
      partsHtml += `<table><thead><tr><th>Supply house</th><th>Invoice</th><th>Date</th><th style="text-align:right">Allocated</th></tr></thead><tbody>${ir}</tbody></table>`
    } else {
      partsHtml += `<p class="muted">${invoicesFromSupplyHouses > 0 ? 'No invoice allocation lines returned.' : 'No allocated supply house invoices.'}</p>`
    }
  }
  if (jobSummaryPartsCostIsZero(cardCharges)) {
    partsHtml += `<p><strong>Card charges</strong> $${formatCurrency(cardCharges)}</p>`
  } else {
    partsHtml += `<h3 style="font-size:1rem">Card charges — $${formatCurrency(cardCharges)}</h3>${mercuryNote}`
    if (mRows.length > 0) {
      const cr = mRows
        .map((row) => {
          const tx = row.mercury_transactions
          const posted = tx?.posted_at ? formatJobSummaryMercuryPostedAt(tx.posted_at) : '—'
          const allocAbs = Math.abs(Number(row.amount ?? 0))
          const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
          const debitCardDisplay =
            debitCardId != null
              ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId)
              : '—'
          const note = [row.note, tx?.note, tx?.external_memo].filter(Boolean).join(' · ') || '—'
          return `<tr><td>${escapeHtml(posted)}</td><td>${escapeHtml(tx?.counterparty_name ?? '—')}</td><td>${escapeHtml(row.attributionDisplayName ?? '—')}</td><td>${escapeHtml(debitCardDisplay)}</td><td style="text-align:right">$${formatCurrency(allocAbs)}</td><td>${escapeHtml(note)}</td></tr>`
        })
        .join('')
      partsHtml += `<table><thead><tr><th>Posted</th><th>Counterparty</th><th>User</th><th>Debit Card</th><th style="text-align:right">Allocated</th><th>Note</th></tr></thead><tbody>${cr}</tbody></table>`
    } else {
      partsHtml += `<p class="muted">${cardCharges > 0 ? 'No card allocation rows returned.' : 'No Mercury card allocations.'}</p>`
    }
  }

  if (!jobSummaryPartsCostIsZero(partsFromTally) || !jobSummaryPartsCostIsZero(cardCharges)) {
    if (
      ppRowsPrint.length > 0 ||
      !jobSummaryPartsCostIsZero(ppFooterPrint.partsFromTally) ||
      !jobSummaryPartsCostIsZero(ppFooterPrint.cardCharges)
    ) {
      partsHtml += `<h3 style="font-size:1rem">Cost by person (tally &amp; card)</h3>`
      partsHtml +=
        '<p class="muted" style="font-size:0.85rem">Other job charges and supply house invoices are job-level only (not split by person).</p>'
      const ppBody = ppRowsPrint
        .map((row) => {
          const rt = row.partsFromTally + row.cardCharges
          const tCell = jobSummaryPartsCostIsZero(row.partsFromTally) ? '—' : `$${formatCurrency(row.partsFromTally)}`
          const cCell = jobSummaryPartsCostIsZero(row.cardCharges) ? '—' : `$${formatCurrency(row.cardCharges)}`
          const rtCell = jobSummaryPartsCostIsZero(rt) ? '—' : `$${formatCurrency(rt)}`
          return `<tr><td>${escapeHtml(row.displayName)}</td><td style="text-align:right">${tCell}</td><td style="text-align:right">${cCell}</td><td style="text-align:right">${rtCell}</td></tr>`
        })
        .join('')
      const footRt = ppFooterPrint.partsFromTally + ppFooterPrint.cardCharges
      partsHtml += `<table><thead><tr><th>Person</th><th style="text-align:right">Parts from Tally</th><th style="text-align:right">Card charges</th><th style="text-align:right">Row total</th></tr></thead><tbody>${ppBody}<tr style="font-weight:600"><td>${escapeHtml(ppFooterPrint.displayName)}</td><td style="text-align:right">$${formatCurrency(ppFooterPrint.partsFromTally)}</td><td style="text-align:right">$${formatCurrency(ppFooterPrint.cardCharges)}</td><td style="text-align:right">$${formatCurrency(footRt)}</td></tr></tbody></table>`
      if (billedMaterialsSum > 0 || invoicesFromSupplyHouses > 0) {
        partsHtml += `<p class="muted" style="font-size:0.85rem">Job-level (not in table above): other job charges $${formatCurrency(billedMaterialsSum)} · supply invoices $${formatCurrency(invoicesFromSupplyHouses)}</p>`
      }
      if (!ppSumsOkPrint) {
        partsHtml +=
          '<p class="muted" style="color:#b45309;font-size:0.85rem">Row totals may not match job-level parts totals; check attributions and line items.</p>'
      }
    }
  }

  const totalsHtml = `<h2 class="print-section">Total bill</h2>
<p><strong>Revenue (billing):</strong> ${totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}</p>
<p><strong>Revenue before overhead:</strong> $${formatCurrency(profit)}</p>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(headerTitle)} — Cost breakdown</title><style>
body { font-family: sans-serif; margin: 1in; font-size: 0.875rem; }
h1 { font-size: 1.2rem; margin-bottom: 0.25rem; }
h2 { font-size: 1.05rem; margin: 1rem 0 0.35rem; }
.print-section { margin-top: 1.1rem; }
.print-key-table { max-width: 100%; }
.print-note { font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
.muted { color: #6b7280; margin: 0.35rem 0; }
table { width: 100%; border-collapse: collapse; margin: 0.35rem 0 0.75rem; font-size: 0.8125rem; }
th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
th { background: #f5f5f5; }
table.print-key-table th, table.print-key-table td { text-align: right; }
@media print { body { margin: 0.5in; } }
</style></head><body>
<h1>${escapeHtml(headerTitle)}</h1>
<p class="muted" style="margin-top:0">Cost breakdown · ${escapeHtml(generated)}</p>
${summaryTableHtml}
${personSummaryHtml}
${teamLaborHtml}
${subLaborHtml}
${partsHtml}
${totalsHtml}
</body></html>`
}
