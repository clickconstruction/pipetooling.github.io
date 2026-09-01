/**
 * Weekly Money Movement email renderer (v2.1448, weekly_money stream).
 *
 * Ports the row math of src/lib/jobs/weeklyMoneyMovement.ts (buildWeeklyMoneyRow:
 * material bucketing, Δ% with the seed-bootstrap rule, earned/cash nets) for the
 * Deno dispatcher. Keep the two in sync — the payload RPC is the shared source
 * of truth, this file only SHAPES it, exactly like the client kernel.
 */

export type WeeklyMoneyPayloadJob = {
  job_id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  revenue: number | null
  labor_cost: number
  sub_cost: number
  mercury_cost: number
  supply_cost: number
  tally_cost: number
  other_cost: number
  payments_in: number
  pct_start: number | null
  pct_end: number | null
  pct_end_source?: string | null
}

export type WeeklyMoneyPayload = {
  week_monday: string
  week_end: string
  jobs: WeeklyMoneyPayloadJob[]
  overhead: {
    office_labor_hours: number
    office_labor_cost: number
    office_job_charges: number
    bid_labor_hours: number
    bid_labor_cost: number
  }
}

type Row = {
  display: string
  address: string
  moneyOut: number
  moneyIn: number
  pctLabel: string
  valueCreated: number | null
  earnedNet: number | null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function buildRow(j: WeeklyMoneyPayloadJob): Row {
  const moneyOut = num(j.labor_cost) + num(j.sub_cost) + num(j.mercury_cost) + num(j.supply_cost) + num(j.tally_cost) + num(j.other_cost)
  const moneyIn = num(j.payments_in)
  const revenue = j.revenue != null && Number(j.revenue) > 0 ? Number(j.revenue) : null
  const endIsSeed = (j.pct_end_source ?? null) === 'seed'
  const pctDelta = j.pct_end != null && (j.pct_start != null || !endIsSeed) ? j.pct_end - (j.pct_start ?? 0) : null
  const valueCreated = pctDelta != null && revenue != null ? (pctDelta / 100) * revenue : null
  const hcp = (j.hcp_number ?? '').trim()
  const click = (j.click_number ?? '').trim()
  const numLabel = hcp !== '' ? hcp : click
  const name = (j.job_name ?? '').trim() || 'Unnamed job'
  return {
    display: numLabel !== '' ? `${numLabel} · ${name}` : name,
    address: (j.job_address ?? '').trim(),
    moneyOut,
    moneyIn,
    pctLabel: pctDelta != null ? `${j.pct_start ?? 0}% → ${j.pct_end}%` : moneyOut > 0 ? 'no report' : '—',
    valueCreated,
    earnedNet: valueCreated != null ? valueCreated - moneyOut : null,
  }
}

const money = (n: number): string =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number): string => (n < 0 ? `−${money(n)}` : `+${money(n)}`)
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function weekLabelFromMonday(mondayYmd: string): string {
  const start = new Date(`${mondayYmd}T12:00:00Z`)
  const end = new Date(start.getTime() + 6 * 86_400_000)
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('en-US', { timeZone: 'UTC', ...(withMonth ? { month: 'short' } : {}), day: 'numeric' })
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`
}

export function weeklyMoneySubject(weekLabel: string): string {
  return `Weekly money movement — ${weekLabel}`
}

function shaped(payload: WeeklyMoneyPayload) {
  const rows = (payload.jobs ?? []).map(buildRow).filter((r) => r.moneyOut > 0 || r.moneyIn > 0)
  const made = rows.filter((r) => r.earnedNet != null && r.earnedNet > 0).sort((a, b) => (b.earnedNet ?? 0) - (a.earnedNet ?? 0))
  const lost = rows
    .filter((r) => !(r.earnedNet != null && r.earnedNet > 0))
    .sort((a, b) => {
      if (a.earnedNet == null && b.earnedNet == null) return a.display.localeCompare(b.display)
      if (a.earnedNet == null) return 1
      if (b.earnedNet == null) return -1
      return a.earnedNet - b.earnedNet
    })
  const o = payload.overhead
  const overheadOut = num(o?.office_labor_cost) + num(o?.office_job_charges) + num(o?.bid_labor_cost)
  const moneyOut = rows.reduce((s, r) => s + r.moneyOut, 0) + overheadOut
  const moneyIn = rows.reduce((s, r) => s + r.moneyIn, 0)
  const valueCreated = rows.reduce((s, r) => s + (r.valueCreated ?? 0), 0)
  return { rows, made, lost, moneyOut, moneyIn, valueCreated, earnedNet: valueCreated - moneyOut, overheadOut }
}

export function renderWeeklyMoneyHtml(payload: WeeklyMoneyPayload, weekLabel: string, requesterName?: string): string {
  const v = shaped(payload)
  const table = (title: string, color: string, rows: Row[]): string => {
    if (rows.length === 0) return ''
    const body = rows
      .map(
        (r) => `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${esc(r.display)}<div style="color:#94a3b8;font-size:11px">${esc(r.address)}</div></td>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap">${esc(r.pctLabel)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${r.valueCreated != null ? money(r.valueCreated) : '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c">${money(r.moneyOut)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#15803d">${r.moneyIn > 0 ? money(r.moneyIn) : '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${r.earnedNet != null ? signed(r.earnedNet) : '?'}</td>
        </tr>`,
      )
      .join('')
    return `<h2 style="font-size:15px;margin:18px 0 6px;color:${color}">${esc(title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">Job</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">% done</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">Value created</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">Money out</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">Money in</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;padding:3px 8px;border-bottom:1px solid #cbd5e1">Net (earned)</th>
      </tr></thead><tbody>${body}</tbody></table>`
  }
  return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;color:#1a202c;max-width:720px;margin:0 auto">
    <h1 style="font-size:19px;margin:0 0 2px">Weekly money movement</h1>
    <p style="color:#64748b;margin:0 0 12px">${esc(weekLabel)} · Earned lens${requesterName ? ` · scheduled by ${esc(requesterName)}` : ''}</p>
    <p style="margin:0 0 8px;font-size:13.5px">
      <b>Out ${money(v.moneyOut)}</b> &nbsp; <b>In ${money(v.moneyIn)}</b> &nbsp; <b>Net cash ${signed(v.moneyIn - v.moneyOut)}</b> &nbsp;
      <b>Value created ${money(v.valueCreated)}</b> &nbsp; <b>Earned net ${signed(v.earnedNet)}</b>
    </p>
    ${v.rows.length === 0 ? '<p style="color:#64748b">No money movement this week.</p>' : ''}
    ${table('Made money this week', '#15803d', v.made)}
    ${table('Lost money this week', '#b91c1c', v.lost)}
    <p style="font-size:12.5px;color:#475569;margin:14px 0 0"><b>Not on jobs:</b> office + bid labor ${money(num(payload.overhead?.office_labor_cost) + num(payload.overhead?.bid_labor_cost))} · office job charges ${money(num(payload.overhead?.office_job_charges))}</p>
    <p style="font-size:11.5px;color:#94a3b8;margin:14px 0 0">Rebuilt fresh at send time from live data. Open ClickTooling → Jobs → Pipeline → Weekly money movement for lenses, printing, and the live week.</p>
  </div>`
}

export function renderWeeklyMoneyText(payload: WeeklyMoneyPayload, weekLabel: string): string {
  const v = shaped(payload)
  const line = (r: Row) =>
    `  ${r.display} — ${r.pctLabel}; out ${money(r.moneyOut)}; in ${r.moneyIn > 0 ? money(r.moneyIn) : '—'}; net ${r.earnedNet != null ? signed(r.earnedNet) : '?'}`
  const parts = [
    `Weekly money movement — ${weekLabel}`,
    `Out ${money(v.moneyOut)} | In ${money(v.moneyIn)} | Net cash ${signed(v.moneyIn - v.moneyOut)} | Value created ${money(v.valueCreated)} | Earned net ${signed(v.earnedNet)}`,
    '',
  ]
  if (v.made.length > 0) parts.push('Made money this week:', ...v.made.map(line), '')
  if (v.lost.length > 0) parts.push('Lost money this week:', ...v.lost.map(line), '')
  parts.push(
    `Not on jobs: office+bid labor ${money(num(payload.overhead?.office_labor_cost) + num(payload.overhead?.bid_labor_cost))}; office job charges ${money(num(payload.overhead?.office_job_charges))}`,
  )
  return parts.join('\n')
}
