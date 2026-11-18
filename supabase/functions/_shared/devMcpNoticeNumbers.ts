// The mail number of each envelope of a lien notice already on record, set from the dev seat (the owner, 2026-11-17:
// "help me enter these numbers into the lien desk, and if there are not dev verbs to make it easy, add dev verbs").
//
// A recorded § 53.056 or § 53.057 notice keeps one send for each recipient in `job_lien_filings.sends`, and each
// envelope carries its own certified mail number. The desk's Already mailed? Record it… has one number box and writes
// it on every recipient's send, and a run can be recorded before the post office hands the numbers back. The app's
// door for the number is add the number › (src/components/jobs/LienTrackingOwedEditor.tsx): one update of the
// filing's `sends` through `withTracking`, offered only on a send whose number is blank.
//
// plan_notice_numbers → apply_notice_numbers is that door, for the owner's copy, the original contractor's or both,
// and it also replaces a number already there or takes one off, which the app's door does not. The write is the
// door's own: `sends` on the filing's row, through the mirror of `withTracking`, as the dev under RLS. Nothing else
// on the row changes, the day mailed included, and the table's one trigger fires on an insert alone, so nobody is
// emailed, no release is issued and no line is added to the job's Activity.
//
// A plan takes one notice or several, each with its own verdict and its own hash; an apply takes one.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpNoticeNumbers.test.ts).

import { LIEN_SEND_RECIPIENT_WORDS, parseLienSends, sendsTrackingOwed, withTracking, type LienSendLike } from './gcKernels/lib/jobs/lienSendTracking.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'

export const NOTICE_NUMBERS_VERBS = ['plan_notice_numbers', 'apply_notice_numbers'] as const
export type NoticeNumbersVerb = (typeof NOTICE_NUMBERS_VERBS)[number]
export function isNoticeNumbersVerb(name: string): name is NoticeNumbersVerb {
  return (NOTICE_NUMBERS_VERBS as readonly string[]).includes(name)
}

/** The most notices one plan takes: a trip to the post office. */
export const NOTICE_NUMBERS_PLAN_MAX = 20
export const NOTICE_NUMBERS_TRACKING_MAX = 80
/** The two papers that are a notice. An affidavit's copies are plan_lien_service's. */
export const NOTICE_NUMBERS_KINDS = ['notice_53_056', 'retainage_53_057'] as const
export type NoticeNumbersKind = (typeof NOTICE_NUMBERS_KINDS)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const SHA_RE = /^[0-9a-f]{64}$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export type NoticeNumbersCopy = 'owner' | 'original_contractor'
const COPIES: readonly NoticeNumbersCopy[] = ['owner', 'original_contractor']
const PAPER_WORDS: Record<string, string> = { notice_53_056: 'the monthly notice (§ 53.056)', retainage_53_057: 'the retainage notice (§ 53.057)' }
const who = (copy: NoticeNumbersCopy): string => LIEN_SEND_RECIPIENT_WORDS[copy] ?? copy

export type NoticeNumbersPayload = {
  action: 'notice_numbers'
  job_id: string
  /** The months the notice names, to tell one notice of a job from another. Null: the job's one notice. */
  months: string[] | null
  paper: NoticeNumbersKind | null
  /** The day the paper went, as a check against the record. This verb never moves the day. */
  sent_on: string | null
  /** Each copy's number as given, '' to take the number off; null leaves that copy alone. */
  owner: string | null
  contractor: string | null
}

const SHAPE =
  'a notice is { job_id (a jobs_ledger.id — find_job), owner?: { tracking }, contractor?: { tracking } (the mail number on that envelope’s label; "" takes a number off, so the copy reads tracking owed), months?: [YYYY-MM] (the months the notice names, when the job holds more than one notice), paper?: monthly | retainage, sent_on?: YYYY-MM-DD (the day it was mailed, checked against the record and never changed) }'

