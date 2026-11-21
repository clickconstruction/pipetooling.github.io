/**
 * Write someone up (punch list #410): the rules and every word of the phone sheet a leader or a superintendent opens
 * from the Dashboard. One press, **Write someone up**, then who it is about, what kind, what was seen, a read-back and
 * one press that sends. It lands in People, HR, Pending reports through `land_person_report`, where the office reads it
 * before it reaches the person's file. Taunya asked for it on 2026-11-20: writing someone up was not easy enough from
 * a leader's or a superintendent's Dashboard.
 *
 * Pure: the reads and the send are `writeUpIo.ts`, the sheet is `components/writeUp/WriteUpSheet.tsx`. Every
 * function that needs the day or the hour takes it. The words follow `plainWords.ts`.
 */
import type { VoiceState } from '../reports/voiceNote'
import { clock, seconds } from '../reports/voiceNote'

// ---------------------------------------------------------------------------
// Who may

/** The roles `land_person_report` takes a write-up from. */
export const WRITE_UP_ROLES: readonly string[] = ['dev', 'master_technician', 'superintendent']

export function canWriteSomeoneUp(role: string | null | undefined): boolean {
  return role != null && WRITE_UP_ROLES.includes(role)
}

// ---------------------------------------------------------------------------
// The kinds

export type WriteUpKind = 'late_no_show' | 'safety' | 'work_quality' | 'conduct' | 'tools_truck' | 'other' | 'good_work'

/** The kinds in the order the sheet draws them. Good work is last: the press is for a problem first. */
export const WRITE_UP_KINDS: ReadonlyArray<{ key: WriteUpKind; label: string }> = [
  { key: 'late_no_show', label: 'Late or no-show' },
  { key: 'safety', label: 'Safety' },
  { key: 'work_quality', label: 'Work quality' },
  { key: 'conduct', label: 'Conduct' },
  { key: 'tools_truck', label: 'Tools or truck' },
  { key: 'other', label: 'Other' },
  { key: 'good_work', label: 'Good work' },
]

export function isWriteUpKind(value: unknown): value is WriteUpKind {
  return typeof value === 'string' && WRITE_UP_KINDS.some((k) => k.key === value)
}

/** A kind's words. A report written before the sheet has no kind and reads as a plain report. */
export function writeUpKindLabel(kind: string | null | undefined): string {
  return WRITE_UP_KINDS.find((k) => k.key === kind)?.label ?? 'Report'
}

// ---------------------------------------------------------------------------
// The words

export const WRITE_UP_WORDS = {
  door: 'Write someone up',
  whoTitle: 'Write someone up',
  whatTitle: 'Write up',
  readTitle: 'Read it back',
  mineTitle: 'Your write-ups',
  today: 'With you today',
  week: 'With you this week',
  rest: 'Everyone else',
  search: 'Search everyone',
  about: 'About',
  when: 'When',
  job: 'Job',
  noJob: 'Not on a job',
  kind: 'What kind?',
  words: 'What did you see?',
  wordsPlaceholder: 'Say what you saw and heard, with the times.',
  wordsHint: 'Leave out what you think it means. HR reads this.',
  seen: 'Who saw it?',
  iDid: 'I did',
  someoneElse: 'Someone else',
  someoneElsePlaceholder: 'A name, or who they are',
  addName: 'Add the name',
  readBack: 'Read it back',
  fix: 'Fix it',
  send: 'Send write-up to HR',
  sending: 'Sending…',
  done: 'Done',
  another: 'Write another',
  addTo: 'Add to it',
  takeBack: 'Take it back',
  takeBackWhy: 'Why are you taking it back?',
  takeBackPlaceholder: 'A few words HR will read',
  taking: 'Taking it back…',
  keepIt: 'Keep it',
  readNote: 'HR reads this before it goes on the file. You can add to it later. You can take it back until HR files it.',
  sentNote: 'HR reads it next. Nobody else on the crew can see it.',
  loading: 'Getting your people…',
  loadFailed: 'The list of people did not load.',
  mineFailed: 'Your write-ups did not load.',
  sendFailed: 'The write-up did not send.',
  takeBackFailed: 'The write-up was not taken back.',
  sendOffline: 'No signal. Nothing is lost. Press Retry when the signal is back.',
  keptNote: 'It sends by itself when the signal is back. Closing the app loses nothing.',
  keptRefusedNote: 'This one was not sent. Read the reason, then write it again.',
  notAllowed: 'Only a leader or a superintendent can write someone up.',
} as const

