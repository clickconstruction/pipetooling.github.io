/**
 * Lien waivers for sub payments (v2.29xx): which of the four Texas § 53.284
 * statutory forms a sheet payment calls for, and the values the office can
 * seed into the sub's form so they only check and sign.
 *
 * Two facts decide the form, both read from the pay row and both editable in
 * the dialog:
 *   - settled: has the money landed? No → conditional (takes effect when the
 *     check clears; safe to sign in advance). Yes → unconditional (states the
 *     sub has been paid; Texas prohibits requiring it before payment).
 *   - final: is this the last payment on the sheet? No → progress (this period,
 *     retention and changes stay open). Yes → final (everything through the end).
 *
 * The payment rows carry no cleared flag, so "settled" is a guess the office
 * confirms: a payment older than SETTLE_DAYS is presumed settled.
 */

export type LienWaiverKind = 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'

export type LienWaiverForm = {
  kind: LienWaiverKind
  /** The Contract Book document name — the statutory title, exactly as published. */
  documentName: string
  /** Statute section, for the dialog's cite line. */
  cite: string
  /** Short label for chips and rails. */
  short: string
  /** One sentence the office reads: why this one. */
  why: string
  /** When to use it, for the "not this one?" list. */
  when: string
  /** The button's verb. */
  send: string
  conditional: boolean
  final: boolean
}

export const LIEN_WAIVER_FORMS: readonly LienWaiverForm[] = [
  {
    kind: 'conditional_progress',
    documentName: 'Conditional Waiver and Release on Progress Payment',
    cite: 'Texas Property Code § 53.284(b)',
    short: 'Conditional · progress',
    why: 'Goes out with this check. It releases the sub’s lien rights for the period only once the check clears, so it is safe to sign before the money arrives. Retention and pending changes stay open.',
    when: 'with a progress check that has not cleared yet',
    send: 'Send with the check',
    conditional: true,
    final: false,
  },
  {
    kind: 'unconditional_progress',
    documentName: 'Unconditional Waiver and Release on Progress Payment',
    cite: 'Texas Property Code § 53.284(c)',
    short: 'Unconditional · progress',
    why: 'The sub’s check for this period has settled, so the release is no longer conditional. Send this when the GC or lender wants the period fully closed before the next draw.',
    when: 'once a progress check has cleared',
    send: 'Send now',
    conditional: false,
    final: false,
  },
  {
    kind: 'conditional_final',
    documentName: 'Conditional Waiver and Release on Final Payment',
    cite: 'Texas Property Code § 53.284(d)',
    short: 'Conditional · final',
    why: 'Goes out with the last check on the sheet. It releases everything through the end of the job once the check clears, with no carve-out for retention.',
    when: 'with the last check, before it clears',
    send: 'Send with the check',
    conditional: true,
    final: true,
  },
  {
    kind: 'unconditional_final',
    documentName: 'Unconditional Waiver and Release on Final Payment',
    cite: 'Texas Property Code § 53.284(e)',
    short: 'Unconditional · final',
    why: 'The final check has settled and nothing is owed. This is the closeout document owners and title companies ask for before releasing retention or closing a loan.',
    when: 'once the final check has cleared',
    send: 'Send now',
    conditional: false,
    final: true,
  },
]

export const LIEN_WAIVER_DOCUMENT_NAMES: readonly string[] = LIEN_WAIVER_FORMS.map((f) => f.documentName)

export function lienWaiverForm(kind: LienWaiverKind): LienWaiverForm {
  return LIEN_WAIVER_FORMS.find((f) => f.kind === kind) ?? LIEN_WAIVER_FORMS[0]!
}

export function lienWaiverKindFor(settled: boolean, final: boolean): LienWaiverKind {
  return final ? (settled ? 'unconditional_final' : 'conditional_final') : settled ? 'unconditional_progress' : 'conditional_progress'
}

/** The document name the Book entry must carry for a kind (exact, case-sensitive). */
export function isLienWaiverDocumentName(name: string | null | undefined): boolean {
  return !!name && LIEN_WAIVER_DOCUMENT_NAMES.includes(name.trim())
}

/** A payment older than this many days is presumed settled; the office can flip it. */
export const LIEN_WAIVER_SETTLE_DAYS = 5