function copyShape(src: unknown, key: string): { ok: true; tracking: string | null } | { ok: false; error: string } {
  if (src === undefined || src === null) return { ok: true, tracking: null }
  const c = obj(src)
  if (!c || typeof c.tracking !== 'string') return { ok: false, error: `${key} is { tracking }: the mail number on that envelope’s label, or "" to take the number off.` }
  const tracking = c.tracking.trim().replace(/\s+/g, ' ')
  if (tracking.length > NOTICE_NUMBERS_TRACKING_MAX) return { ok: false, error: `${key}.tracking is the mail number on the label, at most ${NOTICE_NUMBERS_TRACKING_MAX} characters.` }
  return { ok: true, tracking }
}

/** One notice's shape, checked. Whether the record takes it is the dry run's to say. */
export function noticeNumbersShape(src: unknown): { ok: true; p: NoticeNumbersPayload } | { ok: false; error: string } {
  const s = obj(src)
  if (!s) return { ok: false, error: SHAPE }
  const jobId = str(s.job_id).toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: `job_id is not a jobs_ledger.id (find_job resolves a number or a name). ${SHAPE}` }
  let months: string[] | null = null
  if (s.months !== undefined && s.months !== null) {
    if (!Array.isArray(s.months) || s.months.length < 1 || !s.months.every((m) => typeof m === 'string' && MONTH_RE.test(m.trim()))) return { ok: false, error: 'months is the months the notice names, each YYYY-MM, as [“2026-07”, “2026-08”].' }
    months = [...new Set((s.months as string[]).map((m) => m.trim()))].sort()
  }
  let paper: NoticeNumbersKind | null = null
  if (s.paper !== undefined && s.paper !== null) {
    paper = s.paper === 'monthly' ? 'notice_53_056' : s.paper === 'retainage' ? 'retainage_53_057' : null
    if (!paper) return { ok: false, error: 'paper is monthly (the § 53.056 notice) or retainage (the § 53.057 notice).' }
  }
  let sentOn: string | null = null
  if (s.sent_on !== undefined && s.sent_on !== null) {
    sentOn = str(s.sent_on)
    if (!YMD_RE.test(sentOn) || Number.isNaN(new Date(`${sentOn}T12:00:00Z`).getTime())) return { ok: false, error: 'sent_on is the day the notice was mailed, YYYY-MM-DD.' }
  }
  const owner = copyShape(s.owner, 'owner')
  if (!owner.ok) return owner
  const contractor = copyShape(s.contractor, 'contractor')
  if (!contractor.ok) return contractor
  if (owner.tracking === null && contractor.tracking === null) return { ok: false, error: `Name a copy: owner, contractor or both. ${SHAPE}` }
  return { ok: true, p: { action: 'notice_numbers', job_id: jobId, months, paper, sent_on: sentOn, owner: owner.tracking, contractor: contractor.tracking } }
}

export type NoticeNumbersPlanInput = { ok: true; notices: Array<{ ok: true; p: NoticeNumbersPayload } | { ok: false; error: string }>; target: string } | { ok: false; error: string }

/** plan_notice_numbers's input: `notice` (one) or `notices` (a trip to the post office), each shaped on its own. */
export function noticeNumbersPlanInput(input: Json): NoticeNumbersPlanInput {
  const many = Array.isArray(input.notices) ? (input.notices as unknown[]) : null
  const one = obj(input.notice)
  if (many && one) return { ok: false, error: 'plan_notice_numbers takes notice (one) or notices (a list), not both.' }
  const list = many ?? (one ? [one] : null)
  if (!list || list.length < 1) return { ok: false, error: `plan_notice_numbers needs notice or notices — ${SHAPE}.` }
  if (list.length > NOTICE_NUMBERS_PLAN_MAX) return { ok: false, error: `plan_notice_numbers takes at most ${NOTICE_NUMBERS_PLAN_MAX} notices a call; this one carries ${list.length}. Plan the rest in a second call.` }
  const notices = list.map((n) => noticeNumbersShape(n))
  const first = notices.find((n): n is { ok: true; p: NoticeNumbersPayload } => n.ok)
  return { ok: true, notices, target: list.length === 1 && first ? first.p.job_id : `${list.length} notices` }
}

