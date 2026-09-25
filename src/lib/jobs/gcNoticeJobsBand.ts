/**
 * Put a GC on notice — the jobs, by stage (v2.3819, punch list #43).
 *
 * The owner, 2026-09-25: the run window should show all of a GC's jobs with
 * their line items and progress "so we know what jobs of theirs are at what
 * stage and we can dig in to mark some of them more correctly." This kernel
 * folds each job's row and its work (the line items, the bills, the payments —
 * the three tables a Pipeline row already carries) into one band row: the
 * stage on record, the lines with the money poured onto them, the four
 * figures, and one or two READINGS — what looks wrong, in the Pipeline's own
 * words, each naming the door that fixes it. Then the rows grouped by stage
 * (or biggest open first, or by property) with a head per group and one head
 * line for the band. Pure; the modal draws and the Job window fixes.
 */

export type GcNoticeBandStage = 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'collections' | 'paid' | 'other'

/** Where a chip or a click lands in the Job window. */
export type GcNoticeBandDoor = 'status' | 'pct' | 'bill' | 'line-items' | 'job'

export type GcNoticeBandReading = {
  key: 'stage' | 'pct' | 'unbilled' | 'quiet'
  /** "Waiting, but 80% done and a bill out" · "set % done" · "$13,860 done, not billed" · "quiet 130 d". */
  label: string
  tone: 'red' | 'amber'
  door: GcNoticeBandDoor
  /** The door's name on the chip: "Status ▾" · "% done" · "Bill it" · "Open". */
  doorLabel: string
  /** The hover: why it reads wrong and what the door does. */
  title: string
}

export type GcNoticeBandLineState = 'paid' | 'billed' | 'part' | 'done' | 'todo'

export type GcNoticeBandLine = {
  id: string
  name: string
  price: number
  paid: number
  billed: number
  done: number
  state: GcNoticeBandLineState
  /** A "Job total (migrated)" placeholder — not the work (v2.3778). */
  migrated: boolean
}

export type GcNoticeBandRow = {
  jobId: string
  stage: GcNoticeBandStage
  /** jobs_ledger.status as stored. */
  status: string
  pct: number | null
  lastWorkYmd: string | null
  lines: GcNoticeBandLine[]
  readings: GcNoticeBandReading[]
  total: number
  paid: number
  /** Dollars on sent bills not yet paid. */
  billedUnpaid: number
  /** Work done (total × pct) that is on no bill and not paid, floored at 0; 0 when the percent is unknown. */
  doneNotBilled: number
  /** total − paid, floored at 0. */
  open: number
  /** The property key the by-property order groups on. */
  propertyKey: string
}

export type GcNoticeBandGroup = { key: string; label: string; rows: GcNoticeBandRow[]; open: number; wrong: number }

export type GcNoticeBandOrder = 'stage' | 'open' | 'property'

export type GcNoticeBand = {
  groups: GcNoticeBandGroup[]
  counts: {
    jobs: number
    wrong: number
    /** Jobs per stage on record, in stage order, only the stages present. */
    stages: ReadonlyArray<{ stage: GcNoticeBandStage; label: string; jobs: number }>
    total: number
    /** paid + billedUnpaid — the Job window's Billed tile. */
    billed: number
    billedUnpaid: number
    paid: number
    doneNotBilled: number
    open: number
  }
}

/** One job's work as the hook reads it: the same three tables a Pipeline row carries. */
export type GcNoticeJobWork = {
  fixtures: ReadonlyArray<{ id: string; name: string | null; line_unit_price: number | null; count: number | null; invoice_id: string | null; sequence_order: number | null }>
  invoices: ReadonlyArray<{ id: string; amount: number | null; status: string }>
  payments: ReadonlyArray<{ amount: number | null; invoice_id: string | null }>
}

export type GcNoticeBandJobInput = {
  jobId: string
  status: string | null | undefined
  revenue: number | null | undefined
  paymentsMade: number | null | undefined
  pctComplete: number | null | undefined
  lastWorkYmd: string | null | undefined
  /** The job's address, for the by-property order; '' groups under "no address". */
  address: string | null | undefined
  work: GcNoticeJobWork | null | undefined
}