/** The question that names the person: "Have you talked to Dana about it?" */
export function talkedQuestion(name: string): string {
  return `Have you talked to ${firstName(name)} about it?`
}

export const TALKED_CHOICES = { yes: 'Yes', notYet: 'Not yet' } as const

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

// ---------------------------------------------------------------------------
// The list the sheet opens on

export interface WriteUpPerson {
  person_id: string
  name: string
  /** `people.kind`: helper, sub, master_technician and so on. */
  kind: string | null
  /** The newest day this person shared a job with the caller, in the last seven. */
  with_date: string | null
  job_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  clocked_in_at: string | null
}

export interface WriteUpJob {
  job_id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  last_day: string | null
}

export interface WriteUpList {
  allowed: boolean
  today: string
  people: WriteUpPerson[]
  jobs: WriteUpJob[]
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** `write_up_people()`'s answer, read with care: a row with no id or no name is dropped. */
export function parseWriteUpList(raw: unknown): WriteUpList {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object') : [])
  const people: WriteUpPerson[] = []
  for (const r of rows(o.people)) {
    const id = text(r.person_id)
    const name = text(r.name)
    if (!id || !name) continue
    people.push({
      person_id: id,
      name: name.trim(),
      kind: text(r.kind),
      with_date: text(r.with_date),
      job_id: text(r.job_id),
      hcp_number: text(r.hcp_number),
      click_number: text(r.click_number),
      job_name: text(r.job_name),
      job_address: text(r.job_address),
      clocked_in_at: text(r.clocked_in_at),
    })
  }
  const jobs: WriteUpJob[] = []
  for (const r of rows(o.jobs)) {
    const id = text(r.job_id)
    if (!id) continue
    jobs.push({ job_id: id, hcp_number: text(r.hcp_number), click_number: text(r.click_number), job_name: text(r.job_name), job_address: text(r.job_address), last_day: text(r.last_day) })
  }
  return { allowed: o.allowed === true, today: text(o.today) ?? '', people, jobs }
}

/** A job as the sheet names it: its name, else its address, with its number in front when it has one. */
export function writeUpJobLabel(job: { hcp_number?: string | null; click_number?: string | null; job_name?: string | null; job_address?: string | null }): string {
  const number = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  const name = (job.job_name ?? '').trim() || (job.job_address ?? '').trim()
  if (number && name) return `${number} ${name}`
  return name || number || 'A job with no name'
}

const PERSON_KIND_LABELS: Record<string, string> = {
  master_technician: 'Leader',
  helper: 'Helper',
  sub: 'Subcontractor',
  superintendent: 'Superintendent',
  assistant: 'Assistant',
  estimator: 'Estimator',
  primary: 'Primary',
  dev: 'Dev',
}

export function personKindLabel(kind: string | null | undefined): string {
  if (!kind) return ''
  return PERSON_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export interface WriteUpGroups {
  today: WriteUpPerson[]
  week: WriteUpPerson[]
  rest: WriteUpPerson[]
}

const byName = (a: WriteUpPerson, b: WriteUpPerson) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.person_id.localeCompare(b.person_id)

/** The people on the caller's job today, then the ones from earlier this week, newest day first, then everyone else. */
export function splitWriteUpPeople(list: Pick<WriteUpList, 'people' | 'today'>): WriteUpGroups {
  const today: WriteUpPerson[] = []
  const week: WriteUpPerson[] = []
  const rest: WriteUpPerson[] = []
  for (const p of list.people) {
    if (p.with_date && p.with_date === list.today) today.push(p)
    else if (p.with_date) week.push(p)
    else rest.push(p)
  }
  today.sort(byName)
  week.sort((a, b) => (b.with_date ?? '').localeCompare(a.with_date ?? '') || byName(a, b))
  rest.sort(byName)
  return { today, week, rest }
}

/** A search over every name. Every word typed must be in the name. */
export function searchWriteUpPeople(people: ReadonlyArray<WriteUpPerson>, query: string): WriteUpPerson[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return people.filter((p) => words.every((w) => p.name.toLowerCase().includes(w))).sort(byName)
}

/** "Fri, Nov 20" from a 'YYYY-MM-DD' day. */
export function dayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

/** "Tue" from a 'YYYY-MM-DD' day. */
function weekdayWord(ymd: string): string {
  return dayWords(ymd).split(',')[0] ?? ymd
}

/** The line under a name: what the person is, and where they were with the caller. */
export function writeUpPersonLine(person: WriteUpPerson, today: string, timeOf: (iso: string) => string): string {
  const kind = personKindLabel(person.kind)
  const lead = kind ? `${kind} · ` : ''
  if (person.with_date && person.with_date === today) {
    const tail = person.clocked_in_at ? `on the clock since ${timeOf(person.clocked_in_at)}` : 'not clocked in'
    return `${lead}${tail}`
  }
  if (person.with_date) return `${lead}${weekdayWord(person.with_date)} at ${writeUpJobLabel(person)}`
  return kind
}

/** The head of today's group names the job when everyone in it shares one. */
export function todayGroupTitle(today: ReadonlyArray<WriteUpPerson>): string {
  const jobs = new Set(today.map((p) => p.job_id).filter(Boolean))
  const first = today[0]
  if (jobs.size === 1 && first) return `${WRITE_UP_WORDS.today} · ${writeUpJobLabel(first)}`
  return WRITE_UP_WORDS.today
}

// ---------------------------------------------------------------------------
// The time of day

/** "12:20" from what a person types: "12:20", "12:20 pm", "1220", "7am", "7". Null when it is not a time. */
export function parseWriteUpTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
  if (s === '') return null
  const m = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(s)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  const half = m[3] ? m[3][0] : null
  if (minute > 59) return null
  if (half) {
    if (hour < 1 || hour > 12) return null
    if (half === 'p' && hour !== 12) hour += 12
    if (half === 'a' && hour === 12) hour = 0
  } else if (hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "12:20 pm" from "12:20" or "12:20:00". */
export function timeWords(hhmm: string | null | undefined): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm ?? '')
  if (!m) return ''
  const hour = Number(m[1])
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${m[2]} ${hour < 12 ? 'am' : 'pm'}`
}

/** The day as the form says it: Today, Yesterday, or "Fri, Nov 20". */
export function writeUpDayWords(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === ymdMinusOne(today)) return 'Yesterday'
  return dayWords(date)
}

function ymdMinusOne(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1, 12))
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// The draft

export interface WriteUpSeen {
  person_id?: string
  name: string
}

export interface WriteUpDraft {
  person: WriteUpPerson
  kind: WriteUpKind | null
  /** 'YYYY-MM-DD', never after today. */
  date: string
  /** 'HH:MM', or '' when the time is not known. */
  time: string
  job: { id: string; label: string } | null
  words: string
  /** The writer saw it themselves. */
  sawIt: boolean
  seenBy: WriteUpSeen[]
  /** Whether the writer has talked to the person. Null until answered. */
  talked: boolean | null
  /** The earlier write-up this one adds to. */
  addsTo: string | null
}

export const WRITE_UP_MAX_WORDS = 4000

/**
 * A new draft about a person: now, on the job they shared with the caller today, else the caller's own job today.
 * The writer saw it, until they say they were told.
 */
export function newWriteUpDraft(person: WriteUpPerson, list: Pick<WriteUpList, 'today' | 'jobs'>, now: { ymd: string; hhmm: string }): WriteUpDraft {
  let job: WriteUpDraft['job'] = null
  if (person.job_id && person.with_date === list.today) job = { id: person.job_id, label: writeUpJobLabel(person) }
  else {
    const mine = list.jobs.find((j) => j.last_day === list.today)
    if (mine) job = { id: mine.job_id, label: writeUpJobLabel(mine) }
  }
  return { person, kind: null, date: now.ymd, time: now.hhmm, job, words: '', sawIt: true, seenBy: [], talked: null, addsTo: null }
}

/** A draft that adds to a write-up already sent: the same person and kind, now. */
export function additionDraft(parent: { id: string; kind: string | null }, person: WriteUpPerson, list: Pick<WriteUpList, 'today' | 'jobs'>, now: { ymd: string; hhmm: string }): WriteUpDraft {
  return { ...newWriteUpDraft(person, list, now), kind: isWriteUpKind(parent.kind) ? parent.kind : 'other', addsTo: parent.id }
}

/** What the button says while the draft cannot be read back, or null when it can. */
export function writeUpMissing(draft: Pick<WriteUpDraft, 'kind' | 'words'>): string | null {
  const noKind = draft.kind == null
  const noWords = draft.words.trim() === ''
  if (noKind && noWords) return 'Pick a kind and say what you saw'
  if (noKind) return 'Pick a kind'
  if (noWords) return 'Say what you saw'
  if (draft.words.trim().length > WRITE_UP_MAX_WORDS) return 'That is too long to send'
  return null
}

/** The crew on the draft's job today, without the person written up: the names offered under Who saw it. */
export function witnessChoices(list: Pick<WriteUpList, 'people' | 'today'>, draft: Pick<WriteUpDraft, 'person' | 'job'>): WriteUpPerson[] {
  if (!draft.job) return []
  const jobId = draft.job.id
  return list.people.filter((p) => p.person_id !== draft.person.person_id && p.with_date === list.today && p.job_id === jobId).sort(byName)
}

/** A witness pressed on or off. */
export function toggleSeen(seenBy: ReadonlyArray<WriteUpSeen>, who: WriteUpSeen): WriteUpSeen[] {
  const same = (s: WriteUpSeen) => (who.person_id ? s.person_id === who.person_id : !s.person_id && s.name.toLowerCase() === who.name.toLowerCase())
  return seenBy.some(same) ? seenBy.filter((s) => !same(s)) : [...seenBy, who]
}

export interface ReadBackLine {
  label: string
  value: string
}

/** The record read back, one fact a line, as HR will get it. */
export function writeUpReadBack(draft: WriteUpDraft): ReadBackLine[] {
  const when = draft.time ? `${dayWords(draft.date)} · ${timeWords(draft.time)}` : dayWords(draft.date)
  const seen = [draft.sawIt ? 'You' : null, ...draft.seenBy.map((s) => s.name)].filter((x): x is string => Boolean(x))
  const lines: ReadBackLine[] = [
    { label: WRITE_UP_WORDS.about, value: draft.person.name },
    { label: 'Kind', value: writeUpKindLabel(draft.kind) },
    { label: WRITE_UP_WORDS.when, value: when },
    { label: WRITE_UP_WORDS.job, value: draft.job?.label ?? WRITE_UP_WORDS.noJob },
    { label: 'Seen by', value: seen.length > 0 ? seen.join(', ') : 'You were told about it' },
  ]
  if (draft.talked != null) lines.push({ label: `Talked to ${firstName(draft.person.name)}`, value: draft.talked ? TALKED_CHOICES.yes : TALKED_CHOICES.notYet })
  return lines
}

/** What `land_person_report` takes, with the press's own id and the moment Send was pressed. */
export function writeUpPayload(draft: WriteUpDraft, pressId: string, pressedAtIso: string): Record<string, unknown> {
  return { press_id: pressId, pressed_at: pressedAtIso, ...writeUpFields(draft) }
}

/** The write-up's own fields, as the phone keeps them while a send waits for signal. */
export function writeUpFields(draft: WriteUpDraft): Record<string, unknown> {
  return {
    subject_person_id: draft.person.person_id,
    kind: draft.kind,
    content: draft.words.trim(),
    occurred_date: draft.date,
    occurred_time: draft.time || null,
    job_ledger_id: draft.job?.id ?? null,
    job_label: draft.job?.label ?? null,
    author_saw_it: draft.sawIt,
    seen_by: draft.seenBy.map((s) => (s.person_id ? { person_id: s.person_id, name: s.name } : { name: s.name })),
    talked_to_person: draft.talked,
    adds_to: draft.addsTo,
  }
}

// ---------------------------------------------------------------------------
// The writer's own write-ups

export interface MyWriteUpRow {
  id: string
  subject_person_id: string
  content: string
  status: string
  kind: string | null
  occurred_date: string
  occurred_time: string | null
  job_label: string | null
  created_at: string
  resolution_note: string | null
  adds_to: string | null
}

export type MyWriteUpState = 'waiting' | 'filed' | 'set_aside' | 'taken_back'

const TAKEN_BACK_PREFIX = 'Taken back by the writer:'

export function myWriteUpState(row: Pick<MyWriteUpRow, 'status' | 'resolution_note'>): MyWriteUpState {
  if (row.status === 'filed') return 'filed'
  if (row.status === 'dismissed') return (row.resolution_note ?? '').startsWith(TAKEN_BACK_PREFIX) ? 'taken_back' : 'set_aside'
  return 'waiting'
}

export const MY_WRITE_UP_STATE_WORDS: Record<MyWriteUpState, string> = {
  waiting: 'Waiting on HR',
  filed: 'On file',
  set_aside: 'Set aside by HR',
  taken_back: 'Taken back',
}

/** "Safety · Fri, Nov 20 · Cedar Hollow Lot 14" under a name. */
export function myWriteUpLine(row: Pick<MyWriteUpRow, 'kind' | 'occurred_date' | 'job_label' | 'adds_to'>): string {
  const parts = [writeUpKindLabel(row.kind), dayWords(row.occurred_date)]
  if (row.job_label) parts.push(row.job_label)
  if (row.adds_to) parts.push('added to an earlier one')
  return parts.join(' · ')
}

/** The reason a write-up was set aside or taken back, with who said it. */
export function myWriteUpNote(row: Pick<MyWriteUpRow, 'status' | 'resolution_note'>): string | null {
  const note = (row.resolution_note ?? '').trim()
  if (row.status !== 'dismissed' || note === '') return null
  if (note.startsWith(TAKEN_BACK_PREFIX)) return `You said: ${note.slice(TAKEN_BACK_PREFIX.length).trim()}`
  return `HR said: ${note}`
}

/** "1 waiting on HR · 2 on file" for the row that opens the list. Empty when there are none. */
export function myWriteUpsHeadline(rows: ReadonlyArray<Pick<MyWriteUpRow, 'status' | 'resolution_note'>>): string {
  let waiting = 0
  let filed = 0
  for (const r of rows) {
    const s = myWriteUpState(r)
    if (s === 'waiting') waiting += 1
    else if (s === 'filed') filed += 1
  }
  const parts: string[] = []
  if (waiting > 0) parts.push(`${waiting} waiting on HR`)
  if (filed > 0) parts.push(`${filed} on file`)
  if (parts.length === 0) return rows.length > 0 ? `${rows.length} sent` : ''
  return parts.join(' · ')
}

/** A waiting write-up can be taken back. One HR filed or set aside cannot. */
export const canTakeBack = (row: Pick<MyWriteUpRow, 'status' | 'resolution_note'>): boolean => myWriteUpState(row) === 'waiting'

/** Anything not taken back can be added to. */
export const canAddTo = (row: Pick<MyWriteUpRow, 'status' | 'resolution_note'>): boolean => myWriteUpState(row) !== 'taken_back'

// ---------------------------------------------------------------------------
// A write-up kept on the phone (no signal)

/** A press the outbox holds, as much of it as this list reads. */
export interface KeptPressLike {
  id: string
  kind: string
  userId: string
  pressedAt: number
  state: string
  payload: unknown
  refusal: { message: string } | null
}

export interface KeptWriteUp {
  id: string
  /** `waiting` until the signal is back, `refused` when the server said no. */
  state: 'waiting' | 'refused'
  subject_person_id: string
  kind: string | null
  occurred_date: string
  job_label: string | null
  pressedAt: number
  reason: string | null
}

/** The writer's write-ups still on the phone, newest press first. A sent press is the server's row by then. */
export function keptWriteUps(presses: ReadonlyArray<KeptPressLike>, userId: string): KeptWriteUp[] {
  const out: KeptWriteUp[] = []
  for (const p of presses) {
    if (p.kind !== 'person-report' || p.userId !== userId || p.state === 'sent') continue
    const fields = ((p.payload as { fields?: unknown } | null)?.fields ?? {}) as Record<string, unknown>
    const subject = text(fields.subject_person_id)
    if (!subject) continue
    out.push({
      id: p.id,
      state: p.state === 'refused' ? 'refused' : 'waiting',
      subject_person_id: subject,
      kind: text(fields.kind),
      occurred_date: text(fields.occurred_date) ?? '',
      job_label: text(fields.job_label),
      pressedAt: p.pressedAt,
      reason: p.state === 'refused' ? (p.refusal?.message ?? null) : null,
    })
  }
  return out.sort((a, b) => b.pressedAt - a.pressedAt)
}

export const KEPT_WRITE_UP_STATE_WORDS: Record<KeptWriteUp['state'], string> = { waiting: 'Waiting for signal', refused: 'Not sent' }

/** "Safety · Fri, Nov 20 · Cedar Hollow Lot 14" for a kept write-up. */
export function keptWriteUpLine(kept: Pick<KeptWriteUp, 'kind' | 'occurred_date' | 'job_label'>): string {
  const parts = [writeUpKindLabel(kept.kind)]
  if (kept.occurred_date) parts.push(dayWords(kept.occurred_date))
  if (kept.job_label) parts.push(kept.job_label)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Talk it through, in this sheet's words

/** The speech button's words by state. The phone types the words. No sound is kept. */
export function writeUpVoiceWords(state: VoiceState): { title: string; hint: string } {
  switch (state.kind) {
    case 'listening':
      return { title: `Listening · ${clock(state.seconds)}`, hint: 'Say what you saw and heard, with the times. Tap to stop.' }
    case 'done':
    case 'drafted':
      return { title: 'Talk it through again', hint: `Heard ${seconds(state.seconds)}. Read the words, then fix any that are wrong.` }
    case 'unavailable':
      return { title: 'Use the microphone on your keyboard', hint: 'This phone has no speech for the app. Tap the box, then the microphone key.' }
    case 'offline':
      return { title: 'No signal', hint: 'Use the microphone on your keyboard, or type it.' }
    case 'denied':
      return { title: 'The microphone is off for this app', hint: 'Allow the microphone in your phone’s settings, or type it.' }
    case 'failed':
      return { title: 'Nothing was heard', hint: 'Tap to try again, or type it.' }
    default:
      return { title: 'Talk it through', hint: 'The phone types what you say. No sound is kept.' }
  }
}
