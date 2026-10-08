/**
 * GC Review worklist: the week's GCs as the person at the keyboard works
 * them — one row per GC, three steps (Checked · Sent · Word), grouped by the
 * account man she has to ask. It replaces the statement-round panel, which
 * handed each GC to its sender and waited; the office works every row now.
 * Pure: the round's groups, certifications, marks and senders go in.
 */
import type { GcReviewGroup } from '../gcReviewRollup'
import { gcGroupCertStatus, gcReviewSentThisWeek, type GcReviewCertRow } from './gcReviewCertification'
import { payPromiseStatus, type PayPromise } from './payPromise'
import { GC_ROUND_THRESHOLD, isTemperature, type RoundMarkAction, type RoundMarkRow, type StatementSendChannel, type Temperature } from './gcStatementRounds'
import { latestExpectedPayByGc } from './temperatureBoard'

export type GcWorklistStep = 'check' | 'send' | 'word'

export type GcWorklistRow = {
  gcId: string
  gcName: string
  amount: number
  jobCount: number
  oldestAgeDays: number | null
  /** The account man: the standing assignment, else the Account Man on most of the GC's jobs; null = nobody. */
  ownerUserId: string | null
  /** Where the account man came from: the standing pick, the account manager on most of the GC's jobs, or the leader by default (v2.4149) — null when nobody is set and no leader is known. */
  ownerSource: 'pick' | 'jobs' | 'leader' | null
  /** done = certified and unchanged; changed = the group moved after sign-off; todo = not certified this week. */
  checked: 'done' | 'changed' | 'todo'
  /** A statement went out this week — a sent mark or an app send. */
  sent: boolean
  /** This week's mark carries a read of the GC: a temperature, or a "spoke with them". */
  word: boolean
  skipped: boolean
  /** At or over the line: the word is part of the week. Under it, check and send are the whole job. */
  overLine: boolean
  /** The step to do next, or null when the row is done (or skipped) for the week. */
  next: GcWorklistStep | null
  /** The date they said they'd pay, and whether it has passed with money still owed. */
  promise: PayPromise | null
  mark: RoundMarkRow | null
  group: GcReviewGroup
}

export type GcWorklistGroup = {
  key: string
  /** The account man whose GCs these are; null only when no leader is known (the Pipeline cards, which never show a heading). */
  ownerUserId: string | null
  rows: GcWorklistRow[]
  total: number
  /** Rows with a step left this week. */
  open: number
  /** Rows whose promised date has passed unpaid. */
  late: number
}

export type GcWorklist = {
  groups: GcWorklistGroup[]
  counts: { gcs: number; checked: number; sent: number; words: number; done: number; late: number }
}

const cents = (n: number) => Math.round(n * 100)

/** A mark that carries someone's read of the GC, whatever else it records. */
export function markCarriesWord(mark: Pick<RoundMarkRow, 'action' | 'temperature'> | null | undefined): boolean {
  if (!mark) return false
  return mark.action === 'contacted' || isTemperature(mark.temperature)
}

/** Check, then send, then the word; a GC under the line is done once its statement is out. */
export function worklistNextStep(row: Pick<GcWorklistRow, 'checked' | 'sent' | 'word' | 'skipped' | 'overLine'>): GcWorklistStep | null {
  if (row.skipped) return null
  if (!row.sent) return row.checked === 'done' ? 'send' : 'check'
  if (row.overLine && !row.word) return 'word'
  return null
}

