/**
 * GC mode, the real build, the Building lane's U6b: the trades' money as its rows hold it (`gc_draws` with their
 * lines, `gc_sow_line_reports` and `gc_change_order_trade_sends`, migration 20261010021000; P4a's `gc_back_charges`),
 * read back into each statement of work the board maps (`sowOf`), so the kernels in ./building.ts and ./buildingPay.ts
 * read them unchanged. The plan: to-dos/gc-mode/mockups/building-u6.md on branch spike/gc-mode. A line's kernel id is
 * its scope item's, or its own on a change order's line (`gc_sow_line_of`). Neither percent is stored on the line:
 * `pctReported` is the newest report, `pctBilled` the most an approved or paid draw took it to (decision 3).
 */
import type { Database } from '../../types/database'
import { drawMoney, payAppKnown, payApplication } from './building'
import { backChargeOf } from './tradePortalState'
import type { BackCharge, ChangeOrder, Draw, DrawSentBack, GcState, Partner, Sow, SovLine } from './types'

type Tables = Database['public']['Tables']
export type DrawTableRow = Tables['gc_draws']['Row']
export type DrawLineRow = Tables['gc_draw_lines']['Row']
export type LineReportRow = Tables['gc_sow_line_reports']['Row']
export type TradeSendRow = Tables['gc_change_order_trade_sends']['Row']
export type BackChargeRow = Tables['gc_back_charges']['Row']

/** The rows of the trades' money for some projects, as `loadGcDraws` reads them. */
export interface DrawTables {
  /** Each statement of work's id and trade, to find its draws. */
  sows: { id: string; package_id: string }[]
  /** Each line's id, its statement of work, its place, and its scope item (null on a change order's line). */
  sowLines: { id: string; sow_id: string; position: number; scope_item_id: string | null }[]
  draws: DrawTableRow[]
  drawLines: DrawLineRow[]
  reports: LineReportRow[]
  backCharges: BackChargeRow[]
  tradeSends: TradeSendRow[]
}

export const NO_DRAWS: DrawTables = { sows: [], sowLines: [], draws: [], drawLines: [], reports: [], backCharges: [], tradeSends: [] }

const STATUSES = ['requested', 'approved', 'paid'] as const
const WAIVERS = ['conditional', 'unconditional'] as const

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A draw's ${what} reads "${value}", which the app does not know.`)
}

/** A claimed line as the kernels read it: its kernel id, its percent, and stored dollars when there are any. */
function claimOf(sovId: string, toPct: number, stored: number): { sovId: string; toPct: number; stored?: number } {
  return { sovId, toPct, ...(stored > 0 ? { stored } : {}) }
}

/** What an approved-for-less draw keeps of what they asked (`Draw.asked`), its lines by kernel id. */
function askedOf(asked: unknown, keyOf: (lineId: string) => string, placeOf: (lineId: string) => number): Draw['asked'] {
  if (!asked || typeof asked !== 'object' || Array.isArray(asked)) return undefined
  const a = asked as { gross?: unknown; retainage?: unknown; net?: unknown; lines?: unknown; note?: unknown; on?: unknown }
  const lines = Array.isArray(a.lines) ? (a.lines as { line?: unknown; toPct?: unknown; stored?: unknown }[]) : []
  return {
    gross: Number(a.gross),
    retainage: Number(a.retainage),
    net: Number(a.net),
    lines: [...lines]
      .sort((x, y) => placeOf(String(x.line)) - placeOf(String(y.line)))
      .map((l) => claimOf(keyOf(String(l.line)), Number(l.toPct), Number(l.stored ?? 0))),
    note: String(a.note ?? ''),
    on: String(a.on ?? ''),
  }
}

/**
 * A statement of work's money laid over the board's (`sowOf`): each line's reported and billed percent, the draws
 * that stand (each net of the back-charges taken off it, as `takeBackCharge` leaves it), the pay applications sent
 * back, and the back-charges.
 */
