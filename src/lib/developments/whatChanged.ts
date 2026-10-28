/**
 * The What changed feed (punch list #208, design spike): one list, newest first, read off rows the
 * app already keeps — a bid's sends and contacts (`bids_submission_entries`), its outcome, its plans
 * link (`bid_changes`), a job's stage moves (`job_status_events`), its bills and payments, its notes,
 * new bids and jobs, and the questions with their answers. *You last looked* is a line inside the
 * list (`placeSinceLine`): above it is new, under it is seen. Pure.
 */
import { bidStatusWord, requestIsOpen, type MemberBid, type MemberJob, type MemberRequest, type Members } from './overview'

export type ChangeKind = 'asked' | 'answered' | 'sent' | 'contact' | 'won' | 'lost' | 'plans' | 'stage' | 'billed' | 'paid' | 'note' | 'new_bid' | 'new_job'

export type ChangeAbout = { kind: 'bid' | 'job' | 'site'; id: string | null; label: string }

export type ChangeLine = {
  id: string
  at: string
  kind: ChangeKind
  /** The verb the line leads with: *Working*, *Sent*, *Asked*, *New plans*. */
  verb: string
  about: ChangeAbout
  /** The rest of the sentence after the record: *moved from Waiting*, *$139,650*, the note's words. */
  detail: string | null
  by: string | null
  /** An open question's age, drawn amber with Reply. */
  waitingDays: number | null
  /** The source kept a day, not a moment (a sent date, a paid-on day): the line shows no time. */
  dayOnly?: boolean
}

export type ChangeInputs = {
  members: Members
  requests: readonly MemberRequest[]
  submissionEntries: ReadonlyArray<{ id: string; bid_id: string; occurred_at: string; contact_method: string | null; notes: string | null; created_by: string | null }>
  bidChanges: ReadonlyArray<{ id: number | string; bid_id: string; changed_at: string; changed: string[]; changed_by: string | null }>
  statusEvents: ReadonlyArray<{ id: string; job_id: string; changed_at: string; from_status: string | null; to_status: string; changed_by_user_id: string | null }>
  invoices: ReadonlyArray<{ id: string; job_id: string; amount: number; status: string; billed_at: string | null; sent_to_customer_at: string | null; created_at: string | null }>
  payments: ReadonlyArray<{ id: string; job_id: string; amount: number; paid_on: string | null; created_at: string | null }>
  threadNotes: ReadonlyArray<{ id: string; job_id: string; created_at: string; author_user_id: string; body: string }>
  names: ReadonlyMap<string, string>
  bidLabel: (bid: MemberBid) => string
  jobLabel: (job: MemberJob) => string
  stageLabel: (status: string | null) => string
  money: (n: number) => string
  siteName: string
  nowMs: number
}

function ymdToIso(ymd: string): string {
  return `${ymd}T12:00:00.000Z`
}

