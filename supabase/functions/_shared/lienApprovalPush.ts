// The words of the push (or the email) a leader gets when the office sends a lien notice for his
// approval (v2.4872). Shared by notify-lien-approval and the client's test, so the two say the same
// thing. One line: the job, the money, the mail-by day. The tap lands on the job in the desk's
// Awaiting approval pile. Pure: no env reads, no network.
import { todayYmdInAppTz } from './appTimeZone.ts'

/**
 * The day he signed, YYYY-MM-DD in the app's zone, from the row's `signed_at` (v2.6006): a stored instant's day is
 * its Central day, never its first ten characters, which are the UTC day — tomorrow for a signature after 7 PM
 * Central (docs/TIME_AND_ZONES.md). Null when the value is not an instant.
 */
export function signedYmdOf(signedAt: string | null | undefined): string | null {
  const ms = Date.parse(signedAt ?? '')
  return Number.isFinite(ms) ? todayYmdInAppTz(new Date(ms)) : null
}

export type LienApprovalPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The GC the money is owed by; null when unknown. */
  gcName: string | null
  /** The day the notice must be in the mail, YYYY-MM-DD; null when the client did not say. */
  dueYmd: string | null
  /** Today in the app's time zone, YYYY-MM-DD. */
  todayYmd: string
  /** Who sent it for approval; null when the item has no drafter. */
  senderName: string | null
}

export type LienApprovalPush = { title: string; body: string; url: string; tag: string; subject: string; emailText: string }

