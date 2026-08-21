/**
 * Partner dashboard week-card kernel (PARTNERSHIPS_PLAN.md PR 4).
 *
 * Shapes the get_my_partner_summary / get_my_partner_ledger payloads into the
 * ‹ › week cards: index 0 is the live current week ("balance so far"), then
 * one card per generated statement, each with its lines and an opening/closing
 * chain derived backwards from the authoritative server balance (closing of
 * the newest statement week == the server balance, since only posted stubs and
 * their payouts move it). Also home of partnerStubsToJournal — the partner's
 * "Full ledger" journal built from the same payload.
 */
import { POSITIVE_OFFSET_TYPES, buildPartnerJournal, pendingOffsetSignedAmount, type JournalRow, type LedgerNote } from './partnerLedgerJournal'

export type PartnerSummary = {
  exists: boolean
  partnership_id: string | null
  display_name: string
  balance: number
  modules: { weekly_statement: boolean; costing: boolean; profit_shares: boolean }
  current_week: {
    week_start: string
    field_hours: number
    office_hours: number
    farm_hours: number
    gross_so_far: number
    pending_sessions: number
  }
  latest_statement: {
    pay_stub_id: string
    period_start: string
    period_end: string
    partner_ack_at: string | null
    company_ack_at: string | null
  } | null
  rates: { field: number; estimating: number; farm: number }
  pending_offsets: { count: number; net: number }
}

export type PartnerLedgerStub = {
  id: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
  company_ack_at: string | null
  partner_ack_at: string | null
  day_rates: { rate: number; hours: number; amount: number }[]
  additional: { description: string; amount: number }[]
  deductions: { description: string; amount: number; person_offset_id?: string | null }[]
  payments: { amount: number; paid_at: string; memo: string | null }[]
}

/** One person_offsets row from the ledger payload — the partner's own charges/credits. */
export type PartnerLedgerOffset = {
  id: string
  type: string
  amount: number
  occurred_date: string
  description: string | null
}

export type WeekCardLine = { label: string; sub?: string; amount: number | null; cls: 'pos' | 'neg' | 'zero' }

export type WeekCard = {
  open: boolean
  weekStart: string
  weekEnd: string | null
  stubId: string | null
  lines: WeekCardLine[]
  opening: number | null
  closing: number
  partnerAckAt: string | null
  companyAckAt: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * The partner's "Full ledger": shape the RPC payload into the same dated
 * journal (with running balance) the office Ledger tab shows — wage-free by
 * construction since it is all the partner's own money. Charges-at-date:
 * charge-type offsets (back-charges, damages, utility overages) book at their
 * occurred_date whether or not a statement has attached them; statement
 * deductions that mirror one of those offsets are skipped so nothing counts
 * twice. Deductions from positive-type offsets and manual deductions keep
 * booking on the statement week.
 */
export function partnerStubsToJournal(
  stubs: PartnerLedgerStub[],
  offsets: PartnerLedgerOffset[] = [],
): { rows: JournalRow[]; balance: number } {
  const chargeOffsets = offsets.filter((o) => !POSITIVE_OFFSET_TYPES.has(o.type))
  const chargeOffsetIds = new Set(chargeOffsets.map((o) => o.id))
  return buildPartnerJournal({
    stubs: stubs.map((s) => ({
      id: s.id,
      period_start: s.period_start,
      period_end: s.period_end,
      hours_total: s.hours_total,
      gross_pay: s.gross_pay,
    })),
    additional: stubs.flatMap((s) => s.additional.map((a) => ({ pay_stub_id: s.id, description: a.description, line_total: a.amount }))),
    deductions: stubs.flatMap((s) =>
      s.deductions
        .filter((d) => d.person_offset_id == null || !chargeOffsetIds.has(d.person_offset_id))
        .map((d) => ({ pay_stub_id: s.id, description: d.description, amount: d.amount })),
    ),
    payments: stubs.flatMap((s) => s.payments.map((p) => ({ pay_stub_id: s.id, amount: p.amount, paid_at: p.paid_at, memo: p.memo }))),
    charges: chargeOffsets.map((o) => ({
      date: o.occurred_date,
      label: o.description || o.type,
      amount: pendingOffsetSignedAmount(o),
    })),
  })
}

/** Partner-visible ledger notes from the payload (date + memo only). */
export function parsePartnerLedgerNotes(payload: unknown): LedgerNote[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const o = payload as Record<string, unknown>
  if (o.exists !== true || !Array.isArray(o.notes)) return []
  const out: LedgerNote[] = []
  o.notes.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return
    const r = raw as Record<string, unknown>
    const memo = typeof r.memo === 'string' ? r.memo : ''
    const date = String(r.note_date ?? '')
    if (!memo || !date) return
    out.push({ id: `pn-${i}`, note_date: date, memo, partner_visible: true })
  })
  return out
}

