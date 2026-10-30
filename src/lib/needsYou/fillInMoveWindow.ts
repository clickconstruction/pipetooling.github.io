import { daysPastDue, isMovableAgingInvoice, movableCandidates } from '../supplyHouseAging'
import { supplyMoveWindowCloseWords, supplyMoveWindowSeverity } from '../dashboardNeedsYou'
import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import type { JobAccountStatus } from '../materials/jobSupplyHouseAccounts'
import { jobAccountJobLabel, type JobAccountJobLabel, type JobAccountWrites } from './fillInJobAccounts'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The move-window kind (v2.6086, punch list #178, D's PR 3): the rows behind the Needs you line
 * *$X on N current invoices is not on a job account yet*. A supply house moves a charge onto the
 * job account only while the invoice is current, so each row is one still-current unpaid charge
 * not on a job account, on exactly one job, whose account at the house is not marked not needed:
 * the strip's own predicate (`movableCandidates` + `isMovableAgingInvoice`), which
 * `count_supply_house_move_window()` reads on the server. Soonest window first. The answers are
 * the job-account sheet's three, each on its own row: **moved** (the attested call, the move
 * modal's Mark it moved), **asked the house** (the move modal's emailed request), **no job
 * account needed** (the sheet's not needed, which takes the charge out of the window). Pure;
 * `fillInMoveWindowIo.ts` reads and writes.
 */
export type MoveWindowInvoiceSource = {
  id: string
  supply_house_id: string
  invoice_number: string | null
  purchase_order_number: string | null
  invoice_date: string | null
  amount: number | string | null
  due_date: string | null
  on_job_account: boolean | null
}

export type MoveWindowAllocationSource = { invoice_id: string; job_id: string }

export type MoveWindowAccountSource = {
  job_id: string
  supply_house_id: string
  status: string
  account_ref: string | null
  opened_at: string | null
  requested_at: string | null
}

/** An open (unconfirmed) ask to the house. */
export type MoveWindowAskSource = { id: string; invoice_id: string; requested_at: string; via: string; sent_to: string }

export type MoveWindowRepSource = { id: string; supply_house_id: string; name: string | null; email: string | null; phone: string | null }

export type MoveWindowSources = {
  invoices: readonly MoveWindowInvoiceSource[]
  allocations: readonly MoveWindowAllocationSource[]
  accounts: readonly MoveWindowAccountSource[]
  asks: readonly MoveWindowAskSource[]
  reps: readonly MoveWindowRepSource[]
  houses: ReadonlyArray<{ id: string; name: string }>
  jobs: readonly JobAccountJobLabel[]
  todayYmd: string
  nowMs: number
}

export type MoveWindowFillInRow = FillInRowBase & {
  kind: 'move-window'
  invoiceId: string
  invoiceNumber: string
  houseId: string
  houseName: string
  jobId: string
  /** "#650 Maple Street remodel" */
  jobLabel: string
  amount: number
  dueYmd: string
  /** Whole days until the window closes; 0 is today. */
  daysLeft: number
  account: { status: JobAccountStatus; accountRef: string } | null
  ask: { id: string; requestedAt: string; via: string; sentTo: string } | null
  rep: { id: string; name: string; email: string | null; phone: string | null } | null
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : 0
}

const money = (n: number): string => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pairKey = (jobId: string, houseId: string): string => `${jobId}:${houseId}`

const daysAgo = (iso: string, nowMs: number): number => Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 86_400_000))

function closesShort(daysLeft: number): string {
  if (daysLeft <= 0) return 'closes today'
  if (daysLeft === 1) return 'closes tomorrow'
  return `closes in ${daysLeft} days`
}

