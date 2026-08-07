/**
 * Weekly Money Movement view kernel (v2.1443 — docs/WEEKLY_MONEY_PLAN.md Phase 2).
 *
 * Pure shaping of the `get_weekly_money_movement_payload` RPC result (the one
 * source of truth — all money math lives server-side, in teamLabor.ts parity)
 * into the modal's view model: per-job rows with value created (Δ% × job
 * total), Earned vs Cash nets, made/lost bucketing, data-quality flags, KPI
 * totals, and the printable HTML document. No fetching here.
 */

export type WeeklyMoneyPayloadJob = {
  job_id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  revenue: number | null
  labor_hours: number
  labor_cost: number
  sub_cost: number
  mercury_cost: number
  supply_cost: number
  tally_cost: number
  other_cost: number
  payments_in: number
  pct_start: number | null
  pct_end: number | null
  /** Source of the pct_end event: 'seed' = baseline anchor, not real movement. */
  pct_end_source?: string | null
}

export type WeeklyMoneyPayloadOverhead = {
  office_labor_hours: number
  office_labor_cost: number
  office_job_charges: number
  bid_labor_hours: number
  bid_labor_cost: number
}

export type WeeklyMoneyPayload = {
  week_monday: string
  week_end: string
  office_job_id: string | null
  jobs: WeeklyMoneyPayloadJob[]
  overhead: WeeklyMoneyPayloadOverhead
}

export type WeeklyMoneyLens = 'earned' | 'cash'

export type WeeklyMoneyJobRow = {
  jobId: string
  /** "523 · Mission Hills" — effective number (HCP wins over Click) + name. */
  display: string
  address: string
  revenue: number | null
  outLabor: number
  outSubs: number
  outMaterials: number
  moneyOut: number
  moneyIn: number
  pctStart: number | null
  pctEnd: number | null
  /** end − start (start treated as 0 when only the end exists); null = no signal. */
  pctDelta: number | null
  /** Δ% × revenue; null when there is no pct signal or no job total. */
  valueCreated: number | null
  /** valueCreated − moneyOut; null when valueCreated is null. */
  earnedNet: number | null
  /** moneyIn − moneyOut (always computable). */
  cashNet: number
  flagSpendNoProgress: boolean
  flagNoJobTotal: boolean
  flagNoPctSignal: boolean
}