export function parsePartnerLedgerOffsets(payload: unknown): PartnerLedgerOffset[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const o = payload as Record<string, unknown>
  if (o.exists !== true || !Array.isArray(o.offsets)) return []
  const out: PartnerLedgerOffset[] = []
  for (const raw of o.offsets) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string') continue
    out.push({
      id: r.id,
      type: String(r.type ?? ''),
      amount: num(r.amount),
      occurred_date: String(r.occurred_date ?? ''),
      description: typeof r.description === 'string' ? r.description : null,
    })
  }
  return out
}

export function parsePartnerSummary(payload: unknown): PartnerSummary | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const o = payload as Record<string, unknown>
  if (o.exists !== true) return null
  const cw = (o.current_week ?? {}) as Record<string, unknown>
  const mods = (o.modules ?? {}) as Record<string, unknown>
  const rates = (o.rates ?? {}) as Record<string, unknown>
  const po = (o.pending_offsets ?? {}) as Record<string, unknown>
  const ls = o.latest_statement as Record<string, unknown> | null | undefined
  return {
    exists: true,
    partnership_id: typeof o.partnership_id === 'string' ? o.partnership_id : null,
    display_name: typeof o.display_name === 'string' ? o.display_name : '',
    balance: num(o.balance),
    modules: {
      weekly_statement: mods.weekly_statement === true,
      costing: mods.costing === true,
      profit_shares: mods.profit_shares === true,
    },
    current_week: {
      week_start: typeof cw.week_start === 'string' ? cw.week_start : '',
      field_hours: num(cw.field_hours),
      office_hours: num(cw.office_hours),
      farm_hours: num(cw.farm_hours),
      gross_so_far: num(cw.gross_so_far),
      pending_sessions: num(cw.pending_sessions),
    },
    latest_statement:
      ls && typeof ls === 'object' && typeof ls.pay_stub_id === 'string'
        ? {
            pay_stub_id: ls.pay_stub_id,
            period_start: String(ls.period_start ?? ''),
            period_end: String(ls.period_end ?? ''),
            partner_ack_at: typeof ls.partner_ack_at === 'string' ? ls.partner_ack_at : null,
            company_ack_at: typeof ls.company_ack_at === 'string' ? ls.company_ack_at : null,
          }
        : null,
    rates: { field: num(rates.field), estimating: num(rates.estimating), farm: num(rates.farm) },
    pending_offsets: { count: num(po.count), net: num(po.net) },
  }
}