export type NoticeNumbersApplyInput = { ok: true; p: NoticeNumbersPayload; target: string; planHash: string } | { ok: false; error: string }

/** apply_notice_numbers's input: one notice, as planned, and its own plan hash. */
export function noticeNumbersApplyInput(input: Json): NoticeNumbersApplyInput {
  if (Array.isArray(input.notices)) return { ok: false, error: 'apply_notice_numbers applies one notice a call: send notice (the entry as you planned it) with that entry’s own plan_hash.' }
  const shaped = noticeNumbersShape(input.notice)
  if (!shaped.ok) return { ok: false, error: `apply_notice_numbers needs notice — ${shaped.error}` }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!SHA_RE.test(h)) return { ok: false, error: 'apply_notice_numbers needs plan_hash — the 64-hex value plan_notice_numbers gave this notice.' }
  return { ok: true, p: shaped.p, target: shaped.p.job_id, planHash: h }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type NoticeNumbersReads = { rows(table: string, query: string): Promise<Json[]> }

export const NOTICE_NUMBERS_JOB_COLS = 'id,job_name,job_address,hcp_number,click_number'
export const NOTICE_NUMBERS_FILING_COLS = 'id,job_id,kind,months_covered,sends,by_hand,packet_id,applied_from,created_at'

export type NoticeNumbersJob = { id: string; job_name: string | null; job_address: string | null; hcp_number: string | null; click_number: string | null }
export type NoticeNumbersFiling = { id: string; job_id: string; kind: string; months: string[]; sends: unknown; by_hand: boolean; packet_id: string | null; applied_from: string | null }
/** Another live filing that matters to this one: a job on the same paper, or a filing that already holds a number. */
export type NoticeNumbersOther = { filing_id: string; job: string; sends: LienSendLike[] }

export type NoticeNumbersWorld = {
  job: NoticeNumbersJob | null
  /** The job's live notices, newest first, an applied row included (the pick leaves it out and says so). */
  notices: NoticeNumbersFiling[]
  /** The other live filings of the picked notice's packet: one paper recorded on several jobs. */
  paperMates: NoticeNumbersOther[]
  /** Other live filings that already hold a number this call gives. */
  elsewhere: NoticeNumbersOther[]
  /** The desk item the picked notice marked sent, for the plan's words alone. */
  item: { status: string; sent_at: string | null } | null
}

export const noticeNumbersFilingOf = (r: Json): NoticeNumbersFiling => ({
  id: str(r.id),
  job_id: str(r.job_id),
  kind: str(r.kind),
  months: Array.isArray(r.months_covered) ? (r.months_covered as unknown[]).filter((m): m is string => typeof m === 'string').sort() : [],
  sends: r.sends,
  by_hand: r.by_hand === true,
  packet_id: str(r.packet_id) || null,
  applied_from: str(r.applied_from) || null,
})

/** The first day a filing's sends name: the day the paper went. */
function mailedOn(sends: unknown): string | null {
  const days = parseLienSends(sends)
    .map((s) => s.sent_on ?? '')
    .filter((d) => YMD_RE.test(d))
    .sort()
  return days[0] ?? null
}

const noticeWords = (f: NoticeNumbersFiling): string => `${PAPER_WORDS[f.kind] ?? f.kind} for ${f.months.length > 0 ? f.months.join(', ') : 'no month'}${mailedOn(f.sends) ? `, mailed ${mailedOn(f.sends)}` : ''}`

export type NoticeNumbersPick = { ok: true; filing: NoticeNumbersFiling } | { ok: false; refused: string }

/**
 * Which of the job's notices the call means. A row applied from another job's paper is not a mailing of its own, so
 * it is never picked. One notice left is the answer; several are told apart by `months` and `paper`.
 */
