/**
 * A check that came back, as Accounts Receivable shows it (v2.4325, punch list #76 PR 3).
 *
 * The case rows come from `list_ar_return_cases` (20261001230000): the deposit, the
 * bank's reason, the source (bank · hand · rejected), the payments still carrying it,
 * the job it was on last, a hand-recorded payment it matches, the newest promise made
 * after it came back. The trail rows (`list_ar_deposit_trails`) add who applied it and
 * when. This kernel turns one case into what the list row and the pane say:
 *
 *   chip      came back · Insufficient funds  /  never reached the bank
 *   rowLine   off #878 since 9/24 · no new check in 8 days
 *   story     Sep 18 The check posted. · Sep 21 Taunya applied it to #878 … · Sep 23 The bank sent it back.
 *   stake     #878 owes the $13,680 again. It owes $38,625 in all.
 *   next      take it off · get a new check · deposit it again — one sentence, one button
 *   takeOff   the read-back before the one press: what comes off each job
 *
 * Every sentence follows src/lib/plainWords.ts. Pure; tested in arReturnCase.test.ts.
 */
import type { ArReturnCaseRow } from '../../../supabase/functions/_shared/bankReturnedDeposits'
import { appCalendarYmd } from '../../../supabase/functions/_shared/bankReturnedDeposits'
import type { ArDepositTrailRow } from './arDepositTrail'

export type { ArReturnCaseRow }

export type ArCaseNextKind = 'take_off' | 'new_check' | 'deposit_again' | 'settle'

export type ArCaseStoryLine = { ymd: string; day: string; text: string; tone?: 'bad' | 'good' }

export type ArCaseTakeOffJob = {
  jobId: string
  label: string
  amount: number
  /** "$11,181.78 comes off bill 2." */
  words: string
  /** A Stripe credit note or a bill Stripe holds as paid: the one press would be refused. */
  blocker: string | null
}

