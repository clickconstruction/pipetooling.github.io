/**
 * One journal, three figures (vNEXT — journey-map Tier-2 #44, J26-F2/F4).
 *
 * The office Partnerships tabs used to run three private loaders over the
 * pay_stubs family and print three balances with no bridge between them:
 * Ledger −$1,008.13 · Timeline +$967.60 · Statements "attaching −$1,975.73".
 * All three now derive from the SAME `get_partner_ledger_as` payload the lens
 * and the partner's own statement read, and this kernel spells out how they
 * relate:
 *
 *   postedBalance  + attaching  = ledgerBalance
 *   (Timeline)       (Statements)  (Ledger headline = partner statement BALANCE)
 *
 * - `ledgerBalance` books every charge at the day it happened, attached to a
 *   statement or not, plus credits still waiting for a statement — the
 *   settle-up number.
 * - `postedBalance` counts only what statements have posted (labor, additions,
 *   statement deductions, payouts) — the Timeline's running column.
 * - `attaching` is Σ signed offsets not yet on a statement — what the
 *   Statements tab attaches at the next close (every charge kept).
 *
 * Hours: labor rows take the stamped rate-tier hours (Σ pay_stub_days per
 * rate), the number the partner's card and Full ledger already show — not the
 * stub's stored `hours_total`, which per-day rounding can miss by 0.01 h.
 */
import {
  POSITIVE_OFFSET_TYPES,
  buildPartnerJournal,
  netPosition,
  pendingOffsetSignedAmount,
  type JournalRow,
} from './partnerLedgerJournal'
import {
  parsePartnerLedgerOffsets,
  parsePartnerLedgerStubs,
  partnerStubsToJournal,
  tierHoursTotal,
  type PartnerLedgerOffset,
  type PartnerLedgerStub,
} from './partnerWeeks'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * What the partner payload cannot carry for an offset: which statement (if
 * any) has picked it up, and the payroll name the offset editor writes back.
 * `pay_stub_id === null` means still pending. Office-only detail.
 */
export type OffsetAttachment = { pay_stub_id: string | null; person_name: string }

/** Ledger hours for a stub — the same number the partner reads. */
export function ledgerHours(s: Pick<PartnerLedgerStub, 'day_rates' | 'hours_total'>): number {
  return tierHoursTotal(s) ?? round2(s.hours_total)
}

/**
 * The statement-posted journal: labor, additions, EVERY statement deduction
 * and payouts — charges reach it only once a statement lists them. This is
 * the Timeline's money stream; its last balance is `postedBalance`.
 */
export function partnerStubsToPostedJournal(stubs: PartnerLedgerStub[]): { rows: JournalRow[]; balance: number } {
  return buildPartnerJournal({
    stubs: stubs.map((s) => ({
      id: s.id,
      period_start: s.period_start,
      period_end: s.period_end,
      hours_total: ledgerHours(s),
      gross_pay: s.gross_pay,
    })),
    additional: stubs.flatMap((s) => s.additional.map((a) => ({ pay_stub_id: s.id, description: a.description, line_total: a.amount }))),
    deductions: stubs.flatMap((s) => s.deductions.map((d) => ({ pay_stub_id: s.id, description: d.description, amount: d.amount }))),
    payments: stubs.flatMap((s) => s.payments.map((p) => ({ pay_stub_id: s.id, amount: p.amount, paid_at: p.paid_at, memo: p.memo }))),
  })
}

/**
 * Offsets no statement has picked up yet, newest first. Charges read their
 * attach state from the payload itself — a statement deduction linked by
 * `person_offset_id` means attached — the SAME rule the charges-at-date
 * journal uses to skip the mirror, so posted + attaching = ledger holds even
 * with no attachment lookup. Credits (profit shares, employee credits) reach a
 * statement as additional lines the payload does not link, so they need the
 * office-only attachment row; with none they read as attached (conservative:
 * they then count in neither figure, so nothing disagrees).
 */