export function noticeNumbersPick(p: Pick<NoticeNumbersPayload, 'months' | 'paper'>, notices: ReadonlyArray<NoticeNumbersFiling>, label: string): NoticeNumbersPick {
  const own = notices.filter((n) => !n.applied_from)
  if (own.length === 0) {
    if (notices.length > 0) return { ok: false, refused: `${label}: the notice on record here stands for a paper recorded on another job. Set the numbers on the job the paper was recorded on.` }
    return { ok: false, refused: `${label}: no lien notice is on record for this job, so there is no envelope to put a number on. Record the mailing first: the Lien desk’s run, or plan_notice_by_hand for a paper that already went.` }
  }
  const fits = own.filter((n) => (!p.paper || n.kind === p.paper) && (!p.months || (n.months.length === p.months.length && n.months.every((m, i) => m === p.months![i]))))
  const one = fits.length === 1 ? fits[0] : undefined
  if (one) return { ok: true, filing: one }
  const list = own.map((n) => noticeWords(n)).join(' · ')
  if (fits.length === 0) return { ok: false, refused: `${label}: no notice on record matches ${[p.paper ? PAPER_WORDS[p.paper] : '', p.months ? `the months ${p.months.join(', ')}` : ''].filter(Boolean).join(' for ')}. On record: ${list}.` }
  return { ok: false, refused: `${label}: ${fits.length} notices on record match, and each has its own envelopes. Say which with months${p.paper ? '' : ' or paper'}. On record: ${list}.` }
}

const digitsOf = (s: string): string => s.replace(/\D/g, '')

/**
 * A USPS number's last digit is computed from the others: from the right, the digits before it weigh 3, 1, 3, 1…,
 * and the last digit brings the sum to a ten. The cheapest test of a number read off a label by eye.
 */