export function parsePartnerLedgerStubs(payload: unknown): PartnerLedgerStub[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const o = payload as Record<string, unknown>
  if (o.exists !== true || !Array.isArray(o.stubs)) return []
  const out: PartnerLedgerStub[] = []
  for (const raw of o.stubs) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    if (typeof s.id !== 'string') continue
    out.push({
      id: s.id,
      period_start: String(s.period_start ?? ''),
      period_end: String(s.period_end ?? ''),
      hours_total: num(s.hours_total),
      gross_pay: num(s.gross_pay),
      company_ack_at: typeof s.company_ack_at === 'string' ? s.company_ack_at : null,
      partner_ack_at: typeof s.partner_ack_at === 'string' ? s.partner_ack_at : null,
      day_rates: Array.isArray(s.day_rates)
        ? (s.day_rates as Record<string, unknown>[]).map((d) => ({ rate: num(d.rate), hours: num(d.hours), amount: num(d.amount) }))
        : [],
      additional: Array.isArray(s.additional)
        ? (s.additional as Record<string, unknown>[]).map((a) => ({ description: String(a.description ?? ''), amount: num(a.amount) }))
        : [],
      deductions: Array.isArray(s.deductions)
        ? (s.deductions as Record<string, unknown>[]).map((d) => ({
            description: String(d.description ?? ''),
            amount: num(d.amount),
            person_offset_id: typeof d.person_offset_id === 'string' ? d.person_offset_id : null,
          }))
        : [],
      payments: Array.isArray(s.payments)
        ? (s.payments as Record<string, unknown>[]).map((p) => ({ amount: num(p.amount), paid_at: String(p.paid_at ?? ''), memo: typeof p.memo === 'string' ? p.memo : null }))
        : [],
    })
  }
  return out
}

function stubNet(s: PartnerLedgerStub): number {
  const adds = s.additional.reduce((t, a) => t + a.amount, 0)
  const deds = s.deductions.reduce((t, d) => t + d.amount, 0)
  const pays = s.payments.reduce((t, p) => t + p.amount, 0)
  return round2(s.gross_pay + adds - deds - pays)
}

/**
 * Cards newest-first: [current open week, newest statement week, …].
 * Closing chain runs backwards from the server balance; the open week's
 * "closing" is balance + this week's gross so far (nothing is posted yet).
 */
export function buildWeekCards(summary: PartnerSummary, stubs: PartnerLedgerStub[]): WeekCard[] {
  const cards: WeekCard[] = []
  const cw = summary.current_week
  const openLines: WeekCardLine[] = []
  if (cw.field_hours > 0)
    openLines.push({ label: `Field labor · ${cw.field_hours.toFixed(1)} h × $${summary.rates.field}`, amount: round2(cw.field_hours * summary.rates.field), cls: 'pos' })
  if (cw.office_hours > 0)
    openLines.push({ label: `Estimating · ${cw.office_hours.toFixed(1)} h × $${summary.rates.estimating}`, amount: round2(cw.office_hours * summary.rates.estimating), cls: 'pos' })
  if (cw.farm_hours > 0)
    openLines.push({ label: `Farm · ${cw.farm_hours.toFixed(1)} h`, sub: 'no cash — farm food credit', amount: 0, cls: 'zero' })
  if (cw.pending_sessions > 0)
    openLines.push({ label: `${cw.pending_sessions} session(s) pending approval`, sub: 'post when the office approves them', amount: null, cls: 'zero' })
  cards.push({
    open: true,
    weekStart: cw.week_start,
    weekEnd: null,
    stubId: null,
    lines: openLines,
    opening: summary.balance,
    closing: round2(summary.balance + cw.gross_so_far),
    partnerAckAt: null,
    companyAckAt: null,
  })

  const desc = [...stubs].sort((a, b) => b.period_start.localeCompare(a.period_start))
  let closing = summary.balance
  for (const s of desc) {
    const lines: WeekCardLine[] = s.day_rates.map((d) => ({
      label: `Labor · ${d.hours.toFixed(1)} h × $${d.rate}`,
      amount: round2(d.amount),
      cls: d.amount > 0 ? 'pos' : 'zero',
    }))
    for (const a of s.additional) lines.push({ label: a.description || 'Addition', amount: round2(a.amount), cls: 'pos' })
    for (const d of s.deductions) lines.push({ label: d.description || 'Deduction', amount: round2(-d.amount), cls: 'neg' })
    for (const p of s.payments) lines.push({ label: 'Paid out', sub: p.memo ?? undefined, amount: round2(-p.amount), cls: 'neg' })
    const net = stubNet(s)
    cards.push({
      open: false,
      weekStart: s.period_start,
      weekEnd: s.period_end,
      stubId: s.id,
      lines,
      opening: round2(closing - net),
      closing,
      partnerAckAt: s.partner_ack_at,
      companyAckAt: s.company_ack_at,
    })
    closing = round2(closing - net)
  }
  return cards
}