export function pendingPartnerOffsets(
  stubs: PartnerLedgerStub[],
  offsets: PartnerLedgerOffset[],
  attachments: ReadonlyMap<string, OffsetAttachment>,
): PartnerLedgerOffset[] {
  const linked = new Set<string>()
  for (const s of stubs) for (const d of s.deductions) if (d.person_offset_id) linked.add(d.person_offset_id)
  return offsets
    .filter((o) => {
      if (!POSITIVE_OFFSET_TYPES.has(o.type)) return !linked.has(o.id)
      const a = attachments.get(o.id)
      return a != null && a.pay_stub_id == null
    })
    .sort((a, b) => b.occurred_date.localeCompare(a.occurred_date))
}

export type PartnerBalanceSplit = {
  /** Settle-up: charges-at-date journal + credits still pending. Ledger headline; equals the partner statement's BALANCE. */
  ledgerBalance: number
  /** Statement-posted chain only. The Timeline's running column. */
  postedBalance: number
  /** Σ signed offsets not yet on a statement — Statements tab "attaching N of N". */
  attaching: number
  /** ledgerBalance − postedBalance: what the Timeline column moves by when the next statement attaches everything pending. Equals `attaching`. */
  timelineDelta: number
  pendingCount: number
}

/**
 * The three office figures from one payload. Sign convention throughout:
 * + means Click owes the partner, − means the partner owes Click (the same
 * convention as the partner's statement and the payroll ledger).
 */
export function splitPartnerBalance(
  stubs: PartnerLedgerStub[],
  offsets: PartnerLedgerOffset[],
  attachments: ReadonlyMap<string, OffsetAttachment>,
): PartnerBalanceSplit {
  const journal = partnerStubsToJournal(stubs, offsets)
  const posted = partnerStubsToPostedJournal(stubs)
  const pending = pendingPartnerOffsets(stubs, offsets, attachments)
  const attaching = round2(pending.reduce((s, o) => s + pendingOffsetSignedAmount(o), 0))
  const pendingCredits = round2(pending.filter((o) => POSITIVE_OFFSET_TYPES.has(o.type)).reduce((s, o) => s + pendingOffsetSignedAmount(o), 0))
  const ledgerBalance = netPosition(journal.balance, pendingCredits)
  return {
    ledgerBalance,
    postedBalance: posted.balance,
    attaching,
    timelineDelta: round2(ledgerBalance - posted.balance),
    pendingCount: pending.length,
  }
}

/**
 * The three figures straight from the raw `get_partner_ledger_as` payload —
 * the one-call form the tabs and tests use. `attachments` is the office-only
 * pay_stub_id lookup credits need; charges never do (see pendingPartnerOffsets).
 */
export function partnerBalanceFromLedger(
  payload: unknown,
  attachments: ReadonlyMap<string, OffsetAttachment> = new Map(),
): PartnerBalanceSplit {
  return splitPartnerBalance(parsePartnerLedgerStubs(payload), parsePartnerLedgerOffsets(payload), attachments)
}

/** Office-side words for a signed balance: "we owe Bryan" / "Bryan owes us" / "even". */
export function officeBalanceWords(n: number, partnerName: string): string {
  if (n > 0) return `we owe ${partnerName}`
  if (n < 0) return `${partnerName} owes us`
  return 'even'
}

const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "we owe Bryan $967.60" / "Bryan owes us $1,008.13" / "even" — the words with the number. */
export function officeBalanceLabel(n: number, partnerName: string): string {
  if (n === 0) return 'even'
  return `${officeBalanceWords(n, partnerName)} ${usd(n)}`
}

/** The one-line bridge between the Timeline's posted balance and the Ledger's
 * settle-up balance; empty when nothing is pending (the two already agree). */
export function balanceBridgeText(split: PartnerBalanceSplit, partnerName: string): string {
  if (split.pendingCount === 0) return ''
  const sign = split.attaching < 0 ? '−' : '+'
  return `posted ${officeBalanceLabel(split.postedBalance, partnerName)} · ${sign}${usd(split.attaching)} not yet on a statement (${split.pendingCount}) → ${officeBalanceLabel(split.ledgerBalance, partnerName)}`
}

/** Tooltip naming the sign convention and why the two balances differ. */
export function balanceConventionTitle(partnerName: string): string {
  return `+ we owe ${partnerName} · − ${partnerName} owes us. The running balance counts only what statements have posted; charges and credits still pending join it when the next statement attaches them — the Ledger tab's headline already counts them.`
}