export type LienWaiverPaymentLike = { amount: number; payment_date?: string | null; created_at: string }

export type LienWaiverGuess = {
  /** The payment the waiver is about: the newest positive one, or null when nothing has been paid. */
  payment: LienWaiverPaymentLike | null
  /** Dollars to write on the form: the newest payment, or — before any payment — the balance, i.e. the check about to be written. */
  amount: number | null
  /** Money-in-hand guess: the newest payment is at least LIEN_WAIVER_SETTLE_DAYS old. */
  settled: boolean
  /** Nothing left after paid and back-charges. */
  final: boolean
  kind: LienWaiverKind
  /** Why the guess is what it is — one line each, shown under the facts. */
  reasons: string[]
}

function paymentDay(p: LienWaiverPaymentLike): string {
  return (p.payment_date && p.payment_date.slice(0, 10)) || p.created_at.slice(0, 10)
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.UTC(Number(fromYmd.slice(0, 4)), Number(fromYmd.slice(5, 7)) - 1, Number(fromYmd.slice(8, 10)))
  const b = Date.UTC(Number(toYmd.slice(0, 4)), Number(toYmd.slice(5, 7)) - 1, Number(toYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

/**
 * Guess the waiver for a sheet from its payments and balance. Pure; `todayYmd`
 * is the company-calendar day.
 */
export function guessLienWaiver(input: { payments: readonly LienWaiverPaymentLike[]; balance: number; todayYmd: string }): LienWaiverGuess {
  const paid = input.payments.filter((p) => p.amount > 0)
  const newest = paid.length ? [...paid].sort((a, b) => paymentDay(b).localeCompare(paymentDay(a)) || b.created_at.localeCompare(a.created_at))[0]! : null
  const age = newest ? daysBetween(paymentDay(newest), input.todayYmd) : null
  const settled = newest != null && age != null && age >= LIEN_WAIVER_SETTLE_DAYS
  const final = input.balance <= 0 && paid.length > 0
  const reasons: string[] = []
  if (!newest) reasons.push('No payment recorded on this sheet yet — the waiver goes out with the first check.')
  else if (settled) reasons.push(`The newest payment was ${age} days ago, so it has most likely settled.`)
  else reasons.push(age === 0 ? 'The newest payment was recorded today, so it has not settled yet.' : `The newest payment was ${age} day${age === 1 ? '' : 's'} ago, so it may not have settled yet.`)
  reasons.push(final ? 'Nothing is left on the sheet after this payment, so it is the final one.' : 'The sheet still has a balance, so this is a progress payment.')
  const amount = newest ? newest.amount : input.balance > 0 ? input.balance : null
  return { payment: newest, amount, settled, final, kind: lienWaiverKindFor(settled, final), reasons }
}

/** The standard extent-of-release sentence GCs use; the sub can edit it on the page. */
export const LIEN_WAIVER_STANDARD_EXTENT = 'All labor, materials, equipment, and services provided through the current billing period for the above referenced project.'

export type LienWaiverSeedInput = {
  kind: LienWaiverKind
  /** Project / job name as the sub knows it. */
  project: string | null
  /** Click's job number, e.g. J1042. */
  jobNo: string | null
  /** Dollars, as on the check; omitted on the unconditional-final form (it has no amount box). */
  amount: number | null
  owner: string | null
  location: string | null
  /** The box keys the published form actually has — unknown keys are refused by the signer validation. */
  boxKeys: readonly string[]
}

/** Values the office seeds into the sub's form (non-sensitive only; the sub can change any of them). */
export function lienWaiverSeedValues(input: LienWaiverSeedInput): Record<string, string> {
  const candidate: Record<string, string | null> = {
    project: input.project?.trim() || null,
    job_no: input.jobNo?.trim() || null,
    amount: input.amount != null && input.amount > 0 ? input.amount.toFixed(2) : null,
    owner: input.owner?.trim() || null,
    location: input.location?.trim() || null,
    job_description: LIEN_WAIVER_STANDARD_EXTENT,
  }
  const keys = new Set(input.boxKeys)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(candidate)) if (v && keys.has(k)) out[k] = v
  return out
}

/** Money as the office writes it on a check: 17752.65 → "$17,752.65". */
export function lienWaiverMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