export type ArReturnCaseView = {
  id: string
  payer: string
  amount: number
  source: 'bank' | 'hand' | 'rejected'
  chip: { text: string; tone: 'red' | 'amber' }
  rowLine: string
  story: ArCaseStoryLine[]
  stake: { text: string; detail: string | null; jobId: string | null; tone: 'red' | 'amber' } | null
  next: { kind: ArCaseNextKind; sentence: string }
  /** The job the They said… button records a promise on, when there is one. */
  promiseJob: { jobId: string; label: string } | null
  takeOff: { jobs: ArCaseTakeOffJob[]; payments: number; summary: string; blocked: boolean } | null
  /** "When a $13,680 deposit from Southern Post lands, it shows here to pick." */
  watch: string | null
  /** A hand mark the bank never confirmed. */
  handNote: string | null
  /** The recorded payment a rejected check matches, for Take the $600 off #1040. */
  recorded: { paymentId: string; jobId: string; label: string; amount: number } | null
  /** Bills the check paid, for the replacement's allocation lines: invoice id → dollars. */
  billsItPaid: Array<{ invoiceId: string | null; jobId: string; amount: number }>
  daysOpen: number
  /** YYYY-MM-DD the bank sent it back (or Mercury refused it). */
  cameBackYmd: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function arCaseMoney(n: number): string {
  const abs = Math.abs(n)
  const cents = Math.round(abs * 100) % 100 !== 0
  return `$${abs.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** "Sep 18", or "Jul 11, 2025" outside today's year. */
export function arCaseDay(ymd: string | null | undefined, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  const month = MONTHS[Number(m[2]) - 1] ?? ''
  const sameYear = todayYmd.slice(0, 4) === m[1]
  return sameYear ? `${month} ${Number(m[3])}` : `${month} ${Number(m[3])}, ${m[1]}`
}

/** "9/24" for the short list line; "7/11/25" outside today's year. */
function shortSlash(ymd: string | null | undefined, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  const base = `${Number(m[2])}/${Number(m[3])}`
  return todayYmd.slice(0, 4) === m[1] ? base : `${base}/${(m[1] ?? '').slice(2)}`
}

function daysBetween(fromYmd: string | null, toYmd: string): number {
  if (!fromYmd) return 0
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** "#878 Take 5- Seguin" — the job's number and name as the office says them. */
export function arCaseJobLabel(j: { job_number?: string | null; job_name?: string | null }): string {
  const n = asText(j.job_number)
  const name = asText(j.job_name)
  return [n ? `#${n}` : null, name].filter(Boolean).join(' ') || 'a job'
}

function jobShort(j: { job_number?: string | null; job_name?: string | null }): string {
  const n = asText(j.job_number)
  return n ? `#${n}` : arCaseJobLabel(j)
}

function possessive(name: string): string {
  const n = name.trim()
  if (!n) return "the customer's"
  return /s$/i.test(n) ? `${n}'` : `${n}'s`
}

function billList(orders: number[]): string {
  const uniq = [...new Set(orders)].sort((a, b) => a - b).map((o) => String(o + 1))
  if (uniq.length === 0) return ''
  if (uniq.length === 1) return `bill ${uniq[0]}`
  return `bills ${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}`
}

function owed(j: { job_revenue?: number | string | null; job_payments_made?: number | string | null }): number {
  return Math.max(0, (Number(j.job_revenue) || 0) - (Number(j.job_payments_made) || 0))
}

/** The read-back before the one press: what comes off each job, biggest first. */
export function arCaseTakeOff(row: Pick<ArReturnCaseRow, 'live_payments'>): ArReturnCaseView['takeOff'] {
  const live = row.live_payments ?? []
  if (live.length === 0) return null
  const byJob = new Map<string, { label: string; short: string; amount: number; orders: number[]; paidBills: number[]; noBill: boolean; blocker: string | null; jobPaid: boolean }>()
  for (const p of live) {
    const prev =
      byJob.get(p.job_id) ??
      { label: arCaseJobLabel(p), short: jobShort(p), amount: 0, orders: [], paidBills: [], noBill: false, blocker: null, jobPaid: asText(p.job_status) === 'paid' }
    prev.amount += Math.abs(Number(p.amount) || 0)
    if (p.invoice_id && typeof p.invoice_sequence_order === 'number') {
      prev.orders.push(p.invoice_sequence_order)
      if (asText(p.invoice_status) === 'paid') prev.paidBills.push(p.invoice_sequence_order)
    } else prev.noBill = true
    if (p.stripe_credit_note) prev.blocker = `It sits on a Stripe bill as a part payment. Press Undo part payment on ${prev.short} first.`
    else if (p.stripe_bill && asText(p.invoice_status) === 'paid')
      prev.blocker = `${typeof p.invoice_sequence_order === 'number' ? `Bill ${p.invoice_sequence_order + 1}` : 'Its bill'} is marked paid in Stripe. Press Check didn't clear on it in ${prev.short} first.`
    byJob.set(p.job_id, prev)
  }
  const jobs: ArCaseTakeOffJob[] = [...byJob.entries()]
    .map(([jobId, j]) => {
      const where = j.orders.length > 0 && !j.noBill ? billList(j.orders) : 'the job'
      let words = `${arCaseMoney(j.amount)} comes off ${where}.`
      if (j.paidBills.length > 0) words += ` ${billList(j.paidBills).replace(/^b/, 'B')} ${j.paidBills.length === 1 ? 'goes' : 'go'} back to Billed.`
      if (j.jobPaid) words += ' The job goes back to Billed Awaiting Payment.'
      return { jobId, label: j.label, amount: j.amount, words, blocker: j.blocker }
    })
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
  const n = jobs.length
  const payments = live.length
  const summary = `${payments} payment${payments === 1 ? '' : 's'} on ${n} job${n === 1 ? '' : 's'}. Each job's history keeps the removal and who did it.`
  return { jobs, payments, summary, blocked: jobs.some((j) => j.blocker != null) }
}

export function arReturnCaseView(args: {
  row: ArReturnCaseRow
  trail: ReadonlyArray<ArDepositTrailRow>
  /** Today on the company calendar, YYYY-MM-DD. */
  todayYmd: string
}): ArReturnCaseView {
  const { row, trail, todayYmd } = args
  const source: ArReturnCaseView['source'] = row.source === 'rejected' ? 'rejected' : row.source === 'hand' ? 'hand' : 'bank'
  const payer = asText(row.counterparty_name) || 'The customer'
  const amount = Math.abs(Number(row.amount) || 0)
  const reason = asText(row.bank_reason)
  const last = row.last_job
  const rec = row.recorded_payment
  const cameBackYmd = appCalendarYmd(row.failed_at) ?? appCalendarYmd(row.opened_at)
  const daysOpen = daysBetween(cameBackYmd, todayYmd)
  const day = (ymd: string | null) => arCaseDay(ymd, todayYmd)

  const chip =
    source === 'rejected'
      ? { text: 'never reached the bank', tone: 'amber' as const }
      : { text: reason && source === 'bank' ? `came back · ${reason}` : 'came back', tone: 'red' as const }

  // The story, oldest first.
  const story: ArCaseStoryLine[] = []
  const postedYmd = appCalendarYmd(row.posted_at)
  if (postedYmd) story.push({ ymd: postedYmd, day: day(postedYmd), text: 'The check posted.' })
  const applied = new Map<string, { ymd: string; who: string; jobs: string[] }>()
  for (const t of trail) {
    const ymd = appCalendarYmd(t.applied_at)
    if (!ymd) continue
    const who = asText(t.applied_by)
    const key = `${ymd}|${who}`
    const g = applied.get(key) ?? { ymd, who, jobs: [] }
    const label = arCaseJobLabel({ job_number: t.job_number, job_name: t.job_name })
    if (!g.jobs.includes(label)) g.jobs.push(label)
    applied.set(key, g)
  }
  for (const g of applied.values()) {
    const jobs = g.jobs.length <= 2 ? g.jobs.join(' and ') : `${g.jobs.length} jobs`
    story.push({ ymd: g.ymd, day: day(g.ymd), text: `${g.who ? `${g.who} applied` : 'Applied'} it to ${jobs}.` })
  }
  if (rec && source !== 'bank') {
    const recYmd = asText(rec.paid_on).slice(0, 10)
    if (recYmd) story.push({ ymd: recYmd, day: day(recYmd), text: `${arCaseMoney(Number(rec.amount) || 0)} was recorded as paid on ${arCaseJobLabel(rec)}. No deposit is linked to it.` })
  }
  if (cameBackYmd) {
    if (source === 'rejected') story.push({ ymd: cameBackYmd, day: day(cameBackYmd), text: 'Mercury could not take this check in. It never posted.', tone: 'bad' })
    else if (source === 'hand') story.push({ ymd: cameBackYmd, day: day(cameBackYmd), text: 'It was marked returned by hand.', tone: 'bad' })
    else story.push({ ymd: cameBackYmd, day: day(cameBackYmd), text: `The bank sent it back.${reason ? ` ${reason}.` : ''}`, tone: 'bad' })
  }
  const removals = new Map<string, { ymd: string; who: string; jobs: string[] }>()
  for (const t of trail) {
    if (t.live || !t.removed_at) continue
    const ymd = appCalendarYmd(t.removed_at)
    if (!ymd) continue
    const who = asText(t.removed_by)
    const key = `${ymd}|${who}`
    const g = removals.get(key) ?? { ymd, who, jobs: [] }
    const label = jobShort({ job_number: t.job_number, job_name: t.job_name })
    if (!g.jobs.includes(label)) g.jobs.push(label)
    removals.set(key, g)
  }
  for (const g of removals.values()) {
    const jobs = g.jobs.length <= 2 ? g.jobs.join(' and ') : `${g.jobs.length} jobs`
    story.push({ ymd: g.ymd, day: day(g.ymd), text: `${g.who ? `${g.who} took` : 'It came'} it off ${jobs}.`.replace('It came it off', 'It came off') })
  }
  const promise = row.promise
  const promiseYmd = promise?.promised_date ? String(promise.promised_date).slice(0, 10) : null
  const promiseMadeYmd = appCalendarYmd(promise?.created_at ?? null)
  if (promise && promiseYmd && promiseMadeYmd) {
    const who = asText(promise.said_by)
    story.push({ ymd: promiseMadeYmd, day: day(promiseMadeYmd), text: `${who || 'They'} said the new check comes by ${day(promiseYmd)}.`, tone: 'good' })
  }
  story.sort((a, b) => a.ymd.localeCompare(b.ymd))

  // Where it sits, and what that costs.
  const takeOff = arCaseTakeOff(row)
  let stake: ArReturnCaseView['stake'] = null
  let rowLine: string
  let promiseJob: ArReturnCaseView['promiseJob'] = null
  const ago = daysOpen === 0 ? 'came back today' : null
  if (takeOff) {
    const n = takeOff.jobs.length
    stake = {
      text: n === 1 ? `${takeOff.jobs[0]!.label} still counts it as paid.` : `${n} jobs still count it as paid.`,
      detail: 'Their balances, the Pipeline and any lien notice read it as money in.',
      jobId: n === 1 ? takeOff.jobs[0]!.jobId : null,
      tone: 'red',
    }
    rowLine = `still on ${takeOff.jobs.map((j) => j.label.split(' ')[0]).join(', ')}`
  } else if (source === 'rejected' && rec) {
    const left = owed(rec)
    stake = {
      text: left <= 0.005 ? `${jobShort(rec)} reads paid in full. The money is not in the bank.` : `${jobShort(rec)} counts ${arCaseMoney(Number(rec.amount) || 0)} that is not in the bank.`,
      detail: null,
      jobId: rec.job_id,
      tone: 'amber',
    }
    rowLine = `never posted · ${jobShort(rec)} reads paid`
    promiseJob = { jobId: rec.job_id, label: arCaseJobLabel(rec) }
  } else if (last) {
    const left = owed(last)
    // The check's own money is what is owed again; a job that owes more says so in a second sentence.
    stake =
      left > 0.005
        ? {
            text: left > amount + 0.005 ? `${jobShort(last)} owes the ${arCaseMoney(amount)} again.` : `${jobShort(last)} owes ${arCaseMoney(left)} again.`,
            detail: left > amount + 0.005 ? `It owes ${arCaseMoney(left)} in all.` : null,
            jobId: last.job_id,
            tone: 'red',
          }
        : null
    const offYmd = appCalendarYmd(last.removed_at)
    const since = offYmd ? ` since ${shortSlash(offYmd, todayYmd)}` : ''
    rowLine = `off ${jobShort(last)}${since} · ${ago ?? (promiseYmd ? `they said ${shortSlash(promiseYmd, todayYmd)}` : `no new check in ${daysOpen} day${daysOpen === 1 ? '' : 's'}`)}`
    promiseJob = { jobId: last.job_id, label: arCaseJobLabel(last) }
  } else if (rec) {
    stake = { text: `${jobShort(rec)} still reads paid. ${arCaseMoney(Number(rec.amount) || 0)} was recorded there with no deposit.`, detail: null, jobId: rec.job_id, tone: 'amber' }
    rowLine = `${jobShort(rec)} reads paid · came back ${shortSlash(cameBackYmd, todayYmd)}`
    promiseJob = { jobId: rec.job_id, label: arCaseJobLabel(rec) }
  } else {
    rowLine = `on no job · ${ago ?? `came back ${shortSlash(cameBackYmd, todayYmd)}`}`
  }

  // The one next step.
  const stopped = /stop payment|payment stopped/i.test(reason)
  let next: ArReturnCaseView['next']
  if (takeOff) {
    next = { kind: 'take_off', sentence: takeOff.jobs.length === 1 ? 'Take it off the job it paid.' : `Take it off the ${takeOff.jobs.length} jobs it paid.` }
  } else if (source === 'rejected') {
    next = { kind: 'deposit_again', sentence: 'Find the check and deposit it again.' }
  } else if (promiseYmd) {
    next = { kind: 'new_check', sentence: `Waiting for the new check. ${asText(promise?.said_by) || 'They'} said ${day(promiseYmd)}.` }
  } else if (stopped) {
    next = { kind: 'new_check', sentence: `Ask ${payer} why they stopped it.${daysOpen > 0 ? ` It has been ${daysOpen} day${daysOpen === 1 ? '' : 's'}.` : ''}` }
  } else {
    next = { kind: 'new_check', sentence: `Get a new check from ${payer}.${daysOpen > 0 ? ` It has been ${daysOpen} day${daysOpen === 1 ? '' : 's'}.` : ''}` }
  }

  const watch =
    next.kind === 'take_off'
      ? null
      : `When a ${arCaseMoney(amount)} deposit from ${payer} lands, it shows here to pick.`

  const handNote = source === 'hand' ? `Marked returned by hand. The bank did not say ${possessive(payer)} check came back.` : null

  const billsItPaid = trail
    .filter((t) => !t.live)
    .map((t) => ({ invoiceId: t.invoice_id, jobId: t.job_id ?? '', amount: Math.abs(Number(t.amount) || 0) }))
    .filter((b) => b.jobId && b.amount > 0)

  return {
    id: row.mercury_transaction_id,
    payer,
    amount,
    source,
    chip,
    rowLine,
    story,
    stake,
    next,
    promiseJob,
    takeOff,
    watch,
    handNote,
    recorded: rec && source === 'rejected' ? { paymentId: rec.payment_id, jobId: rec.job_id, label: arCaseJobLabel(rec), amount: Math.abs(Number(rec.amount) || 0) } : null,
    billsItPaid,
    daysOpen,
    cameBackYmd,
  }
}

/** The first five letters of a payer's name — the SQL `_ar_payer_key` (20261001230000). */
export function arPayerKey(name: string | null | undefined): string | null {
  const letters = (name ?? '').replace(/[^A-Za-z]/g, '')
  return letters.length < 3 ? null : letters.slice(0, 5).toLowerCase()
}

export type ArReplacementDeposit = {
  mercury_transaction_id: string
  counterparty_name: string | null
  amount: number | string | null
  posted_at: string | null
  remaining_available: number | string | null
}

/**
 * The deposit that looks like the new check: untouched, the same amount to the
 * cent, from the same payer, posted after the check came back. Oldest first.
 */
export function arReplacementFor(view: Pick<ArReturnCaseView, 'id' | 'payer' | 'amount' | 'cameBackYmd'>, deposits: ReadonlyArray<ArReplacementDeposit>): ArReplacementDeposit | null {
  const key = arPayerKey(view.payer)
  if (!key) return null
  const cents = Math.round(view.amount * 100)
  const matches = deposits.filter((d) => {
    if (d.mercury_transaction_id === view.id) return false
    if (arPayerKey(d.counterparty_name) !== key) return false
    if (Math.round(Math.abs(Number(d.amount) || 0) * 100) !== cents) return false
    if (Math.round((Number(d.remaining_available) || 0) * 100) !== cents) return false
    const posted = appCalendarYmd(d.posted_at)
    return !view.cameBackYmd || (posted != null && posted >= view.cameBackYmd)
  })
  matches.sort((a, b) => String(a.posted_at ?? '').localeCompare(String(b.posted_at ?? '')))
  return matches[0] ?? null
}

/** The open case a deposit may replace — the reverse of arReplacementFor. */
export function arCaseThisReplaces(deposit: ArReplacementDeposit, views: ReadonlyArray<ArReturnCaseView>): ArReturnCaseView | null {
  for (const v of views) {
    if (v.next.kind === 'take_off') continue
    const r = arReplacementFor(v, [deposit])
    if (r) return v
  }
  return null
}

/** The header's words: "2 came back". */
export function arCameBackCount(n: number): string {
  return `${n} came back`
}
