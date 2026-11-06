import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'

/**
 * The person file's Timeline: one dated line of everything on record about a person, built the
 * way the Legal desk builds a matter's Timeline (`legalTimeline.ts`) — the hand-written entries of
 * the HR file merged with what the app already knows happened: papers sent and signed, licenses
 * put on file and lapsed, write-ups, no-shows, excused lates, field reports waiting to be filed,
 * the day they started and the day they left. Pure: no React, no supabase, no app import — it lives in
 * `supabase/functions/_shared/` so the People → HR tab and the dev MCP's `get_person_file` draw one line
 * from one implementation; `src/lib/people/personTimeline.ts` is the app's door to it, as `hoursStatement.ts`
 * is to its kernel. The io that gathers the sources under the viewer's own RLS is `personTimelineIo.ts`
 * (the app) and `_shared/devMcpPersonFile.ts` (the seat); a source the viewer may not read simply
 * contributes no lines, and the panel says which ones are held.
 *
 * A line sits on the day it is ABOUT (`ymd`), never the day it was written; `loggedAt` keeps that.
 * Lines ahead of today (a license that expires next month) sit in their own group at the top.
 */

/** The lane a line sits in: what was said, what was done, the paper, what was missed, what is ahead. */
export type PersonTimelineLane = 'said' | 'did' | 'paper' | 'missed' | 'planned'
export const PERSON_TIMELINE_LANES: ReadonlyArray<{ lane: PersonTimelineLane; label: string }> = [
  { lane: 'said', label: 'Said' },
  { lane: 'did', label: 'Did' },
  { lane: 'paper', label: 'Paper' },
  { lane: 'missed', label: 'Missed' },
  { lane: 'planned', label: 'Ahead' },
]

/** Where a line comes from — the table that owns it, in the words the chips use. */
export type PersonTimelineSource = 'file' | 'evidence' | 'report' | 'contract' | 'license' | 'writeup' | 'attendance' | 'employment'
export const PERSON_TIMELINE_SOURCES: ReadonlyArray<{ source: PersonTimelineSource; label: string }> = [
  { source: 'file', label: 'HR entries' },
  { source: 'evidence', label: 'Evidence' },
  { source: 'report', label: 'Field reports' },
  { source: 'contract', label: 'Contracts' },
  { source: 'license', label: 'Licenses' },
  { source: 'writeup', label: 'Write-ups' },
  { source: 'attendance', label: 'Attendance' },
  { source: 'employment', label: 'Employment' },
]

export type PersonTimelineState = 'live' | 'unreviewed' | 'dismissed' | 'draft' | 'owed' | 'waiting' | 'expired' | 'ahead'

export type PersonTimelineLine = {
  key: string
  lane: PersonTimelineLane
  source: PersonTimelineSource
  /** The day it is about, `YYYY-MM-DD`. */
  ymd: string
  /** When it was written, ISO; null when the source keeps no clock. */
  loggedAt: string | null
  /** The kind in plain words: *conversation* · *signed* · *license expired* · *field report · waiting to be filed*. */
  kindWords: string
  /** What: the entry's words, the paper's name, the write-up's template. */
  what: string
  /** A second line under what: a dismissal's reason, a license number, the day a paper was sent. */
  notes: string
  /** Who wrote or did it, or '' when unknown. */
  byName: string
  state: PersonTimelineState
  ref: { table: string; id: string }
  /** The page that owns the record, when the line is a pointer into one. */
  door: { label: string; to: string } | null
  /** Exhibits attached to this entry (HR entries only). */
  attachmentIds: string[]
}