export function moveWindowKnows(row: Pick<MoveWindowFillInRow, 'invoiceNumber' | 'dueYmd' | 'daysLeft' | 'account' | 'rep' | 'ask' | 'houseName'> & { invoiceDate: string | null; po: string | null }, nowMs: number): string[] {
  const out: string[] = []
  out.push(`Invoice ${row.invoiceNumber || '—'}${row.invoiceDate ? ` of ${formatYmdMonthDay(row.invoiceDate)}` : ''}${row.po ? `, PO ${row.po}` : ''}.`)
  out.push(`The window closes ${supplyMoveWindowCloseWords(row.dueYmd, row.daysLeft)}.`)
  if (row.account?.status === 'open') out.push(`The job account there is open${row.account.accountRef ? `, ref ${row.account.accountRef}` : ''}.`)
  else if (row.account?.status === 'requested') out.push(`The house was asked for a job account; it is not open yet.`)
  else out.push(`No job account on record for this job at ${row.houseName}.`)
  if (row.rep) out.push(`The rep for job accounts is ${row.rep.name}${row.rep.phone ? `, ${row.rep.phone}` : ''}${row.rep.email ? `, ${row.rep.email}` : ''}.`)
  else out.push('No job-accounts rep is on file for the house.')
  if (row.ask) {
    const days = daysAgo(row.ask.requestedAt, nowMs)
    out.push(`Asked by ${row.ask.via} ${formatYmdMonthDay(row.ask.requestedAt.slice(0, 10))}, ${days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`}${row.ask.sentTo ? `, to ${row.ask.sentTo}` : ''}. The house has not confirmed.`)
  }
  return out
}

/** The soonest window first, the biggest charge among a day's, then the house and the invoice. */
export function compareMoveWindowRows(a: MoveWindowFillInRow, b: MoveWindowFillInRow): number {
  return a.daysLeft - b.daysLeft || b.amount - a.amount || a.houseName.localeCompare(b.houseName) || a.invoiceNumber.localeCompare(b.invoiceNumber)
}

export function moveWindowFillInRows(s: MoveWindowSources): MoveWindowFillInRow[] {
  const allocs = new Map<string, string[]>()
  for (const a of s.allocations) (allocs.get(a.invoice_id) ?? allocs.set(a.invoice_id, []).get(a.invoice_id)!).push(a.job_id)
  const accountOf = new Map(s.accounts.map((a) => [pairKey(a.job_id, a.supply_house_id), a]))
  const askOf = new Map(s.asks.map((a) => [a.invoice_id, a]))
  const houseName = new Map(s.houses.map((h) => [h.id, h.name]))
  const jobById = new Map(s.jobs.map((j) => [j.id, j]))
  // The page's pick: the first job-accounts rep with an email, else the first.
  const repOf = new Map<string, MoveWindowRepSource>()
  for (const r of s.reps) {
    const have = repOf.get(r.supply_house_id)
    const hasEmail = typeof r.email === 'string' && r.email.includes('@')
    if (!have || (hasEmail && !(typeof have.email === 'string' && have.email.includes('@')))) repOf.set(r.supply_house_id, r)
  }
  const candidates = movableCandidates(
    s.invoices.map((i) => ({ ...i, amount: num(i.amount) })),
    s.todayYmd,
  )
  return candidates
    .filter((inv) => {
      const jobs = allocs.get(inv.id) ?? []
      const account = jobs.length === 1 ? accountOf.get(pairKey(jobs[0]!, inv.supply_house_id)) : undefined
      return isMovableAgingInvoice(inv, jobs.length, s.todayYmd, account?.status ?? null)
    })
    .map((inv): MoveWindowFillInRow => {
      const jobId = allocs.get(inv.id)![0]!
      const account = accountOf.get(pairKey(jobId, inv.supply_house_id)) ?? null
      const ask = askOf.get(inv.id) ?? null
      const rep = repOf.get(inv.supply_house_id) ?? null
      const house = houseName.get(inv.supply_house_id) ?? 'the house'
      const jobLabel = jobAccountJobLabel(jobById.get(jobId), jobId)
      const dueYmd = inv.due_date ?? s.todayYmd
      const daysLeft = -daysPastDue(dueYmd, s.todayYmd) || 0
      const partial = {
        invoiceNumber: (inv.invoice_number ?? '').trim(),
        houseName: house,
        dueYmd,
        daysLeft,
        account: account ? { status: account.status as JobAccountStatus, accountRef: (account.account_ref ?? '').trim() } : null,
        ask: ask ? { id: ask.id, requestedAt: ask.requested_at, via: ask.via, sentTo: ask.sent_to } : null,
        rep: rep ? { id: rep.id, name: (rep.name ?? '').trim() || (rep.email ?? '').trim() || 'the rep', email: typeof rep.email === 'string' && rep.email.includes('@') ? rep.email.trim() : null, phone: (rep.phone ?? '').trim() || null } : null,
      }
      return {
        key: fillInRowKey('move-window', inv.id),
        kind: 'move-window',
        severity: supplyMoveWindowSeverity(daysLeft),
        title: `${money(inv.amount)} at ${house} · ${jobLabel} · ${closesShort(daysLeft)}`,
        knows: moveWindowKnows({ ...partial, invoiceDate: inv.invoice_date, po: (inv.purchase_order_number ?? '').trim() || null }, s.nowMs),
        doorHref: '/materials?tab=supply-houses&list=movable',
        doorLabel: 'Open the list',
        invoiceId: inv.id,
        houseId: inv.supply_house_id,
        jobId,
        jobLabel,
        amount: inv.amount,
        ...partial,
      }
    })
    .sort(compareMoveWindowRows)
}

/** The three answers, the sheet's three states, each on its own row. */
export type MoveWindowChoice = 'moved' | 'asked' | 'not_needed'

export type MoveWindowDecision = {
  choice: MoveWindowChoice | null
  /** Moved, with no account open on record: the house's reference, which records the account as opened by phone. */
  ref: string
  /** Not needed: the reason, as the sheet requires. */
  note: string
}

export const EMPTY_MOVE_WINDOW_DECISION: MoveWindowDecision = { choice: null, ref: '', note: '' }

export type MoveWindowChoiceOption = { key: MoveWindowChoice; label: string; hint: string; disabled: boolean }

export function moveWindowChoices(row: MoveWindowFillInRow): MoveWindowChoiceOption[] {
  const repEmail = row.rep?.email ?? null
  return [
    { key: 'moved', label: 'Moved · I called the house', hint: 'the charge goes on the job account', disabled: false },
    {
      key: 'asked',
      label: row.ask ? 'Send the email again' : 'Ask the house by email',
      hint: repEmail ? `to ${row.rep!.name}, ${repEmail}` : 'no job-accounts rep with an email on file',
      disabled: repEmail == null,
    },
    { key: 'not_needed', label: 'No job account needed', hint: 'say why · the charge leaves the window', disabled: false },
  ]
}

export function moveWindowDecisionReady(row: MoveWindowFillInRow, d: MoveWindowDecision): boolean {
  if (!d.choice) return false
  if (d.choice === 'asked') return row.rep?.email != null
  if (d.choice === 'not_needed') return d.note.trim() !== ''
  return true
}

export type MoveWindowWrites =
  | {
      choice: 'moved'
      invoiceId: string
      jobId: string
      houseId: string
      houseName: string
      /** With a reference and no account open on record: the sheet's open row, by phone. */
      account: JobAccountWrites | null
    }
  | { choice: 'asked'; invoiceId: string; includeAsked: boolean; sentTo: string }
  | { choice: 'not_needed'; invoiceId: string; houseName: string; account: JobAccountWrites }

export function moveWindowWrites(row: MoveWindowFillInRow, d: MoveWindowDecision): MoveWindowWrites | null {
  if (!moveWindowDecisionReady(row, d) || !d.choice) return null
  if (d.choice === 'moved') {
    const ref = d.ref.trim()
    const account: JobAccountWrites | null =
      ref && row.account?.status !== 'open'
        ? { jobId: row.jobId, houseId: row.houseId, row: { job_id: row.jobId, supply_house_id: row.houseId, status: 'open', account_ref: ref, opened_via: 'phone', rep_contact_id: null, note: '' }, flagInvoices: false }
        : null
    return { choice: 'moved', invoiceId: row.invoiceId, jobId: row.jobId, houseId: row.houseId, houseName: row.houseName, account }
  }
  if (d.choice === 'asked') return { choice: 'asked', invoiceId: row.invoiceId, includeAsked: row.ask != null, sentTo: row.rep?.email ?? '' }
  return {
    choice: 'not_needed',
    invoiceId: row.invoiceId,
    houseName: row.houseName,
    account: { jobId: row.jobId, houseId: row.houseId, row: { job_id: row.jobId, supply_house_id: row.houseId, status: 'not_needed', account_ref: '', opened_via: null, rep_contact_id: null, note: d.note.trim() }, flagInvoices: false },
  }
}

/** The saved line under the deck, after the row's title: what happened and where it shows. */
export function moveWindowTrailWords(w: MoveWindowWrites): string {
  if (w.choice === 'moved') return `moved onto the job account${w.account ? ` · the account opened by phone, ref ${w.account.row.account_ref}` : ''} · Accounts payable has it`
  if (w.choice === 'asked') return `asked ${w.sentTo} by email · follow up with a call until the house confirms`
  return `not needed · ${w.account.row.note} · the house roster has it, and the charge leaves the window`
}