/** The door that exists: the desk, narrowed to what waits on him, opened on this job (v2.4586 / v2.4854). */
export function lienApprovalUrl(jobId: string): string {
  return `/lien-desk?tab=notices&job=${encodeURIComponent(jobId)}&pile=awaiting`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 15" from "2026-10-15"; null when the day is not a date. */
export function shortDay(ymd: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return null
  return `${month} ${Number(m[3])}`
}

/** Whole days from today to the day; null when either is not a date. */
export function daysUntil(ymd: string | null, todayYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null
  return Math.round((Date.UTC(+ymd!.slice(0, 4), +ymd!.slice(5, 7) - 1, +ymd!.slice(8, 10)) - Date.UTC(+todayYmd.slice(0, 4), +todayYmd.slice(5, 7) - 1, +todayYmd.slice(8, 10))) / 86_400_000)
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function lienApprovalPush(input: LienApprovalPushInput): LienApprovalPush {
  const first = (input.senderName ?? '').trim().split(/\s+/)[0] || null
  const owed = input.claim != null && input.claim > 0 ? `${money(input.claim)}${input.gcName ? ` owed by ${input.gcName}` : ''}` : null
  const day = shortDay(input.dueYmd)
  const days = daysUntil(input.dueYmd, input.todayYmd)
  const mailBy = day ? `mail by ${day}${days != null && days >= 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}` : null
  const body = [input.jobLabel, owed, mailBy].filter(Boolean).join(' · ')
  const title = 'Approve a lien notice'
  const lines = [
    `${first ?? 'The office'} sent a lien notice for your approval.`,
    '',
    input.jobLabel,
    owed ? (owed.endsWith('.') ? owed : `${owed}.`) : null,
    day ? `Mail by ${day}${days != null && days >= 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} from now` : ''}.` : null,
    '',
    'Open the Lien desk to approve it or hold it.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienApprovalUrl(input.jobId), tag: `lien-approval-${input.jobId}`, subject: `Approve a lien notice · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienPenRecordedPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The day the office says he signed, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Who wrote it down; null when unknown. */
  recorderName: string | null
  /** How the office knows: watched, told, or page. */
  how: string | null
}

/** The door that exists: the desk opened on this job in the Ready pile, where Yes, I signed it ▸ sits (the pen train, PR 3). */
export function lienPenRecordedUrl(jobId: string): string {
  return `/lien-desk?tab=notices&job=${encodeURIComponent(jobId)}&pile=ready`
}

/**
 * The words the leader gets when the office writes down his pen signature (the pen train, PR 3):
 * one line, the job, the money, the day, who wrote it down. The tap lands on the notice, where
 * Yes, I signed it ▸ and Not what I signed sit. Nothing waits on his answer.
 */
export function lienPenRecordedPush(input: LienPenRecordedPushInput): LienApprovalPush {
  const first = (input.recorderName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'The office'
  const owed = input.claim != null && input.claim > 0 ? money(input.claim) : null
  const day = shortDay(input.signedYmd)
  const howWords = input.how === 'watched' ? `${who} watched you sign` : input.how === 'page' ? `${who} has the signed page` : `${who} says you told them`
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, howWords].filter(Boolean).join(' · ')
  const title = `${who} recorded your pen signature`
  const lines = [
    `${who} recorded that you signed a lien notice with a pen.`,
    '',
    input.jobLabel,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    `${howWords}.`,
    '',
    'Open the Lien desk and press Yes, I signed it, or Not what I signed. Nothing waits on your answer.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienPenRecordedUrl(input.jobId), tag: `lien-pen-${input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienCodeUsedPushInput = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The claim on the draft, dollars; null when the draft has none. */
  claim: number | null
  /** The day the code signed it, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Whose screen the code was typed on; null when unknown. */
  deviceName: string | null
}

/**
 * The words the leader gets when his signing code signs a notice on someone else's screen
 * (v2.5791, punch list #150): one line, the job, the money, the day, whose screen. The tap lands on
 * the notice in Ready, where Yes, it was me ▸ and Not me sit. Nothing waits on his answer; a code
 * that was not his is cleared there and changed under Settings, Your account.
 */
export function lienCodeUsedPush(input: LienCodeUsedPushInput): LienApprovalPush {
  const first = (input.deviceName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'the office'
  const owed = input.claim != null && input.claim > 0 ? money(input.claim) : null
  const day = shortDay(input.signedYmd)
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, `on ${who}’s screen`].filter(Boolean).join(' · ')
  const title = 'Your signing code signed a lien notice'
  const lines = [
    `Your signing code was typed on ${who}’s screen to sign a lien notice.`,
    '',
    input.jobLabel,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    '',
    'Open the Lien desk and press Yes, it was me, or Not me. Nothing waits on your answer.',
    'If that was not you, change your code under Settings, Your account.',
  ].filter((l) => l !== null) as string[]
  return { title, body, url: lienPenRecordedUrl(input.jobId), tag: `lien-code-${input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}

export type LienWaiverCodeUsedPushInput = {
  /** "878 · Take 5 Seguin"; a bid's waiver, "Bid 482 · Take 5 Seguin" (v2.5958) */
  jobLabel: string
  jobId: string
  /** v2.5958: the waiver was made on this bid (Bids → Lien Release), not a job; the tap lands on the bid's tab. */
  bidId?: string | null
  /** The waiver's amount, dollars; null when the row has none. */
  amount: number | null
  /** "Conditional Waiver and Release on Final Payment" — the form's title; null when unknown. */
  formTitle: string | null
  /** The day the code signed it, YYYY-MM-DD; null when it is not a date. */
  signedYmd: string | null
  /** Whose screen the code was typed on; null when unknown. */
  deviceName: string | null
}

/**
 * The words the leader gets when his signing code signs a lien WAIVER on someone else's screen
 * (v2.5924): one line, the job, the money, the day, whose screen. The tap lands on the Pipeline,
 * where the job's Release of Lien window holds the signed waiver under Already on this job. A code
 * that was not his is changed under Settings, Your account; the office can void the waiver.
 * A bid's waiver (v2.5958) lands on that bid's Lien Release tab, under Already on this bid.
 */
export function lienWaiverCodeUsedPush(input: LienWaiverCodeUsedPushInput): LienApprovalPush {
  const first = (input.deviceName ?? '').trim().split(/\s+/)[0] || null
  const who = first ?? 'the office'
  const owed = input.amount != null && input.amount > 0 ? money(input.amount) : null
  const day = shortDay(input.signedYmd)
  const body = [input.jobLabel, owed, day ? `signed ${day}` : null, `on ${who}’s screen`].filter(Boolean).join(' · ')
  const title = 'Your signing code signed a lien waiver'
  const lines = [
    `Your signing code was typed on ${who}’s screen to sign a release of lien.`,
    '',
    input.jobLabel,
    input.formTitle ? `${input.formTitle}.` : null,
    owed ? `${owed}.` : null,
    day ? `Signed ${day}.` : null,
    '',
    input.bidId
      ? 'The signed waiver sits on the bid, in the Lien Release tab under Already on this bid.'
      : 'The signed waiver sits on the job, in the Release of Lien window under Already on this job.',
    'If that was not you, change your code under Settings, Your account, and have the office void the waiver.',
  ].filter((l) => l !== null) as string[]
  const url = input.bidId ? `/bids?tab=lien-release&bidId=${encodeURIComponent(input.bidId)}` : '/jobs?tab=stages'
  return { title, body, url, tag: `lien-waiver-code-${input.bidId ?? input.jobId}`, subject: `${title} · ${input.jobLabel}`, emailText: lines.join('\n') }
}

// ---------- an affidavit sent for approval (punch list #305, v2.7180) ----------

export type LienAffidavitApprovalPaper = {
  /** "891 · Take 5 Liberty Hill" */
  jobLabel: string
  jobId: string
  /** The last day the affidavit can be filed, YYYY-MM-DD; null when the client did not say. */
  fileByYmd: string | null
}

export type LienAffidavitApprovalPushInput = {
  /** Every paper this leader is asked about in one press: one for the pane's own send, many for the list's. */
  papers: ReadonlyArray<LienAffidavitApprovalPaper>
  /** Today in the app's time zone, YYYY-MM-DD. */
  todayYmd: string
  /** Who sent them for approval; null when unknown. */
  senderName: string | null
}

/** The door that exists: the desk's Affidavits list, opened on the job when the push is about one paper. */
export function lienAffidavitApprovalUrl(jobId: string | null): string {
  return jobId ? `/lien-desk?tab=affidavits&job=${encodeURIComponent(jobId)}` : '/lien-desk?tab=affidavits'
}

/** The papers with the soonest day first; a paper with no day goes last, and a tie keeps the order given. */
function soonestFirst(papers: ReadonlyArray<LienAffidavitApprovalPaper>): LienAffidavitApprovalPaper[] {
  const key = (p: LienAffidavitApprovalPaper) => (shortDay(p.fileByYmd) ? (p.fileByYmd as string) : '9999-99-99')
  return papers.map((paper, i) => ({ paper, i })).sort((a, b) => key(a.paper).localeCompare(key(b.paper)) || a.i - b.i).map((x) => x.paper)
}

/**
 * The words the leader gets when the office sends an affidavit for his approval: the job, the last day to file, and
 * what he is asked to do. A notice's words name its claim and its mail-by day (`lienApprovalPush`); an affidavit is
 * filed with the county, so its day is the day to file by, after which the lien right ends.
 *
 * The batch rule: every paper of one press is one message. Twelve papers are one push that names the count, with the
 * soonest day, and the email lists each job beside its own day. A day that has passed is named without a count.
 */
export function lienAffidavitApprovalPush(input: LienAffidavitApprovalPushInput): LienApprovalPush {
  const who = (input.senderName ?? '').trim().split(/\s+/)[0] || 'The office'
  const papers = soonestFirst(input.papers)
  const head = papers[0] ?? { jobLabel: 'A job', jobId: '', fileByYmd: null }
  const day = shortDay(head.fileByYmd)
  const left = day ? daysUntil(head.fileByYmd, input.todayYmd) : null
  const short = left == null || left < 0 ? null : left === 0 ? 'today' : `${left} ${left === 1 ? 'day' : 'days'}`
  const long = left == null || left < 0 ? '.' : left === 0 ? '. That is today.' : `, ${short} from now.`
  if (papers.length <= 1) {
    const title = 'Approve a lien affidavit'
    const lines = [
      `${who} sent a lien affidavit for your approval.`,
      '',
      head.jobLabel,
      day ? `File by ${day}${long}` : null,
      day ? 'The lien right ends after that day.' : null,
      '',
      'Open the Lien desk to approve it or hold it.',
    ].filter((l) => l !== null) as string[]
    return {
      title,
      body: [head.jobLabel, day ? `file by ${day}` : null, short].filter(Boolean).join(' · '),
      url: lienAffidavitApprovalUrl(head.jobId || null),
      tag: `lien-affidavit-approval-${head.jobId}`,
      subject: `${title} · ${head.jobLabel}`,
      emailText: lines.join('\n'),
    }
  }
  const n = papers.length
  const title = `Approve ${n} lien affidavits`
  const lines = [
    `${who} sent ${n} lien affidavits for your approval.`,
    '',
    ...papers.map((p) => {
      const d = shortDay(p.fileByYmd)
      return d ? `${p.jobLabel} · file by ${d}` : p.jobLabel
    }),
    '',
    day ? `The first must be filed by ${day}${long}` : null,
    day ? 'The lien right on a job ends after its day.' : null,
    day ? '' : null,
    'Open the Lien desk to approve each one or hold it.',
  ].filter((l) => l !== null) as string[]
  return {
    title,
    body: [`${n} jobs`, day ? `first to file by ${day}` : null, short].filter(Boolean).join(' · '),
    url: lienAffidavitApprovalUrl(null),
    // One press, one message: a later press is its own message and never replaces this one.
    tag: `lien-affidavit-approval-${n}-${head.jobId}`,
    subject: title,
    emailText: lines.join('\n'),
  }
}

/**
 * One message for each leader, whatever the count: the papers of one press, grouped by who is asked. A job's leader
 * is asked about that job's paper; a job with no leader of its own asks every leader. Leaders come out in the order
 * they are first named, each with his papers in the order given.
 */
export function lienAffidavitTellsByLeader<P>(papers: ReadonlyArray<{ paper: P; leaderIds: ReadonlyArray<string> }>): Array<{ leaderId: string; papers: P[] }> {
  const byLeader = new Map<string, P[]>()
  for (const { paper, leaderIds } of papers) {
    for (const id of new Set(leaderIds)) {
      const list = byLeader.get(id)
      if (list) list.push(paper)
      else byLeader.set(id, [paper])
    }
  }
  return [...byLeader.entries()].map(([leaderId, list]) => ({ leaderId, papers: list }))
}

/** How many papers one press may name; a request over it is cut to the first of them. */
export const LIEN_AFFIDAVIT_ASK_MAX = 100

/**
 * The papers a request names: `items: [{ item_id, due_ymd }]`. Each id once, a day kept only when it is a date, and
 * anything that is not a paper left out. The day is the only thing a caller may say about a paper.
 */
export function lienAffidavitAskItems(raw: unknown): Array<{ itemId: string; fileByYmd: string | null }> {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Array<{ itemId: string; fileByYmd: string | null }> = []
  for (const r of raw) {
    const o = (r && typeof r === 'object' ? r : {}) as { item_id?: unknown; due_ymd?: unknown }
    const itemId = typeof o.item_id === 'string' ? o.item_id.trim() : ''
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({ itemId, fileByYmd: typeof o.due_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.due_ymd) ? o.due_ymd : null })
    if (out.length >= LIEN_AFFIDAVIT_ASK_MAX) break
  }
  return out
}

/** How long after the send for approval the leader may be told of it: the press's own call, never a later one. */
export const LIEN_AFFIDAVIT_ASK_FRESH_MS = 15 * 60_000

/**
 * Whether the leader is told of this row: an affidavit on the desk, waiting for his approval, sent for it in the last
 * fifteen minutes. A paper a standing rule approved or held, a notice, a voided row and an old send are all left out,
 * so the call can only repeat what the desk just did.
 */
export function lienAffidavitAskable(row: { kind?: string | null; status?: string | null; voided_at?: string | null; submitted_at?: string | null } | null | undefined, nowMs: number): boolean {
  if (!row || row.kind !== 'affidavit' || row.status !== 'awaiting_approval' || row.voided_at) return false
  const sent = Date.parse(row.submitted_at ?? '')
  return Number.isFinite(sent) && nowMs - sent <= LIEN_AFFIDAVIT_ASK_FRESH_MS && sent - nowMs <= LIEN_AFFIDAVIT_ASK_FRESH_MS
}