export function buildGcWorklist(input: {
  groups: readonly GcReviewGroup[]
  certsByGc: ReadonlyMap<string, GcReviewCertRow>
  /** This week's marks. */
  marks: readonly RoundMarkRow[]
  senders: ReadonlyMap<string, string>
  accountMen: ReadonlyMap<string, string>
  /** Newest statement per GC — app sends merged with sent marks. */
  lastSentByGcId: Record<string, string>
  weekStartYmd: string
  /** The newest pay-by date on record per GC, and today in the company calendar — omitted, no row carries a promise. */
  expectedPayByByGc?: ReadonlyMap<string, string | null>
  todayYmd?: string
  threshold?: number
  /** The leader — a GC with no standing pick and no account manager files under them, so nothing is nobody's (punch list #54, v2.4149). */
  leaderUserId?: string | null
}): GcWorklist {
  const threshold = input.threshold ?? GC_ROUND_THRESHOLD
  const markByGc = new Map(input.marks.map((m) => [m.gc_customer_id, m]))
  const rows: GcWorklistRow[] = []
  for (const g of input.groups) {
    if (g.isNoGc || !g.gcId) continue
    // Nothing outstanding is nothing to check or send — the week strip leaves it out too.
    if (cents(g.subtotal) <= 0) continue
    const mark = markByGc.get(g.gcId) ?? null
    const cert = gcGroupCertStatus(g, input.certsByGc.get(g.gcId)).state
    const base = {
      checked: cert === 'certified' ? ('done' as const) : cert === 'changed' ? ('changed' as const) : ('todo' as const),
      sent: mark?.action === 'sent' || gcReviewSentThisWeek(input.lastSentByGcId[g.gcId], input.weekStartYmd),
      word: markCarriesWord(mark),
      skipped: mark?.action === 'skipped',
      overLine: g.subtotal >= threshold,
    }
    rows.push({
      gcId: g.gcId,
      gcName: g.gcName,
      amount: g.subtotal,
      jobCount: g.jobCount,
      oldestAgeDays: g.oldestAgeDays,
      ...ownerFor(g.gcId, input.senders, input.accountMen, input.leaderUserId ?? null),
      ...base,
      next: worklistNextStep(base),
      promise: input.todayYmd ? payPromiseStatus(input.expectedPayByByGc?.get(g.gcId), input.todayYmd, g.subtotal) : null,
      mark,
      group: g,
    })
  }

  // Every GC files under its account man — the small ones too, their word still optional (v2.4149).
  const byKey = new Map<string, GcWorklistGroup>()
  for (const r of rows) {
    const key = `owner:${r.ownerUserId ?? 'nobody'}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, ownerUserId: r.ownerUserId, rows: [], total: 0, open: 0, late: 0 }
      byKey.set(key, group)
    }
    group.rows.push(r)
    group.total += r.amount
    if (r.next) group.open += 1
    if (r.promise?.late) group.late += 1
  }
  // A broken promise first, then work left, then the largest balance.
  for (const g of byKey.values()) {
    g.rows.sort(
      (a, b) =>
        Number(b.promise?.late ?? false) - Number(a.promise?.late ?? false) ||
        Number(b.next != null) - Number(a.next != null) ||
        b.amount - a.amount ||
        a.gcName.localeCompare(b.gcName),
    )
  }
  // Named account men by total; a group with nobody known (no leader passed) last.
  const groups = [...byKey.values()].sort((a, b) => Number(a.ownerUserId == null) - Number(b.ownerUserId == null) || b.total - a.total || a.key.localeCompare(b.key))

  return {
    groups,
    counts: {
      gcs: rows.length,
      checked: rows.filter((r) => r.checked === 'done').length,
      sent: rows.filter((r) => r.sent).length,
      words: rows.filter((r) => r.word).length,
      done: rows.filter((r) => r.next == null && !r.skipped).length,
      late: rows.filter((r) => r.promise?.late).length,
    },
  }
}

/**
 * The two Pipeline cards off the week's list: the GCs whose bills still need
 * checking, and the GCs checked and waiting on their statement. Both count
 * every GC over the line, whoever the account man is — the office sends them.
 */
export function worklistCards(w: Pick<GcWorklist, 'groups'>): { held: { count: number; total: number }; ready: { count: number; total: number; late: number } } {
  const held = { count: 0, total: 0 }
  const ready = { count: 0, total: 0, late: 0 }
  for (const g of w.groups) {
    for (const r of g.rows) {
      if (!r.overLine || r.skipped || r.sent) continue
      if (r.checked === 'done') {
        ready.count += 1
        ready.total += r.amount
        if (r.promise?.late) ready.late += 1
      } else {
        held.count += 1
        held.total += r.amount
      }
    }
  }
  return { held, ready }
}

/**
 * The group's heading: "Account Man Malachi" ("Account Man Taunya (you)" for the signed-in
 * person — the owner's wording, v2.4097: it names whose GCs these are, whoever is at the
 * keyboard). Since v2.4149 every GC has an account man — the leader by default — so
 * "No account man yet" only shows when no leader is known at all.
 */
export function worklistGroupTitle(group: Pick<GcWorklistGroup, 'ownerUserId'>, ownerName: string, isYou: boolean): string {
  if (group.ownerUserId == null) return 'No account man yet'
  return `Account Man ${ownerName}${isYou ? ' (you)' : ''}`
}

/** The account man for a GC: the standing pick, else the account manager on most of its jobs, else the leader (v2.4149). */
export function ownerFor(gcId: string, senders: ReadonlyMap<string, string>, accountMen: ReadonlyMap<string, string>, leaderUserId: string | null): { ownerUserId: string | null; ownerSource: GcWorklistRow['ownerSource'] } {
  const pick = senders.get(gcId)
  if (pick) return { ownerUserId: pick, ownerSource: 'pick' }
  const jobs = accountMen.get(gcId)
  if (jobs) return { ownerUserId: jobs, ownerSource: 'jobs' }
  if (leaderUserId) return { ownerUserId: leaderUserId, ownerSource: 'leader' }
  return { ownerUserId: null, ownerSource: null }
}

/** The leader a GC nobody is set on files under: the one live master account (the same rule as the company owner's fallback), else null. */
export function leaderUserIdFrom(users: ReadonlyArray<{ id: string; role: string; archived_at?: string | null }>): string | null {
  const live = users.filter((u) => u.role === 'master_technician' && !u.archived_at)
  return live.length === 1 ? live[0]!.id : null
}

/** How many of a group's rows sit under the line — their word is optional, the heading says so (v2.4149). */
export function underLineCount(group: Pick<GcWorklistGroup, 'rows'>): number {
  return group.rows.filter((r) => !r.overLine).length
}

/** The note the app writes when a Draft Message send marks the GC sent. */
export const APP_SEND_NOTE = 'Sent from the app'

const joinNotes = (first: string | null | undefined, second: string | null | undefined): string | null => {
  const parts = [first, second].map((n) => (n ?? '').trim()).filter((n) => n && n !== APP_SEND_NOTE)
  return parts.length > 0 ? [...new Set(parts)].join('\n') : null
}

/** Who a word came from and who typed it, as the form and the signed-in user give them. */
export type RoundMarkWordInput = {
  fromUserId: string | null
  fromName: string
  /** How the person entering it heard it — a channel, or 'link' (the ask-by-link page); null when the source entered it. */
  heardVia: StatementSendChannel | 'link' | null
  enteredBy: string | null
  enteredByName: string
}

export type RoundMarkWrite = {
  action: RoundMarkAction
  channel: StatementSendChannel | string | null
  note: string | null
  temperature: Temperature | string | null
  expected_pay_by: string | null
  /** Set when the statement's own day must stand (a word written over a sent mark); null = now. */
  acted_at: string | null
  word_from_user_id: string | null
  word_from_name: string | null
  word_heard_via: string | null
  word_entered_by: string | null
  word_entered_by_name: string | null
  /** The word's own day: now for a word written in this save, the old word's day when a send keeps it. */
  word_at: string | null
}

/**
 * A GC has one mark a week, and the week has two things to record: the
 * statement going out and the word coming back. Whichever is written second
 * must not erase the first — a word over a sent mark keeps it sent (with its
 * day and how it went out); a send over a word keeps the read, its sentence
 * and the pay date. Notes from both are kept, the word first; the app's own
 * "Sent from the app" never crowds out a sentence. A skip is simply replaced.
 */
export function mergeRoundMarkWrite(
  existing:
    | (Pick<RoundMarkRow, 'action' | 'channel' | 'note' | 'temperature' | 'expected_pay_by' | 'acted_at' | 'acted_by' | 'acted_by_name'> &
        Partial<Pick<RoundMarkRow, 'word_from_user_id' | 'word_from_name' | 'word_heard_via' | 'word_entered_by' | 'word_entered_by_name' | 'word_at'>>)
    | null,
  incoming: {
    action: RoundMarkAction
    channel?: StatementSendChannel | null
    note?: string | null
    temperature?: Temperature | null
    expectedPayBy?: string | null
    word?: RoundMarkWordInput | null
  },
  nowIso = new Date().toISOString(),
): RoundMarkWrite {
  const note = incoming.note?.trim() || null
  const noWord = { word_from_user_id: null, word_from_name: null, word_heard_via: null, word_entered_by: null, word_entered_by_name: null, word_at: null }
  const skipped = incoming.action === 'skipped'
  const carriesWord = !skipped && (incoming.action === 'contacted' || isTemperature(incoming.temperature))
  const incomingWord = carriesWord
    ? {
        word_from_user_id: incoming.word?.fromUserId ?? null,
        word_from_name: incoming.word?.fromName.trim() || null,
        word_heard_via: incoming.word?.heardVia ?? null,
        word_entered_by: incoming.word?.enteredBy ?? null,
        word_entered_by_name: incoming.word?.enteredByName.trim() || null,
        word_at: nowIso,
      }
    : noWord
  const plain: RoundMarkWrite = {
    action: incoming.action,
    channel: skipped ? null : (incoming.channel ?? 'email'),
    note: skipped ? null : note,
    temperature: skipped ? null : (incoming.temperature ?? null),
    expected_pay_by: skipped ? null : incoming.expectedPayBy || null,
    acted_at: null,
    ...incomingWord,
  }
  if (!existing || skipped || existing.action === 'skipped') return plain
  if (incoming.action === 'contacted' && existing.action === 'sent') {
    return { ...plain, action: 'sent', channel: existing.channel ?? 'email', note: joinNotes(note, existing.note), acted_at: existing.acted_at }
  }
  if (incoming.action === 'sent' && markCarriesWord(existing) && !incoming.temperature) {
    return {
      ...plain,
      note: joinNotes(existing.note, note),
      temperature: existing.temperature,
      expected_pay_by: plain.expected_pay_by ?? existing.expected_pay_by,
      // The word keeps its own source and day. A word from before the columns was its marker's.
      word_from_user_id: existing.word_from_user_id ?? (existing.word_from_name ? null : existing.acted_by),
      word_from_name: existing.word_from_name ?? (existing.acted_by_name || null),
      word_heard_via: existing.word_heard_via ?? null,
      word_entered_by: existing.word_entered_by ?? existing.acted_by,
      word_entered_by_name: existing.word_entered_by_name ?? (existing.acted_by_name || null),
      word_at: existing.word_at ?? existing.acted_at,
    }
  }
  return plain
}

/**
 * The Pipeline's two round cards (v2.4887). This week's marks say what is checked and sent; the newest
 * pay date in the recent weeks says who broke a promise, as GC Review reads it. Before, neither card
 * passed a pay date or today, so "· N broke a promise" on Statements to send could never show. Both
 * inputs are required here, so a caller cannot leave them out again.
 */
export function pipelineRoundCards(
  input: Omit<Parameters<typeof buildGcWorklist>[0], 'expectedPayByByGc' | 'todayYmd'> & {
    /** The last six weeks of marks (`listGcStatementRoundMarksSince`): a pay date given weeks ago still counts. */
    recentMarks: readonly RoundMarkRow[]
    /** Today in the company calendar (`todayYmdInAppTz`). */
    todayYmd: string
  },
): ReturnType<typeof worklistCards> {
  const { recentMarks, ...rest } = input
  return worklistCards(buildGcWorklist({ ...rest, expectedPayByByGc: latestExpectedPayByGc(recentMarks) }))
}