export function buildWhatChanged(inp: ChangeInputs): ChangeLine[] {
  const lines: ChangeLine[] = []
  const bidsById = new Map(inp.members.bids.map((b) => [b.id, b]))
  const jobsById = new Map(inp.members.jobs.map((j) => [j.id, j]))
  const name = (id: string | null | undefined) => (id ? inp.names.get(id) ?? null : null)
  const aboutBid = (b: MemberBid): ChangeAbout => ({ kind: 'bid', id: b.id, label: `${inp.bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim() })
  const aboutJob = (j: MemberJob): ChangeAbout => ({ kind: 'job', id: j.id, label: `${inp.jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim() })

  for (const b of inp.members.bids) {
    if (b.created_at) lines.push({ id: `newbid:${b.id}`, at: b.created_at, kind: 'new_bid', verb: 'New bid', about: aboutBid(b), detail: null, by: null, waitingDays: null })
    const status = bidStatusWord(b)
    if ((status === 'won' || status === 'lost') && b.outcome_at) {
      lines.push({ id: `outcome:${b.id}`, at: b.outcome_at, kind: status, verb: status === 'won' ? 'Won' : 'Lost', about: aboutBid(b), detail: b.agreed_value != null ? inp.money(b.agreed_value) : null, by: null, waitingDays: null })
    }
    if (b.bid_date_sent) {
      lines.push({ id: `sent:${b.id}`, at: ymdToIso(b.bid_date_sent), kind: 'sent', verb: 'Sent', about: aboutBid(b), detail: b.bid_value != null ? inp.money(b.bid_value) : null, by: name(b.estimator_id), waitingDays: null, dayOnly: true })
    }
  }
  for (const e of inp.submissionEntries) {
    const b = bidsById.get(e.bid_id)
    if (!b) continue
    const words = (e.notes ?? '').trim()
    lines.push({ id: `entry:${e.id}`, at: e.occurred_at, kind: 'contact', verb: e.contact_method ? `Contact · ${e.contact_method}` : 'Contact', about: aboutBid(b), detail: words || null, by: name(e.created_by), waitingDays: null })
  }
  for (const c of inp.bidChanges) {
    const b = bidsById.get(c.bid_id)
    if (!b || !(c.changed.includes('plans_link') || c.changed.includes('design_drawing_plan_date'))) continue
    lines.push({ id: `plans:${c.id}`, at: c.changed_at, kind: 'plans', verb: 'New plans', about: aboutBid(b), detail: b.design_drawing_plan_date ? `set dated ${b.design_drawing_plan_date}` : null, by: name(c.changed_by), waitingDays: null })
  }
  for (const j of inp.members.jobs) {
    if (j.created_at) lines.push({ id: `newjob:${j.id}`, at: j.created_at, kind: 'new_job', verb: 'New job', about: aboutJob(j), detail: j.revenue ? inp.money(j.revenue) : null, by: null, waitingDays: null })
  }
  for (const ev of inp.statusEvents) {
    const j = jobsById.get(ev.job_id)
    if (!j) continue
    const to = (ev.to_status ?? '').toLowerCase()
    lines.push({
      id: `stage:${ev.id}`,
      at: ev.changed_at,
      kind: to === 'paid' ? 'paid' : to === 'billed' ? 'billed' : 'stage',
      verb: inp.stageLabel(ev.to_status),
      about: aboutJob(j),
      detail: ev.from_status ? `moved from ${inp.stageLabel(ev.from_status)}` : null,
      by: name(ev.changed_by_user_id),
      waitingDays: null,
    })
  }
  for (const inv of inp.invoices) {
    const j = jobsById.get(inv.job_id)
    const at = inv.sent_to_customer_at ?? inv.billed_at
    if (!j || !at) continue
    lines.push({ id: `bill:${inv.id}`, at, kind: 'billed', verb: 'Billed', about: aboutJob(j), detail: inp.money(inv.amount), by: null, waitingDays: null })
  }
  for (const p of inp.payments) {
    const j = jobsById.get(p.job_id)
    const at = p.paid_on ? ymdToIso(p.paid_on) : p.created_at
    if (!j || !at) continue
    lines.push({ id: `pay:${p.id}`, at, kind: 'paid', verb: 'Paid', about: aboutJob(j), detail: inp.money(p.amount), by: null, waitingDays: null, dayOnly: !!p.paid_on })
  }
  for (const n of inp.threadNotes) {
    const j = jobsById.get(n.job_id)
    if (!j) continue
    lines.push({ id: `note:${n.id}`, at: n.created_at, kind: 'note', verb: 'Note', about: aboutJob(j), detail: n.body.trim() || null, by: name(n.author_user_id), waitingDays: null })
  }
  for (const r of inp.requests) {
    const b = r.bid_id ? bidsById.get(r.bid_id) : null
    const j = r.job_ledger_id ? jobsById.get(r.job_ledger_id) : null
    const about: ChangeAbout = b ? aboutBid(b) : j ? aboutJob(j) : { kind: 'site', id: null, label: inp.siteName }
    const to = r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'
    const open = requestIsOpen(r)
    lines.push({
      id: `ask:${r.id}`,
      at: r.created_at,
      kind: 'asked',
      verb: 'Asked',
      about,
      detail: r.title,
      by: `${name(r.from_user_id) ?? 'someone'}, to ${to}`,
      waitingDays: open ? Math.max(0, Math.floor((inp.nowMs - Date.parse(r.created_at)) / 86_400_000)) : null,
    })
    for (const note of r.notes) {
      lines.push({ id: `answer:${note.id}`, at: note.created_at, kind: 'answered', verb: 'Answered', about, detail: note.body.trim() || null, by: name(note.author_user_id), waitingDays: null })
    }
    if (r.closed_at && r.closed_note?.trim()) {
      lines.push({ id: `closed:${r.id}`, at: r.closed_at, kind: 'answered', verb: 'Closed', about, detail: r.closed_note.trim(), by: name(null), waitingDays: null })
    }
  }
  lines.sort((a, b) => b.at.localeCompare(a.at))
  return lines
}

/**
 * Where the *You last looked* line sits: the index of the first line at or before the stamp, which
 * is also how many lines are new. No stamp → no line, and nothing is counted as new (the first look
 * reads everything as seen, so the count starts at zero and grows from the first press of Mark as looked).
 */
export function placeSinceLine(lines: readonly ChangeLine[], lastLookedIso: string | null): { index: number | null; newCount: number } {
  if (!lastLookedIso) return { index: null, newCount: 0 }
  let i = 0
  while (i < lines.length && (lines[i]?.at ?? '') > lastLookedIso) i += 1
  return { index: i, newCount: i }
}

/**
 * The feed's search (the owner, 2026-10-28: *search for people or jobs or bids … to see movement or
 * track down problems*): every word typed must appear somewhere on the line — the record's number
 * and name, the verb, the words, or who did it. Case does not matter. An empty search is every line.
 */
export function filterChangeLines(lines: readonly ChangeLine[], query: string): ChangeLine[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...lines]
  return lines.filter((l) => {
    const hay = `${l.about.label} ${l.verb} ${l.detail ?? ''} ${l.by ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