export function uspsCheckDigitOk(number: string): boolean {
  const d = digitsOf(number)
  if (d.length < 2) return false
  let sum = 0
  for (let i = d.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w
  return (10 - (sum % 10)) % 10 === Number(d[d.length - 1])
}

/** The world a plan or an apply reads: the job, its live notices, and what the picked notice touches. */
export async function readNoticeNumbersWorld(reads: NoticeNumbersReads, p: NoticeNumbersPayload): Promise<NoticeNumbersWorld> {
  const job = ((await reads.rows('jobs_ledger', `select=${NOTICE_NUMBERS_JOB_COLS}&id=eq.${p.job_id}`))[0] as NoticeNumbersJob | undefined) ?? null
  if (!job) return { job: null, notices: [], paperMates: [], elsewhere: [], item: null }
  const notices = (await reads.rows('job_lien_filings', `select=${NOTICE_NUMBERS_FILING_COLS}&job_id=eq.${job.id}&kind=in.(${NOTICE_NUMBERS_KINDS.join(',')})&voided_at=is.null&order=created_at.desc&limit=50`)).map(noticeNumbersFilingOf)
  const pick = noticeNumbersPick(p, notices, jobLabelOf(job))
  if (!pick.ok) return { job, notices, paperMates: [], elsewhere: [], item: null }
  const filing = pick.filing
  const others: Json[] = []
  if (filing.packet_id) others.push(...(await reads.rows('job_lien_filings', `select=id,job_id,sends,packet_id&packet_id=eq.${filing.packet_id}&voided_at=is.null&limit=50`)))
  // A label is on one envelope: any other live filing that already holds a number this call gives.
  const given = [...new Set([p.owner, p.contractor].filter((t): t is string => !!t).flatMap((t) => [t, digitsOf(t)]).filter(Boolean))]
  const held: Json[] = []
  for (const t of given) held.push(...(await reads.rows('job_lien_filings', `select=id,job_id,sends&voided_at=is.null&sends=cs.${encodeURIComponent(JSON.stringify([{ tracking: t }]))}&limit=20`)))
  const jobIds = [...new Set([...others, ...held].map((r) => str(r.job_id)).filter((id) => id && id !== job.id))]
  const labels = new Map<string, string>([[job.id, jobLabelOf(job)]])
  if (jobIds.length > 0) for (const j of (await reads.rows('jobs_ledger', `select=${NOTICE_NUMBERS_JOB_COLS}&id=in.(${jobIds.join(',')})`)) as NoticeNumbersJob[]) labels.set(String(j.id), jobLabelOf(j))
  const otherOf = (r: Json): NoticeNumbersOther => ({ filing_id: str(r.id), job: labels.get(str(r.job_id)) ?? str(r.job_id), sends: parseLienSends(r.sends) })
  const seen = new Set<string>([filing.id])
  const uniq = (rows: Json[]): NoticeNumbersOther[] => rows.filter((r) => str(r.id) && !seen.has(str(r.id)) && !!seen.add(str(r.id))).map(otherOf)
  const paperMates = uniq(others)
  const elsewhere = uniq(held)
  const itemRow = (await reads.rows('job_lien_desk_items', `select=id,status,sent_at&sent_filing_id=eq.${filing.id}&voided_at=is.null&limit=1`))[0]
  return { job, notices, paperMates, elsewhere, item: itemRow ? { status: str(itemRow.status), sent_at: str(itemRow.sent_at) || null } : null }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type NoticeNumbersWrite = { filingId: string; sends: LienSendLike[]; set: Array<{ copy: NoticeNumbersCopy; tracking: string }> }
export type NoticeNumbersDryRun = { ok: true; reply: Json; write: NoticeNumbersWrite } | { ok: false; refused: string }

const METHOD_WORDS: Record<string, string> = { certified_mail: 'certified mail', traceable_courier: 'a courier', mail: 'plain mail', email: 'email', hand: 'hand' }

/**
 * What the plan says and what the hash commits to: the job and the notice, each copy before and after, the `sends`
 * the row will hold, and what the eye should check (a check digit that fails, one number on both envelopes, a number
 * another notice already holds, the other jobs on the same paper). Refuses a job not visible, a job with no notice
 * or several that fit, a day that is not the record's, a copy the record does not name, a copy that did not go by
 * certified mail or courier, a copy a mail provider carries, a certified number that is not 20 or 22 digits, and a
 * call that changes nothing.
 */
export function noticeNumbersDryRun(p: NoticeNumbersPayload, world: NoticeNumbersWorld): NoticeNumbersDryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  const pick = noticeNumbersPick(p, world.notices, label)
  if (!pick.ok) return pick
  const filing = pick.filing
  const before = parseLienSends(filing.sends)
  const day = mailedOn(filing.sends)
  if (p.sent_on && day && p.sent_on !== day) {
    return { ok: false, refused: `${label}: the record says this notice was mailed on ${day}, and the call says ${p.sent_on}. These verbs set a number and leave the day as recorded. When the day on record is wrong, void the record on the job’s Lien window and record the mailing again.` }
  }

  const given: Array<{ copy: NoticeNumbersCopy; raw: string }> = []
  if (p.owner !== null) given.push({ copy: 'owner', raw: p.owner })
  if (p.contractor !== null) given.push({ copy: 'original_contractor', raw: p.contractor })
  const set: NoticeNumbersWrite['set'] = []
  const checks: string[] = []
  for (const g of given) {
    const send = before.find((s) => s.recipient === g.copy)
    if (!send) return { ok: false, refused: `${label}: the record says this notice did not go to the ${who(g.copy).toLowerCase()}, so there is no envelope of theirs to number. Leave that copy out. A copy that did go and is not on record is a mailing to record, not a number to set.` }
    if (send.method !== 'certified_mail' && send.method !== 'traceable_courier') return { ok: false, refused: `${label}: the ${who(g.copy).toLowerCase()}’s copy went by ${METHOD_WORDS[send.method] ?? send.method}, which carries no mail number. Leave that copy out.` }
    if ((send.via ?? '').trim()) return { ok: false, refused: `${label}: the ${who(g.copy).toLowerCase()}’s copy is carried by a mail provider, which brings its own number. Leave that copy out.` }
    let tracking = g.raw
    if (tracking && send.method === 'certified_mail') {
      if (/[^\d\s-]/.test(tracking)) return { ok: false, refused: `${label}: ${who(g.copy)}: a certified mail number is digits alone. Read the label again.` }
      tracking = digitsOf(tracking)
      if (tracking.length !== 20 && tracking.length !== 22) return { ok: false, refused: `${label}: ${who(g.copy)}: ${tracking.length} digits. A certified mail number has 20 or 22. Count the digits on the label again.` }
      if (!uspsCheckDigitOk(tracking)) checks.push(`${who(g.copy)}: the last digit of ${tracking} does not check against the digits before it, as a USPS number’s does. Read the label again before applying.`)
    }
    set.push({ copy: g.copy, tracking })
  }
  let after: LienSendLike[] = before
  for (const s of set) after = withTracking(after, s.copy, s.tracking)
  if (JSON.stringify(after) === JSON.stringify(before)) return { ok: false, refused: `${label}: the notice already holds ${set.length === 1 ? 'this number' : 'these numbers'}. Nothing to change.` }

  const copyLine = (sends: ReadonlyArray<LienSendLike>, copy: NoticeNumbersCopy) => {
    const s = sends.find((x) => x.recipient === copy)
    return s ? { copy, to: who(copy), how: METHOD_WORDS[s.method] ?? s.method, mailed_on: s.sent_on ?? null, tracking: s.tracking || null } : null
  }
  const lines = (sends: ReadonlyArray<LienSendLike>) => COPIES.map((c) => copyLine(sends, c)).filter(Boolean)
  const numbersAfter = after.filter((s) => (s.method === 'certified_mail' || s.method === 'traceable_courier') && s.tracking).map((s) => s.tracking)
  const sameNumber = new Set(numbersAfter).size < numbersAfter.length
  const takenOff = set.filter((s) => !s.tracking && (before.find((x) => x.recipient === s.copy)?.tracking ?? '')).map((s) => who(s.copy))
  const heldElsewhere = world.elsewhere
    .map((o) => ({ ...o, hit: o.sends.filter((s) => set.some((x) => x.tracking && digitsOf(s.tracking) === digitsOf(x.tracking))) }))
    .filter((o) => o.hit.length > 0)
    .map((o) => `${o.job}: ${o.hit.map((s) => `${LIEN_SEND_RECIPIENT_WORDS[s.recipient] ?? s.recipient} ${s.tracking}`).join(' · ')}`)
  const owedAfter = sendsTrackingOwed(after).length
  const changed = set.filter((s) => (before.find((x) => x.recipient === s.copy)?.tracking ?? '') !== s.tracking)
  return {
    ok: true,
    write: { filingId: filing.id, sends: after, set },
    reply: {
      action: 'notice_numbers',
      job: { id: job.id, label, name: (job.job_name ?? '').trim() || null, address: (job.job_address ?? '').trim() || null },
      notice: {
        filing_id: filing.id,
        paper: PAPER_WORDS[filing.kind] ?? filing.kind,
        months: filing.months,
        mailed_on: day,
        recorded: filing.by_hand ? 'by hand (Already mailed? Record it…)' : 'on the desk',
        desk_item: world.item ? `${world.item.status}${world.item.sent_at ? `, sent ${world.item.sent_at.slice(0, 10)}` : ''}: left as it is` : 'no desk item points at this notice',
      },
      before: lines(before),
      after: lines(after),
      writes: { filing: filing.id, sends: after },
      ...(checks.length > 0 ? { check_digit: checks } : {}),
      ...(sameNumber ? { same_number: 'Two envelopes of this notice carry one number. Each envelope has its own label: check the receipts.' } : {}),
      ...(takenOff.length > 0 ? { takes_off: `${takenOff.join(' and ')}: the number on record is taken off, and the copy reads tracking owed until its own number is set.` } : {}),
      ...(heldElsewhere.length > 0 ? { also_holds_this_number: heldElsewhere, also_holds_note: 'A label is on one envelope. Another notice on record already holds a number this call gives: check which envelope it was on.' } : {}),
      ...(world.paperMates.length > 0
        ? { same_paper: world.paperMates.map((o) => `${o.job}: ${o.sends.map((s) => `${LIEN_SEND_RECIPIENT_WORDS[s.recipient] ?? s.recipient} ${s.tracking || 'no number'}`).join(' · ')}`), same_paper_note: 'This paper was recorded on these jobs too, each on its own row. This plan changes this job’s row alone: plan the others with the same numbers.' }
        : {}),
      says: `${label}: ${changed.map((s) => `${who(s.copy)} ${s.tracking || 'no number'}`).join(' · ')}${owedAfter > 0 ? ` · ${owedAfter} still owed` : ''}`,
      not_done: 'A record alone: one update of this notice’s sends. Nothing is mailed, emailed or printed, no release is issued, and the day mailed, the claim, the months and the desk item stay as they are.',
    },
  }
}

export function noticeNumbersRefusedEntry(index: number, p: NoticeNumbersPayload | null, why: string): Json {
  return { entry: index + 1, status: 'refused', ...(p ? { job_id: p.job_id } : {}), why }
}

/** Two entries of one call that land on one notice: its two copies belong in one entry, under one hash. */
export function noticeNumbersSameNoticeWords(priorEntry: number): string {
  return `This call names the same notice twice (entry ${priorEntry}). Put both copies in one entry: one notice, one write.`
}

/** plan_notice_numbers's reply: the count of each verdict, what to do next, and the entries in the order sent. */
export function noticeNumbersPlanReply(entries: ReadonlyArray<Json>): Json {
  const ready = entries.filter((e) => e.status === 'ready').length
  const refused = entries.length - ready
  return {
    notices: `${entries.length} ${entries.length === 1 ? 'notice' : 'notices'}: ${ready} ready${refused > 0 ? `, ${refused} refused` : ''}.`,
    next:
      (ready > 0 ? 'Read each ready entry’s before and after to the person. Then, for each one they confirm, call apply_notice_numbers with notice (that entry as you sent it) and that entry’s own plan_hash. One apply a notice: one that fails never stops the rest. ' : '') +
      (refused > 0 ? 'A refused entry says why. ' : '') +
      'apply runs the dry run again first: if anything changed, the hash no longer matches and nothing is written.',
    entries,
  }
}

/** The apply's reply: each copy as the filing now holds it, read back, and how many numbers the notice still owes. */
export function noticeNumbersAppliedWords(p: NoticeNumbersPayload, label: string, write: NoticeNumbersWrite, back: { sends: unknown } | null): Json {
  const sends = back ? parseLienSends(back.sends) : []
  const landed = !!back && write.set.every((s) => (sends.find((x) => x.recipient === s.copy)?.tracking ?? '') === s.tracking)
  if (!landed) return { action: p.action, ok: false, why: `${label}: the numbers did not land on the notice (RLS let no row through, or the notice was voided since the plan). Plan again.` }
  const owed = sendsTrackingOwed(sends).length
  return {
    action: p.action,
    ok: true,
    filing_id: write.filingId,
    copies: COPIES.map((c) => sends.find((x) => x.recipient === c)).filter((s): s is LienSendLike => !!s).map((s) => ({ copy: s.recipient, to: LIEN_SEND_RECIPIENT_WORDS[s.recipient] ?? s.recipient, mailed_on: s.sent_on ?? null, tracking: s.tracking || null })),
    still_owed: owed,
    next: `${label}: ${owed === 0 ? 'every envelope of this notice has its number.' : `${owed} ${owed === 1 ? 'envelope still owes' : 'envelopes still owe'} a number, and the desk reads tracking owed.`}`,
  }
}