export type PersonTimelineEntry = {
  id: string
  entry_date: string
  content: string
  source: string
  created_by: string | null
  created_at: string
  author_label: string | null
}
export type PersonTimelineAttachment = { id: string; entry_id: string | null }
/** A piece of evidence (`personEvidence.ts`): on the line as its own paper, or on the entry it proves when it has one. */
export type PersonTimelineEvidence = {
  id: string
  entry_id: string | null
  dated_on: string
  title: string
  memo: string
  created_at: string
  created_by: string | null
  author_label: string | null
  drive_folder_url: string | null
  /** v2.6554: a counsel-only record's line reads its title alone. */
  counsel_only?: boolean
  fileIds: string[]
}
export type PersonTimelineReport = {
  id: string
  status: string
  occurred_date: string
  created_at: string
  author_name: string
  content: string
  resolution_note: string | null
  resolved_at: string | null
  filed_entry_id: string | null
}
export type PersonTimelineContract = {
  id: string
  document_name: string
  status: string
  created_at: string | null
  sent_at: string | null
  signed_at: string | null
  office_completed_at: string | null
  signer_printed_name: string | null
  expires_at: string | null
  doc_type: string
}
export type PersonTimelineLicense = { id: string; license_type: string; date_of_expiry: string; created_at: string | null; note: string | null }
export type PersonTimelineWriteup = {
  id: string
  template_name: string
  status: string
  disclosure: string | null
  submitted_at: string | null
  created_at: string
  filled_by_user_id: string | null
}
export type PersonTimelineNcns = { id: string; work_date: string; created_at: string; created_by_user_id: string | null; details: string | null }
export type PersonTimelineExcuse = { id: string; work_date: string; note: string; created_at: string; author_name: string | null }
export type PersonTimelinePerson = { id: string; name: string; start_date: string | null; end_date: string | null; archived_at: string | null }

export type PersonTimelineInput = {
  todayYmd: string
  person: PersonTimelinePerson | null
  entries: ReadonlyArray<PersonTimelineEntry>
  attachments: ReadonlyArray<PersonTimelineAttachment>
  evidence: ReadonlyArray<PersonTimelineEvidence>
  reports: ReadonlyArray<PersonTimelineReport>
  contracts: ReadonlyArray<PersonTimelineContract>
  licenses: ReadonlyArray<PersonTimelineLicense>
  writeups: ReadonlyArray<PersonTimelineWriteup>
  ncns: ReadonlyArray<PersonTimelineNcns>
  excuses: ReadonlyArray<PersonTimelineExcuse>
  /** users.id → display name, for the `created_by` / `filled_by` columns. */
  namesById: Readonly<Record<string, string>>
}

const YMD = /^\d{4}-\d{2}-\d{2}/

/** The calendar day an ISO instant falls on in the company's time zone; a bare date passes through. */
function dayOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = YMD.exec(iso)
  if (!m) return null
  // A date column ("2026-09-04") has no clock and no zone: it already is the day.
  if (iso.length === 10) return iso
  return calendarYmdInAppTzFromIso(iso)
}

const ENTRY_LANE: Record<string, PersonTimelineLane> = {
  conversation: 'said',
  review: 'said',
  report: 'said',
  incident: 'did',
  job_event: 'did',
  milestone: 'did',
  payroll_event: 'did',
}
const ENTRY_KIND_WORDS: Record<string, string> = {
  conversation: 'conversation',
  review: 'review',
  report: 'field report',
  incident: 'incident',
  job_event: 'job event',
  milestone: 'milestone',
  payroll_event: 'payroll event',
}

const CONTRACTS_DOOR = { label: 'Contracts', to: '/people?tab=contracts' }
const LICENSES_DOOR = { label: 'Licenses', to: '/people?tab=licenses' }
const WRITEUPS_DOOR = { label: 'Write-ups', to: '/people?tab=writeups' }

function writeupKindWords(w: Pick<PersonTimelineWriteup, 'status' | 'disclosure'>): string {
  if (w.status !== 'submitted') return 'write-up · draft'
  if (w.disclosure === 'discussed_with_subject') return 'write-up · discussed with them'
  if (w.disclosure === 'withheld_from_subject') return 'write-up · kept from them'
  return 'write-up'
}

