/**
 * Supply-house bill capture (punch list #179 PR 3, v2.6095): the fill. From the paper as read and what the form
 * already holds, the plan for every field the fill can touch: its value, where it came from, and the why a guess
 * carries. The form applies the plan to its state and never over a field the person typed (`applyPlan` keeps those),
 * so a re-pick keeps what was typed. The three looks the form draws come from the source alone (`billTint`): green
 * from the paper, amber a guess, plain yours to set. Pure.
 */
import type { PairableSupplyRow, PoLedgerEntriesByCode, SupplyDocumentKind } from '../supplyHouseInvoiceForm'
import { billChecks, checksToLook, type BillChecks } from './billChecks'
import { creditPairGuess, dueGuess, jobAccountDefault, jobGuess, kindFromRead, type DueGuess, type JobGuess, type MatchableAccount, type MatchableJob } from './billMatch'
import { BILL_FIELD_KEYS, EMPTY_FIELD, field, guessCount, typedCount, type BillField, type BillFieldKey, type BillFields, type BillRead, type BillSource } from './billRead'

export interface BillFillContext {
  houseName: string
  paymentDay: number | null | undefined
  ledger: PoLedgerEntriesByCode | null
  accounts: readonly MatchableAccount[]
  /** The jobs the form found for the printed place, as the search returns them. */
  jobs: readonly MatchableJob[]
  /** This house's invoices and credits, for the duplicate and the pair. */
  rows: ReadonlyArray<PairableSupplyRow & { invoice_date: string }>
  todayYmd: string
  /** The app's lasting link to our copy, the row's `link` unless the person wants a Drive link instead. */
  linkUrl: string
  editingId?: string | null
}

export interface BillFillPlan {
  kind: SupplyDocumentKind
  number: string
  dateYmd: string
  /** The box's positive digits, 'x.xx'; '' when the paper prints no total. */
  amountTyped: string
  purchaseOrder: string
  dueYmd: string
  due: DueGuess
  job: JobGuess | null
  onJobAccount: boolean
  /** The invoice a credit credits, '' for none. */
  creditsInvoiceId: string
  pair: { invoiceId: string; label: string } | null
  fields: BillFields
  checks: BillChecks
}

/** Cents as the amount box's digits: 95228 → '952.28'. */
export const amountDigits = (cents: number | null): string => (cents == null ? '' : (cents / 100).toFixed(2))

/** The plan: every field from the paper, the guesses with their why, the checks as they stand. */
export function planBillFill(read: BillRead, ctx: BillFillContext): BillFillPlan {
  const kind = kindFromRead(read)
  const job = jobGuess(read, { ledger: ctx.ledger, accounts: ctx.accounts, jobs: ctx.jobs })
  const onJobAccount = jobAccountDefault(job?.jobId ?? null, ctx.accounts)
  const pair = kind === 'credit' ? creditPairGuess(read, ctx.rows) : null
  const due = kind === 'credit' ? ({ ymd: '', from: 'none', days: null } as DueGuess) : dueGuess(read, ctx.paymentDay, ctx.todayYmd)
  const checks = billChecks(read, { houseName: ctx.houseName, rows: ctx.rows, editingId: ctx.editingId ?? null })
  const paper = (value: string): BillField => (value ? field(value, 'read') : EMPTY_FIELD)
  const fields: BillFields = {
    kind: read.kind === 'invoice' || read.kind === 'credit' ? field(kind, 'read') : field(kind, 'none'),
    number: paper(read.number),
    date: paper(read.dateYmd),
    amount: paper(amountDigits(read.totalCents)),
    purchaseOrder: paper(read.poText),
    job: job ? field(job.jobId, 'guessed', `from ${job.evidence.join(', ')}`) : EMPTY_FIELD,
    onJobAccount: job && onJobAccount ? field('true', 'guessed', 'the account is open') : field('false', 'none'),
    dueDate: due.from === 'terms' || due.from === 'receipt' ? field(due.ymd, 'read') : due.ymd ? field(due.ymd, 'none') : EMPTY_FIELD,
    creditsInvoice: pair ? field(pair.invoiceId, 'guessed', `the paper says RE: ${read.referencesNumber}`) : EMPTY_FIELD,
    link: ctx.linkUrl ? field(ctx.linkUrl, 'read') : EMPTY_FIELD,
  }
  return {
    kind,
    number: read.number,
    dateYmd: read.dateYmd,
    amountTyped: amountDigits(read.totalCents),
    purchaseOrder: read.poText,
    dueYmd: due.ymd,
    due,
    job,
    onJobAccount,
    creditsInvoiceId: pair?.invoiceId ?? '',
    pair,
    fields,
    checks,
  }
}

/** The plan's fields over the ones on the form, with every field the person typed kept as it is. */
export function applyPlan(prev: BillFields | null, plan: BillFillPlan, typed: ReadonlySet<BillFieldKey>): BillFields {
  const out = { ...plan.fields }
  if (prev) for (const k of BILL_FIELD_KEYS) if (typed.has(k)) out[k] = prev[k]
  return out
}

/** The fields with none, as the form starts with no PDF. */
export function emptyFields(): BillFields {
  return { kind: EMPTY_FIELD, number: EMPTY_FIELD, date: EMPTY_FIELD, amount: EMPTY_FIELD, purchaseOrder: EMPTY_FIELD, job: EMPTY_FIELD, onJobAccount: EMPTY_FIELD, dueDate: EMPTY_FIELD, creditsInvoice: EMPTY_FIELD, link: EMPTY_FIELD }
}

/** A field the person answered: a confirmed guess or a typed value is theirs from then on. */
export function settle(fields: BillFields, key: BillFieldKey, value: string): BillFields {
  return { ...fields, [key]: field(value, 'typed') }
}

/** What the count line counts: the guesses and checks still asking for a look, the fields that are the person's to set, the fields they typed. */
export function fillCounts(fields: BillFields, checks: BillChecks): { checks: number; yours: number; typed: number } {
  const unanswered = (['number', 'date', 'amount', 'job'] as const).filter((k) => fields[k].source === 'none').length
  // Status is always the person's to set: the paper never says whether we paid it.
  return { checks: guessCount(fields) + checksToLook(checks), yours: 1 + unanswered, typed: typedCount(fields) }
}

/** The look a field gets from its source: the drawing's three. */
export function billTint(source: BillSource | undefined): { background?: string; borderLeft?: string } {
  if (source === 'read') return { background: 'var(--bg-green-tint)', borderLeft: '3px solid var(--border-green)' }
  if (source === 'guessed') return { background: 'var(--bg-amber-tint)', borderLeft: '3px solid var(--border-amber-soft)' }
  return {}
}