export function sowWithDraws(sow: Sow, sowId: string, tables: DrawTables): Sow {
  const lines = tables.sowLines.filter((l) => l.sow_id === sowId)
  const keyById = new Map(lines.map((l) => [l.id, l.scope_item_id ?? l.id]))
  const placeById = new Map(lines.map((l) => [l.id, l.position]))
  const keyOf = (lineId: string) => keyById.get(lineId) ?? lineId
  const placeOf = (lineId: string) => placeById.get(lineId) ?? Number.MAX_SAFE_INTEGER
  const rows = tables.draws.filter((d) => d.sow_id === sowId)
  const claimsOf = (drawId: string) =>
    tables.drawLines
      .filter((l) => l.draw_id === drawId)
      .sort((a, b) => placeOf(a.sow_line_id) - placeOf(b.sow_line_id))
  const charges = tables.backCharges.filter((c) => c.sow_id === sowId)

  const drawOf = (row: DrawTableRow, status: Draw['status']): Draw => {
    const taken = charges.filter((c) => c.taken_draw_id === row.id).map((c) => ({ chargeId: c.id, amount: Number(c.amount) }))
    const asked = askedOf(row.asked, keyOf, placeOf)
    return {
      id: row.id,
      number: row.number,
      requestedOn: row.requested_on,
      gross: Number(row.gross),
      retainage: Number(row.retainage),
      net: Number(row.net) - taken.reduce((s, c) => s + c.amount, 0),
      status,
      waiver: known(row.waiver, WAIVERS, 'waiver'),
      lines: claimsOf(row.id).map((l) => claimOf(keyOf(l.sow_line_id), Number(l.to_pct), Number(l.stored))),
      payApp: { periodTo: row.period_to, address: row.address, license: row.license, signedBy: row.signed_by, signedTitle: row.signed_title, signedOn: row.signed_on },
      ...(row.final ? { final: true } : {}),
      ...(asked ? { asked } : {}),
      ...(row.approved_on ? { approvedOn: row.approved_on } : {}),
      ...(row.paid_on ? { paidOn: row.paid_on } : {}),
      ...(taken.length > 0 ? { backCharges: taken } : {}),
    }
  }

  const draws = rows
    .filter((d) => d.status !== 'sent_back')
    .sort((a, b) => a.number - b.number)
    .map((row) => drawOf(row, known(row.status, STATUSES, 'status')))
  const sentBack: DrawSentBack[] = rows
    .filter((d) => d.status === 'sent_back')
    .sort((a, b) => a.seq - b.seq)
    .map((row) => ({
      // The pay application as it went, waiting on us when we sent it back.
      draw: drawOf(row, 'requested'),
      on: row.sent_back_on ?? '',
      note: row.sent_back_note ?? '',
      lines: claimsOf(row.id)
        .filter((l) => l.we_see !== null)
        .map((l) => ({ sovId: keyOf(l.sow_line_id), weSee: Number(l.we_see) })),
    }))

  // The newest report on each line, and the most an approved or paid draw took it to.
  const newest = new Map<string, LineReportRow>()
  for (const r of tables.reports) {
    if (!keyById.has(r.sow_line_id)) continue
    const was = newest.get(r.sow_line_id)
    if (!was || r.seq > was.seq) newest.set(r.sow_line_id, r)
  }
  const billed = new Map<string, number>()
  for (const d of rows) {
    if (d.final || (d.status !== 'approved' && d.status !== 'paid')) continue
    for (const l of claimsOf(d.id)) billed.set(l.sow_line_id, Math.max(billed.get(l.sow_line_id) ?? 0, Number(l.to_pct)))
  }
  const lineIdByKey = new Map(lines.map((l) => [l.scope_item_id ?? l.id, l.id]))
  const sov: SovLine[] = sow.sov.map((l) => {
    const id = lineIdByKey.get(l.id)
    const report = id ? newest.get(id) : undefined
    return { ...l, pctReported: report ? Number(report.pct) : 0, pctBilled: id ? (billed.get(id) ?? 0) : 0 }
  })

  const backCharges: BackCharge[] = [...charges]
    .sort((a, b) => a.sent_on.localeCompare(b.sent_on) || a.created_at.localeCompare(b.created_at))
    .map((c) => backChargeOf(c as unknown as Record<string, unknown>))
  return {
    ...sow,
    sov,
    draws,
    ...(sentBack.length > 0 ? { sentBack } : {}),
    ...(backCharges.length > 0 ? { backCharges } : {}),
  }
}

/** The board's statements of work with their money laid over them (`boardProjectFromView` maps the rest). */
export function withDraws(state: GcState, tables: DrawTables): GcState {
  if (tables.sows.length === 0) return state
  const sowIdByPackage = new Map(tables.sows.map((s) => [s.package_id, s.id]))
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      packages: project.packages.map((pkg) => {
        const sowId = sowIdByPackage.get(pkg.id)
        return pkg.sow && sowId ? { ...pkg, sow: sowWithDraws(pkg.sow, sowId, tables) } : pkg
      }),
    })),
  }
}

/**
 * Each signed change order's trade side (`ChangeOrder.tradeChange`): sent to its trade, and the line it became once
 * signed. Laid over after `withChangeOrders`, which reads the change orders themselves.
 */