export type WeeklyMoneyView = {
  weekMonday: string
  weekEnd: string
  rows: WeeklyMoneyJobRow[]
  /** Rows with a positive net under the given lens, sorted best-first. */
  made: WeeklyMoneyJobRow[]
  /** Rows with a zero/negative/unknown net under the lens, sorted worst-first (unknown last). */
  lost: WeeklyMoneyJobRow[]
  kpis: {
    moneyOut: number
    moneyIn: number
    netCash: number
    valueCreated: number
    earnedNet: number
  }
  overhead: WeeklyMoneyPayloadOverhead
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function weeklyMoneyJobDisplay(j: Pick<WeeklyMoneyPayloadJob, 'hcp_number' | 'click_number' | 'job_name'>): string {
  const hcp = (j.hcp_number ?? '').trim()
  const click = (j.click_number ?? '').trim()
  const numLabel = hcp !== '' ? hcp : click
  const name = (j.job_name ?? '').trim() || 'Unnamed job'
  return numLabel !== '' ? `${numLabel} · ${name}` : name
}

export function buildWeeklyMoneyRow(j: WeeklyMoneyPayloadJob): WeeklyMoneyJobRow {
  const outLabor = num(j.labor_cost)
  const outSubs = num(j.sub_cost)
  const outMaterials = num(j.mercury_cost) + num(j.supply_cost) + num(j.tally_cost) + num(j.other_cost)
  const moneyOut = outLabor + outSubs + outMaterials
  const moneyIn = num(j.payments_in)
  const revenue = j.revenue != null && Number.isFinite(Number(j.revenue)) && Number(j.revenue) > 0 ? Number(j.revenue) : null
  const pctStart = j.pct_start ?? null
  const pctEnd = j.pct_end ?? null
  // A job whose first-ever % landed this week counts from 0 — but a SEED
  // baseline row is a standing value, not movement: with no start-of-week
  // anchor and a seed-sourced end, there is no signal (bootstrap week rule).
  const endIsSeed = (j.pct_end_source ?? null) === 'seed'
  const pctDelta = pctEnd != null && (pctStart != null || !endIsSeed) ? pctEnd - (pctStart ?? 0) : null
  const valueCreated = pctDelta != null && revenue != null ? (pctDelta / 100) * revenue : null
  const earnedNet = valueCreated != null ? valueCreated - moneyOut : null
  return {
    jobId: j.job_id,
    display: weeklyMoneyJobDisplay(j),
    address: (j.job_address ?? '').trim(),
    revenue,
    outLabor,
    outSubs,
    outMaterials,
    moneyOut,
    moneyIn,
    pctStart,
    pctEnd,
    pctDelta,
    valueCreated,
    earnedNet,
    cashNet: moneyIn - moneyOut,
    flagSpendNoProgress: moneyOut > 0 && pctDelta === 0,
    flagNoJobTotal: moneyOut > 0 && revenue == null,
    flagNoPctSignal: moneyOut > 0 && pctDelta == null,
  }
}

export function weeklyMoneyNetForLens(row: WeeklyMoneyJobRow, lens: WeeklyMoneyLens): number | null {
  return lens === 'cash' ? row.cashNet : row.earnedNet
}

export function buildWeeklyMoneyView(payload: WeeklyMoneyPayload, lens: WeeklyMoneyLens): WeeklyMoneyView {
  const overhead: WeeklyMoneyPayloadOverhead = {
    office_labor_hours: num(payload.overhead?.office_labor_hours),
    office_labor_cost: num(payload.overhead?.office_labor_cost),
    office_job_charges: num(payload.overhead?.office_job_charges),
    bid_labor_hours: num(payload.overhead?.bid_labor_hours),
    bid_labor_cost: num(payload.overhead?.bid_labor_cost),
  }
  const rows = (payload.jobs ?? []).map(buildWeeklyMoneyRow).filter((r) => r.moneyOut > 0 || r.moneyIn > 0)
  const made: WeeklyMoneyJobRow[] = []
  const lost: WeeklyMoneyJobRow[] = []
  for (const r of rows) {
    const net = weeklyMoneyNetForLens(r, lens)
    if (net != null && net > 0) made.push(r)
    else lost.push(r)
  }
  made.sort((a, b) => (weeklyMoneyNetForLens(b, lens) ?? 0) - (weeklyMoneyNetForLens(a, lens) ?? 0))
  lost.sort((a, b) => {
    const na = weeklyMoneyNetForLens(a, lens)
    const nb = weeklyMoneyNetForLens(b, lens)
    if (na == null && nb == null) return a.display.localeCompare(b.display)
    if (na == null) return 1 // unknown nets sink to the bottom
    if (nb == null) return -1
    return na - nb
  })
  const jobsOut = rows.reduce((s, r) => s + r.moneyOut, 0)
  const overheadOut = overhead.office_labor_cost + overhead.office_job_charges + overhead.bid_labor_cost
  const moneyOut = jobsOut + overheadOut
  const moneyIn = rows.reduce((s, r) => s + r.moneyIn, 0)
  const valueCreated = rows.reduce((s, r) => s + (r.valueCreated ?? 0), 0)
  return {
    weekMonday: payload.week_monday,
    weekEnd: payload.week_end,
    rows,
    made,
    lost,
    kpis: {
      moneyOut,
      moneyIn,
      netCash: moneyIn - moneyOut,
      valueCreated,
      earnedNet: valueCreated - moneyOut,
    },
    overhead,
  }
}

const money = (n: number): string =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatWeeklyMoneySigned = (n: number): string => (n < 0 ? `−${money(n)}` : `+${money(n)}`)
export const formatWeeklyMoneyPlain = (n: number): string => money(n)

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Printable document — same openHtmlPrintWindow flow as the Weekly movement report. */
export function buildWeeklyMoneyReportHtml(view: WeeklyMoneyView, weekLabel: string, lens: WeeklyMoneyLens): string {
  const section = (title: string, rows: WeeklyMoneyJobRow[]): string => {
    if (rows.length === 0) return ''
    const body = rows
      .map((r) => {
        const net = weeklyMoneyNetForLens(r, lens)
        const pct =
          r.pctDelta != null
            ? `${r.pctStart ?? 0}% → ${r.pctEnd}%`
            : r.flagNoPctSignal
              ? 'no report'
              : '—'
        return `<tr>
          <td>${esc(r.display)}<div class="addr">${esc(r.address)}</div></td>
          <td class="r">${esc(pct)}</td>
          <td class="r">${r.valueCreated != null ? money(r.valueCreated) : '—'}</td>
          <td class="r">${money(r.moneyOut)}</td>
          <td class="r">${r.moneyIn > 0 ? money(r.moneyIn) : '—'}</td>
          <td class="r">${net != null ? formatWeeklyMoneySigned(net) : '?'}</td>
        </tr>`
      })
      .join('')
    return `<h2>${esc(title)}</h2>
      <table><thead><tr><th>Job</th><th class="r">% done</th><th class="r">Value created</th><th class="r">Money out</th><th class="r">Money in</th><th class="r">Net</th></tr></thead>
      <tbody>${body}</tbody></table>`
  }
  const k = view.kpis
  const o = view.overhead
  return `<!doctype html><html><head><meta charset="utf-8"><title>Weekly money movement — ${esc(weekLabel)}</title>
  <style>
    body { font: 13px/1.45 -apple-system, "Segoe UI", sans-serif; color: #1a202c; margin: 24px; }
    h1 { font-size: 19px; margin: 0 0 2px; } .sub { color: #64748b; margin: 0 0 14px; }
    h2 { font-size: 14px; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 3px 8px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; } .addr { color: #94a3b8; font-size: 11px; }
    .kpis { margin: 0 0 6px; } .kpis b { margin-right: 14px; }
  </style></head><body>
  <h1>Weekly money movement</h1>
  <p class="sub">${esc(weekLabel)} · ${lens === 'earned' ? 'Earned lens (value created − money out)' : 'Cash lens (in − out)'}</p>
  <p class="kpis"><b>Out ${money(k.moneyOut)}</b><b>In ${money(k.moneyIn)}</b><b>Net cash ${formatWeeklyMoneySigned(k.netCash)}</b><b>Value created ${money(k.valueCreated)}</b><b>Earned net ${formatWeeklyMoneySigned(k.earnedNet)}</b></p>
  ${section('Made money this week', view.made)}
  ${section('Lost money this week', view.lost)}
  <h2>Not on jobs</h2>
  <p>Office + bid labor ${money(o.office_labor_cost + o.bid_labor_cost)} (${(o.office_labor_hours + o.bid_labor_hours).toFixed(1)} h) · Office job charges ${money(o.office_job_charges)}</p>
  </body></html>`
}