/** Every line on record, newest day first. Pure. */
export function buildPersonTimeline(input: PersonTimelineInput): PersonTimelineLine[] {
  const out: PersonTimelineLine[] = []
  const today = input.todayYmd
  const name = (id: string | null | undefined): string => (id ? input.namesById[id] ?? '' : '')

  const attachmentsByEntry = new Map<string, string[]>()
  for (const a of input.attachments) {
    if (!a.entry_id) continue
    const list = attachmentsByEntry.get(a.entry_id) ?? []
    list.push(a.id)
    attachmentsByEntry.set(a.entry_id, list)
  }

  for (const e of input.entries) {
    const ymd = dayOf(e.entry_date)
    if (!ymd) continue
    out.push({
      key: `entry:${e.id}`,
      lane: ENTRY_LANE[e.source] ?? 'said',
      source: 'file',
      ymd,
      loggedAt: e.created_at,
      kindWords: ENTRY_KIND_WORDS[e.source] ?? e.source.replace(/_/g, ' '),
      what: e.content,
      notes: '',
      byName: name(e.created_by) || (e.author_label ?? '') || 'agent',
      state: 'live',
      ref: { table: 'person_file_entries', id: e.id },
      door: null,
      attachmentIds: attachmentsByEntry.get(e.id) ?? [],
    })
  }

  for (const ev of input.evidence) {
    // Evidence on an entry sits on that entry's line (its files ride `attachments`); the rest stands on its own day.
    if (ev.entry_id) continue
    const ymd = dayOf(ev.dated_on)
    if (!ymd) continue
    out.push({
      key: `evidence:${ev.id}`,
      lane: 'paper',
      source: 'evidence',
      ymd,
      loggedAt: ev.created_at,
      kindWords: ev.counsel_only ? 'evidence · counsel-only' : 'evidence',
      what: ev.title,
      notes: ev.counsel_only ? '' : ev.memo,
      byName: name(ev.created_by) || (ev.author_label ?? ''),
      state: 'live',
      ref: { table: 'person_file_evidence', id: ev.id },
      door: ev.drive_folder_url && !ev.counsel_only ? { label: 'Open in Drive', to: ev.drive_folder_url } : null,
      attachmentIds: ev.fileIds,
    })
  }

  for (const r of input.reports) {
    // A filed report already stands on the line as the entry it became.
    if (r.status === 'filed') continue
    const ymd = dayOf(r.occurred_date)
    if (!ymd) continue
    const dismissed = r.status === 'dismissed'
    out.push({
      key: `report:${r.id}`,
      lane: 'said',
      source: 'report',
      ymd,
      loggedAt: r.created_at,
      kindWords: dismissed ? 'field report · dismissed' : 'field report · waiting to be filed',
      what: r.content,
      notes: dismissed && r.resolution_note ? `Dismissed: ${r.resolution_note}` : '',
      byName: r.author_name.trim(),
      state: dismissed ? 'dismissed' : 'unreviewed',
      ref: { table: 'person_reports', id: r.id },
      door: null,
      attachmentIds: [],
    })
  }

  for (const c of input.contracts) {
    const signedYmd = dayOf(c.signed_at)
    const sentYmd = dayOf(c.sent_at)
    const madeYmd = dayOf(c.created_at)
    if (c.status === 'signed' && signedYmd) {
      out.push({
        key: `contract:${c.id}:signed`,
        lane: 'paper',
        source: 'contract',
        ymd: signedYmd,
        loggedAt: c.signed_at,
        kindWords: 'signed',
        what: c.document_name,
        notes: sentYmd ? `Sent ${sentYmd}.` : '',
        byName: (c.signer_printed_name ?? '').trim() || (input.person?.name ?? ''),
        state: 'live',
        ref: { table: 'person_contract_documents', id: c.id },
        door: CONTRACTS_DOOR,
        attachmentIds: [],
      })
      const officeYmd = dayOf(c.office_completed_at)
      if (officeYmd) {
        out.push({
          key: `contract:${c.id}:office`,
          lane: 'paper',
          source: 'contract',
          ymd: officeYmd,
          loggedAt: c.office_completed_at,
          kindWords: 'office section completed',
          what: c.document_name,
          notes: '',
          byName: 'the office',
          state: 'live',
          ref: { table: 'person_contract_documents', id: c.id },
          door: CONTRACTS_DOOR,
          attachmentIds: [],
        })
      }
    } else if (c.status === 'sent' && sentYmd) {
      out.push({
        key: `contract:${c.id}:sent`,
        lane: 'paper',
        source: 'contract',
        ymd: sentYmd,
        loggedAt: c.sent_at,
        kindWords: 'sent for signature · waiting',
        what: c.document_name,
        notes: '',
        byName: 'the office',
        state: 'waiting',
        ref: { table: 'person_contract_documents', id: c.id },
        door: CONTRACTS_DOOR,
        attachmentIds: [],
      })
    } else if (madeYmd) {
      out.push({
        key: `contract:${c.id}:owed`,
        lane: 'paper',
        source: 'contract',
        ymd: madeYmd,
        loggedAt: c.created_at,
        kindWords: 'owed · not sent yet',
        what: c.document_name,
        notes: '',
        byName: 'the office',
        state: 'owed',
        ref: { table: 'person_contract_documents', id: c.id },
        door: CONTRACTS_DOOR,
        attachmentIds: [],
      })
    }
    const expiresYmd = dayOf(c.expires_at)
    if (expiresYmd) {
      const past = expiresYmd < today
      out.push({
        key: `contract:${c.id}:expires`,
        lane: past ? 'missed' : 'planned',
        source: 'contract',
        ymd: expiresYmd,
        loggedAt: null,
        kindWords: past ? 'paper expired' : 'paper expires',
        what: c.document_name,
        notes: '',
        byName: '',
        state: past ? 'expired' : 'ahead',
        ref: { table: 'person_contract_documents', id: c.id },
        door: CONTRACTS_DOOR,
        attachmentIds: [],
      })
    }
  }

  for (const l of input.licenses) {
    const madeYmd = dayOf(l.created_at)
    if (madeYmd) {
      out.push({
        key: `license:${l.id}:filed`,
        lane: 'paper',
        source: 'license',
        ymd: madeYmd,
        loggedAt: l.created_at,
        kindWords: 'license on file',
        what: l.license_type,
        notes: l.note ?? '',
        byName: 'the office',
        state: 'live',
        ref: { table: 'person_licenses', id: l.id },
        door: LICENSES_DOOR,
        attachmentIds: [],
      })
    }
    const expiry = dayOf(l.date_of_expiry)
    if (expiry) {
      const past = expiry < today
      out.push({
        key: `license:${l.id}:expiry`,
        lane: past ? 'missed' : 'planned',
        source: 'license',
        ymd: expiry,
        loggedAt: null,
        kindWords: past ? 'license expired' : 'license expires',
        what: l.license_type,
        notes: '',
        byName: '',
        state: past ? 'expired' : 'ahead',
        ref: { table: 'person_licenses', id: l.id },
        door: LICENSES_DOOR,
        attachmentIds: [],
      })
    }
  }

  for (const w of input.writeups) {
    const submitted = w.status === 'submitted'
    const ymd = dayOf(submitted ? w.submitted_at ?? w.created_at : w.created_at)
    if (!ymd) continue
    out.push({
      key: `writeup:${w.id}`,
      lane: 'paper',
      source: 'writeup',
      ymd,
      loggedAt: submitted ? w.submitted_at ?? w.created_at : w.created_at,
      kindWords: writeupKindWords(w),
      what: w.template_name,
      notes: '',
      byName: name(w.filled_by_user_id),
      state: submitted ? 'live' : 'draft',
      ref: { table: 'writeups', id: w.id },
      door: WRITEUPS_DOOR,
      attachmentIds: [],
    })
  }

  for (const n of input.ncns) {
    const ymd = dayOf(n.work_date)
    if (!ymd) continue
    out.push({
      key: `ncns:${n.id}`,
      lane: 'missed',
      source: 'attendance',
      ymd,
      loggedAt: n.created_at,
      kindWords: 'no call, no show',
      what: (n.details ?? '').trim() || 'Did not come in and did not call.',
      notes: '',
      byName: name(n.created_by_user_id),
      state: 'live',
      ref: { table: 'attendance_incidents', id: n.id },
      door: WRITEUPS_DOOR,
      attachmentIds: [],
    })
  }

  for (const x of input.excuses) {
    const ymd = dayOf(x.work_date)
    if (!ymd) continue
    out.push({
      key: `excuse:${x.id}`,
      lane: 'said',
      source: 'attendance',
      ymd,
      loggedAt: x.created_at,
      kindWords: 'late · excused',
      what: x.note,
      notes: '',
      byName: (x.author_name ?? '').trim(),
      state: 'live',
      ref: { table: 'attendance_annotations', id: x.id },
      door: WRITEUPS_DOOR,
      attachmentIds: [],
    })
  }

  const p = input.person
  if (p) {
    const started = dayOf(p.start_date)
    if (started) {
      const ahead = started > today
      out.push({
        key: `employment:${p.id}:start`,
        lane: ahead ? 'planned' : 'did',
        source: 'employment',
        ymd: started,
        loggedAt: null,
        kindWords: ahead ? 'starts' : 'started',
        what: ahead ? 'Starts with the company.' : 'Started with the company.',
        notes: '',
        byName: '',
        state: ahead ? 'ahead' : 'live',
        ref: { table: 'people', id: p.id },
        door: null,
        attachmentIds: [],
      })
    }
    const ended = dayOf(p.end_date)
    if (ended) {
      out.push({
        key: `employment:${p.id}:end`,
        lane: 'did',
        source: 'employment',
        ymd: ended,
        loggedAt: null,
        kindWords: 'employment ended',
        what: 'Last day with the company.',
        notes: '',
        byName: '',
        state: 'live',
        ref: { table: 'people', id: p.id },
        door: null,
        attachmentIds: [],
      })
    } else {
      const archived = dayOf(p.archived_at)
      if (archived) {
        out.push({
          key: `employment:${p.id}:archived`,
          lane: 'did',
          source: 'employment',
          ymd: archived,
          loggedAt: p.archived_at,
          kindWords: 'archived from the roster',
          what: 'Taken off the roster.',
          notes: '',
          byName: '',
          state: 'live',
          ref: { table: 'people', id: p.id },
          door: null,
          attachmentIds: [],
        })
      }
    }
  }

  out.sort((a, b) => {
    if (a.ymd !== b.ymd) return a.ymd < b.ymd ? 1 : -1
    const la = a.loggedAt ?? ''
    const lb = b.loggedAt ?? ''
    if (la !== lb) return la < lb ? 1 : -1
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
  return out
}

/** Lines ahead of today, soonest first, apart from the record. */
export function splitPersonTimeline(lines: ReadonlyArray<PersonTimelineLine>, todayYmd: string): { ahead: PersonTimelineLine[]; past: PersonTimelineLine[] } {
  const ahead: PersonTimelineLine[] = []
  const past: PersonTimelineLine[] = []
  for (const l of lines) (l.ymd > todayYmd ? ahead : past).push(l)
  ahead.reverse()
  return { ahead, past }
}

export type PersonTimelineFilter = { source?: PersonTimelineSource | null; lane?: PersonTimelineLane | null }

export function filterPersonTimeline(lines: ReadonlyArray<PersonTimelineLine>, f: PersonTimelineFilter): PersonTimelineLine[] {
  return lines.filter((l) => (!f.source || l.source === f.source) && (!f.lane || l.lane === f.lane))
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthLabelOf(ymd: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

export type PersonTimelineMonth = { monthKey: string; label: string; lines: PersonTimelineLine[] }

/** The record by month, in the order given (newest first in, newest first out). */
export function groupPersonTimelineByMonth(lines: ReadonlyArray<PersonTimelineLine>): PersonTimelineMonth[] {
  const out: PersonTimelineMonth[] = []
  let cur: PersonTimelineMonth | null = null
  for (const l of lines) {
    const monthKey = l.ymd.slice(0, 7)
    if (!cur || cur.monthKey !== monthKey) {
      cur = { monthKey, label: monthLabelOf(l.ymd), lines: [] }
      out.push(cur)
    }
    cur.lines.push(l)
  }
  return out
}

export type PersonTimelineCounts = {
  bySource: Record<PersonTimelineSource, number>
  byLane: Record<PersonTimelineLane, number>
  total: number
}

export function countPersonTimeline(lines: ReadonlyArray<PersonTimelineLine>): PersonTimelineCounts {
  const bySource = { file: 0, evidence: 0, report: 0, contract: 0, license: 0, writeup: 0, attendance: 0, employment: 0 } as Record<PersonTimelineSource, number>
  const byLane = { said: 0, did: 0, paper: 0, missed: 0, planned: 0 } as Record<PersonTimelineLane, number>
  for (const l of lines) {
    bySource[l.source] += 1
    byLane[l.lane] += 1
  }
  return { bySource, byLane, total: lines.length }
}

/** The strip over the file: what is on record, what is owed, what has lapsed. */
export type PersonFileFacts = {
  entries: number
  evidence: number
  reportsPending: number
  papersSigned: number
  papersWaiting: number
  papersOwed: number
  licensesLive: number
  licensesExpired: number
  writeups: number
  /** No-shows in the last ninety days. */
  ncns90: number
  /** The newest day anything on record is about, or null with nothing on it. */
  lastYmd: string | null
}

export function personFileFacts(input: PersonTimelineInput, lines: ReadonlyArray<PersonTimelineLine>): PersonFileFacts {
  const ninetyAgo = ymdShift(input.todayYmd, -90)
  let licensesLive = 0
  let licensesExpired = 0
  for (const l of input.licenses) {
    const d = dayOf(l.date_of_expiry)
    if (d && d < input.todayYmd) licensesExpired += 1
    else licensesLive += 1
  }
  let papersSigned = 0
  let papersWaiting = 0
  let papersOwed = 0
  for (const c of input.contracts) {
    if (c.status === 'signed') papersSigned += 1
    else if (c.status === 'sent') papersWaiting += 1
    else papersOwed += 1
  }
  const past = lines.filter((l) => l.ymd <= input.todayYmd)
  return {
    entries: input.entries.length,
    evidence: input.evidence.length,
    reportsPending: input.reports.filter((r) => r.status === 'pending').length,
    papersSigned,
    papersWaiting,
    papersOwed,
    licensesLive,
    licensesExpired,
    writeups: input.writeups.filter((w) => w.status === 'submitted').length,
    ncns90: input.ncns.filter((n) => n.work_date >= ninetyAgo).length,
    lastYmd: past[0]?.ymd ?? null,
  }
}

/** `ymd` moved by `days` on the calendar, with no clock involved. */
export function ymdShift(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days))
  return d.toISOString().slice(0, 10)
}

/** The strip's chips in reading order; a zero is left out so the strip says only what is there. */
export function personFileFactChips(f: PersonFileFacts): Array<{ key: string; label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> {
  const out: Array<{ key: string; label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = []
  if (f.reportsPending > 0) out.push({ key: 'reports', label: `${f.reportsPending} report${f.reportsPending === 1 ? '' : 's'} waiting to be filed`, tone: 'amber' })
  if (f.licensesExpired > 0) out.push({ key: 'expired', label: `${f.licensesExpired} license${f.licensesExpired === 1 ? '' : 's'} expired`, tone: 'red' })
  if (f.papersOwed > 0) out.push({ key: 'owed', label: `${f.papersOwed} paper${f.papersOwed === 1 ? '' : 's'} owed`, tone: 'amber' })
  if (f.papersWaiting > 0) out.push({ key: 'waiting', label: `${f.papersWaiting} sent, waiting`, tone: 'amber' })
  if (f.ncns90 > 0) out.push({ key: 'ncns', label: `${f.ncns90} no-show${f.ncns90 === 1 ? '' : 's'} in 90 days`, tone: 'red' })
  if (f.papersSigned > 0) out.push({ key: 'signed', label: `${f.papersSigned} paper${f.papersSigned === 1 ? '' : 's'} signed`, tone: 'green' })
  if (f.licensesLive > 0) out.push({ key: 'licenses', label: `${f.licensesLive} license${f.licensesLive === 1 ? '' : 's'} on file`, tone: 'green' })
  if (f.writeups > 0) out.push({ key: 'writeups', label: `${f.writeups} write-up${f.writeups === 1 ? '' : 's'}`, tone: 'gray' })
  if (f.entries > 0) out.push({ key: 'entries', label: `${f.entries} HR entr${f.entries === 1 ? 'y' : 'ies'}`, tone: 'gray' })
  if (f.evidence > 0) out.push({ key: 'evidence', label: `${f.evidence} piece${f.evidence === 1 ? '' : 's'} of evidence`, tone: 'gray' })
  return out
}