export function withTradeChanges(state: GcState, tables: DrawTables): GcState {
  const sends = new Map(tables.tradeSends.map((t) => [t.change_order_id, t]))
  if (sends.size === 0) return state
  const keyById = new Map(tables.sowLines.map((l) => [l.id, l.scope_item_id ?? l.id]))
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      ...(project.changeOrders
        ? {
            changeOrders: project.changeOrders.map((co): ChangeOrder => {
              const send = sends.get(co.id)
              if (!send) return co
              return {
                ...co,
                tradeChange: {
                  status: send.signed_on ? 'signed' : 'sent',
                  sentOn: send.sent_on,
                  signedOn: send.signed_on,
                  sovLineId: send.sow_line_id ? (keyById.get(send.sow_line_id) ?? send.sow_line_id) : '',
                },
              }
            }),
          }
        : {}),
    })),
  }
}

/** What a draw's row holds beside the kernel's `Draw`: the file it came as, and who of ours recorded it. */
export interface DrawExtra {
  /** The pay application's file and its Drive link, when it came by email. */
  fileName: string | null
  driveUrl: string | null
  /** Who of ours recorded it. Null: the trade's portal. */
  recordedBy: string | null
}

/** Every draw's file and recorder, by its id. */
export function drawExtras(tables: DrawTables): Map<string, DrawExtra> {
  return new Map(tables.draws.map((d) => [d.id, { fileName: d.file_name, driveUrl: d.drive_url, recordedBy: d.recorded_by }]))
}

/** A pay application that came by email, as the window gives it (the trade's own words, typed by the office). */
export interface DrawCameIn {
  packageId: string
  /** Each line's percent done, by the kernels' line id, and the materials stored on it in dollars. */
  lines: { sovId: string; toPct: number; stored: number }[]
  periodTo: string
  address: string
  license: string
  signedBy: string
  signedTitle: string
  fileName: string
  driveUrl: string
}

/**
 * Where the came-in form starts: each line at what they last reported, never below what was billed, nothing stored,
 * and the words of their newest pay application. Before their first, what their company has on file.
 */
export function drawCameInDraft(packageId: string, sow: Sow, partner: Partner): DrawCameIn {
  const newest = [...sow.draws].sort((a, b) => b.number - a.number).find((d) => d.payApp?.signedBy)?.payApp
  const known = payAppKnown(partner)
  return {
    packageId,
    lines: sow.sov.map((l) => ({ sovId: l.id, toPct: Math.max(l.pctReported, l.pctBilled), stored: 0 })),
    periodTo: '',
    address: newest?.address || known.address,
    license: newest?.license || known.license,
    signedBy: newest?.signedBy || known.signedBy,
    signedTitle: newest?.signedTitle ?? '',
    fileName: '',
    driveUrl: '',
  }
}

/** What a pay application that came in asks for, by the kernels' rules (`gc_draw_money` holds the same): its number and money. */
export function drawCameInMoney(sow: Sow, lines: DrawCameIn['lines']): { number: number; gross: number; retainage: number; net: number } {
  const number = sow.draws.length + 1
  const toPct = Object.fromEntries(lines.filter((l) => Number.isFinite(l.toPct)).map((l) => [l.sovId, l.toPct]))
  const stored = Object.fromEntries(lines.filter((l) => Number.isFinite(l.stored) && l.stored > 0).map((l) => [l.sovId, l.stored]))
  return { number, ...drawMoney(sow, payApplication(sow, number, toPct, false, stored)) }
}

/** What `gc_draw_came_in` takes: the claim by kernel id, every line the office touched, the words trimmed. */
export function drawCameInPayload(d: DrawCameIn): { lines: { line: string; toPct: number; stored?: number }[]; periodTo: string; address: string; license: string; signedBy: string; signedTitle: string; fileName?: string; driveUrl?: string } {
  const file = d.fileName.trim()
  const link = d.driveUrl.trim()
  return {
    lines: d.lines
      .filter((l) => Number.isFinite(l.toPct))
      .map((l) => ({ line: l.sovId, toPct: Math.min(100, Math.max(0, l.toPct)), ...(Number.isFinite(l.stored) && l.stored > 0 ? { stored: Math.round(l.stored) } : {}) })),
    periodTo: d.periodTo,
    address: d.address.trim(),
    license: d.license.trim(),
    signedBy: d.signedBy.trim(),
    signedTitle: d.signedTitle.trim(),
    ...(file ? { fileName: file } : {}),
    ...(link ? { driveUrl: link } : {}),
  }
}

/** The percents we approve or see on the lines we doubt, by kernel id, as `gc_approve_draw_less` and `gc_send_draw_back` take them. */
export function linePercents(byLine: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(byLine).filter(([, pct]) => Number.isFinite(pct)).map(([sovId, pct]) => [sovId, Math.min(100, Math.max(0, pct))]))
}