const STAGE_ORDER: ReadonlyArray<{ stage: GcNoticeBandStage; label: string }> = [
  { stage: 'waiting', label: 'Waiting' },
  { stage: 'working', label: 'Working' },
  { stage: 'ready_to_bill', label: 'Ready to bill' },
  { stage: 'billed', label: 'Billed' },
  { stage: 'collections', label: 'Collections' },
  { stage: 'paid', label: 'Paid' },
  { stage: 'other', label: 'Other' },
]

export function gcNoticeBandStageLabel(stage: GcNoticeBandStage): string {
  return STAGE_ORDER.find((s) => s.stage === stage)?.label ?? 'Other'
}

export function gcNoticeBandStageOf(status: string | null | undefined): GcNoticeBandStage {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'waiting' || s === 'working' || s === 'ready_to_bill' || s === 'billed' || s === 'collections' || s === 'paid') return s
  return 'other'
}

const num = (v: number | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100
const EPS = 0.005

/** Days from `from` to `to` (both 'YYYY-MM-DD'), or null when either does not parse. */
function daysBetween(from: string, to: string): number | null {
  const ms = (ymd: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : NaN
  }
  const d = Math.round((ms(to) - ms(from)) / 86_400_000)
  return Number.isFinite(d) ? d : null
}

/** A job is "quiet" after this many days with no work on a stage that expects it (the phone board's reading, read loosely here). */
export const GC_NOTICE_BAND_QUIET_DAYS = 30

export const GC_NOTICE_BAND_DOOR_LABELS: Readonly<Record<GcNoticeBandDoor, string>> = {
  status: 'Status ▾',
  pct: '% done',
  bill: 'Bill it',
  'line-items': 'Line items',
  job: 'Open',
}

export function propertyKeyOf(address: string | null | undefined): string {
  return (address ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Pour the money onto the lines: a line an invoice names takes that invoice's
 * money first (its payments as paid, its unpaid remainder as billed); what is
 * left pours down the lines in order — paid, then billed, then done-not-billed.
 */
export function pourGcNoticeBandLines(work: GcNoticeJobWork | null | undefined, money: { paid: number; billedUnpaid: number; doneNotBilled: number }): GcNoticeBandLine[] {
  if (!work || work.fixtures.length === 0) return []
  const fixtures = [...work.fixtures].sort((a, b) => num(a.sequence_order) - num(b.sequence_order))
  const paidByInvoice = new Map<string, number>()
  for (const p of work.payments) if (p.invoice_id) paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + num(p.amount))
  const invoiceById = new Map(work.invoices.map((i) => [i.id, i]))
  const lines = fixtures.map((f) => {
    const price = Math.max(0, num(f.line_unit_price) * (num(f.count) || 1))
    return { id: f.id, name: (f.name ?? '').trim(), price, paid: 0, billed: 0, done: 0, migrated: /\(migrated\)/i.test(f.name ?? '') }
  })
  let paidPool = Math.max(0, money.paid)
  let billedPool = Math.max(0, money.billedUnpaid)
  let donePool = Math.max(0, money.doneNotBilled)
  // 1. The invoice's own money onto the line it names.
  const taken = new Set<string>()
  fixtures.forEach((f, i) => {
    const inv = f.invoice_id ? invoiceById.get(f.invoice_id) : undefined
    if (!inv || taken.has(inv.id)) return
    taken.add(inv.id)
    const line = lines[i]!
    const applied = paidByInvoice.get(inv.id) ?? 0
    const tp = Math.min(line.price, applied, paidPool)
    line.paid += tp
    paidPool -= tp
    if (inv.status === 'billed') {
      const remainder = Math.max(0, num(inv.amount) - applied)
      const tb = Math.min(line.price - line.paid, remainder, billedPool)
      line.billed += tb
      billedPool -= tb
    }
  })
  // 2. The rest, in order.
  for (const line of lines) {
    let room = line.price - line.paid - line.billed
    const tp = Math.min(room, paidPool)
    line.paid += tp
    paidPool -= tp
    room -= tp
    const tb = Math.min(room, billedPool)
    line.billed += tb
    billedPool -= tb
    room -= tb
    const td = Math.min(room, donePool)
    line.done += td
    donePool -= td
  }
  return lines.map((l) => {
    const state: GcNoticeBandLineState =
      l.price <= EPS ? 'todo' : l.paid >= l.price - EPS ? 'paid' : l.billed >= l.price - EPS ? 'billed' : l.paid > EPS || l.billed > EPS ? 'part' : l.done > EPS ? 'done' : 'todo'
    return { ...l, paid: round2(l.paid), billed: round2(l.billed), done: round2(l.done), state }
  })
}

/** Dollars on sent bills not yet paid: each billed invoice's amount less the payments applied to it, floored. */
export function gcNoticeBandBilledUnpaid(work: GcNoticeJobWork | null | undefined): number {
  if (!work) return 0
  let s = 0
  for (const inv of work.invoices) {
    if (inv.status !== 'billed') continue
    const applied = work.payments.filter((p) => p.invoice_id === inv.id).reduce((a, p) => a + num(p.amount), 0)
    s += Math.max(0, num(inv.amount) - applied)
  }
  return round2(s)
}

function moneyWords(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** What looks wrong on one job, the stage reading first, then the facts. */
export function gcNoticeBandReadings(input: { stage: GcNoticeBandStage; pct: number | null; paid: number; billedUnpaid: number; doneNotBilled: number; lastWorkYmd: string | null; todayYmd: string }): GcNoticeBandReading[] {
  const { stage, pct, paid, billedUnpaid, doneNotBilled, lastWorkYmd, todayYmd } = input
  const out: GcNoticeBandReading[] = []
  if (stage === 'paid') return out
  if (stage === 'waiting' && ((pct ?? 0) > 0 || billedUnpaid > EPS || paid > EPS)) {
    const why = [(pct ?? 0) > 0 ? `${Math.round(pct!)}% done` : null, billedUnpaid > EPS ? 'a bill out' : null, paid > EPS && billedUnpaid <= EPS ? 'a draw paid' : null].filter(Boolean).join(' and ')
    out.push({ key: 'stage', label: `Waiting, but ${why}`, tone: 'red', door: 'status', doorLabel: GC_NOTICE_BAND_DOOR_LABELS.status, title: `The record says Waiting; ${why} says the crew has been on it. Opens the job on its status.` })
  } else if (stage === 'working' && (pct ?? 0) >= 100 && doneNotBilled <= EPS && billedUnpaid > EPS) {
    out.push({ key: 'stage', label: 'Working, but 100% done and billed', tone: 'red', door: 'status', doorLabel: GC_NOTICE_BAND_DOOR_LABELS.status, title: 'The record says Working; the work is done and on a bill. Opens the job on its status.' })
  }
  if (pct == null) {
    const billed = billedUnpaid > EPS || stage === 'billed' || stage === 'collections'
    out.push({ key: 'pct', label: 'set % done', tone: billed ? 'red' : 'amber', door: 'pct', doorLabel: GC_NOTICE_BAND_DOOR_LABELS.pct, title: billed ? 'A bill went out and no percent is recorded — the notice claims against a record that says nothing about the work. Opens the job on % done.' : 'No percent is recorded. Opens the job on % done.' })
  }
  if (doneNotBilled > 0.5) {
    out.push({ key: 'unbilled', label: `${moneyWords(doneNotBilled)} done, not billed`, tone: 'amber', door: 'bill', doorLabel: GC_NOTICE_BAND_DOOR_LABELS.bill, title: 'Finished work on no bill yet: the notice claims the contract balance for it. Opens the job on its bills.' })
  }
  if ((stage === 'working' || stage === 'waiting') && lastWorkYmd) {
    const d = daysBetween(lastWorkYmd, todayYmd)
    if (d != null && d >= GC_NOTICE_BAND_QUIET_DAYS) out.push({ key: 'quiet', label: `quiet ${d} d`, tone: 'amber', door: 'job', doorLabel: GC_NOTICE_BAND_DOOR_LABELS.job, title: `Nobody has worked it in ${d} days. Opens the job.` })
  }
  return out
}

export function buildGcNoticeBandRow(job: GcNoticeBandJobInput, todayYmd: string): GcNoticeBandRow {
  const stage = gcNoticeBandStageOf(job.status)
  const total = Math.max(0, num(job.revenue))
  const paidFromPayments = job.work ? job.work.payments.reduce((s, p) => s + num(p.amount), 0) : 0
  const paid = Math.max(0, job.paymentsMade != null ? num(job.paymentsMade) : paidFromPayments)
  const billedUnpaid = Math.min(Math.max(0, total - paid), gcNoticeBandBilledUnpaid(job.work))
  const pct = job.pctComplete != null && Number.isFinite(Number(job.pctComplete)) ? Math.min(100, Math.max(0, Number(job.pctComplete))) : null
  const doneNotBilled = pct == null ? 0 : round2(Math.max(0, (total * pct) / 100 - paid - billedUnpaid))
  const open = round2(Math.max(0, total - paid))
  const lastWorkYmd = job.lastWorkYmd ? job.lastWorkYmd.slice(0, 10) : null
  return {
    jobId: job.jobId,
    stage,
    status: (job.status ?? '').trim(),
    pct,
    lastWorkYmd,
    lines: pourGcNoticeBandLines(job.work, { paid, billedUnpaid, doneNotBilled }),
    readings: gcNoticeBandReadings({ stage, pct, paid, billedUnpaid, doneNotBilled, lastWorkYmd, todayYmd }),
    total,
    paid: round2(paid),
    billedUnpaid: round2(billedUnpaid),
    doneNotBilled,
    open,
    propertyKey: propertyKeyOf(job.address),
  }
}

export function buildGcNoticeBand(jobs: ReadonlyArray<GcNoticeBandJobInput>, todayYmd: string, order: GcNoticeBandOrder = 'stage', addressWords: (jobId: string) => string = () => ''): GcNoticeBand {
  const rows = jobs.map((j) => buildGcNoticeBandRow(j, todayYmd))
  const byOpen = (a: GcNoticeBandRow, b: GcNoticeBandRow) => b.open - a.open || a.jobId.localeCompare(b.jobId)
  const head = (key: string, label: string, list: GcNoticeBandRow[]): GcNoticeBandGroup => ({ key, label, rows: list, open: round2(list.reduce((s, r) => s + r.open, 0)), wrong: list.filter((r) => r.readings.length > 0).length })
  let groups: GcNoticeBandGroup[]
  if (order === 'open') groups = rows.length ? [head('all', 'Every job', [...rows].sort(byOpen))] : []
  else if (order === 'property') {
    const map = new Map<string, GcNoticeBandRow[]>()
    for (const r of [...rows].sort(byOpen)) map.set(r.propertyKey, [...(map.get(r.propertyKey) ?? []), r])
    groups = [...map.entries()]
      .map(([key, list]) => head(key || 'no-address', key ? addressWords(list[0]!.jobId) || key : 'No address on the job', list))
      .sort((a, b) => b.open - a.open || a.label.localeCompare(b.label))
  } else {
    groups = STAGE_ORDER.map((s) => head(s.stage, s.label, rows.filter((r) => r.stage === s.stage).sort(byOpen))).filter((g) => g.rows.length > 0)
  }
  const sum = (pick: (r: GcNoticeBandRow) => number) => round2(rows.reduce((s, r) => s + pick(r), 0))
  const paid = sum((r) => r.paid)
  const billedUnpaid = sum((r) => r.billedUnpaid)
  return {
    groups,
    counts: {
      jobs: rows.length,
      wrong: rows.filter((r) => r.readings.length > 0).length,
      stages: STAGE_ORDER.map((s) => ({ stage: s.stage, label: s.label, jobs: rows.filter((r) => r.stage === s.stage).length })).filter((s) => s.jobs > 0),
      total: sum((r) => r.total),
      billed: round2(paid + billedUnpaid),
      billedUnpaid,
      paid,
      doneNotBilled: sum((r) => r.doneNotBilled),
      open: sum((r) => r.open),
    },
  }
}

export const GC_NOTICE_BAND_ORDERS: ReadonlyArray<{ key: GcNoticeBandOrder; label: string }> = [
  { key: 'stage', label: 'by stage' },
  { key: 'open', label: 'biggest open first' },
  { key: 'property', label: 'by property' },
]

/** "Waiting 4 · Working 1 · Billed 17" for the head line. */
export function gcNoticeBandStageWords(band: GcNoticeBand): string {
  return band.counts.stages.map((s) => `${s.label} ${s.jobs}`).join(' · ')
}
