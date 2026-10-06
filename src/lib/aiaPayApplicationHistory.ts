import type { SavedPayApplication } from './aiaPayApplications'
import type { PayApplicationLine } from './aiaPayApplicationLines'
import { formatAiaMoney } from './aiaG702G703Preview'
import type { SentCopy } from './sent/sentCopies'
import { formatDenverCalendarDayShort, formatDenverDateTimeShort } from '../utils/dateUtils'

/**
 * A job's pay applications read as a history (v2.4710). The AIA G702-G703 window listed the
 * saved applications as chips — number, period, payment due — and the kept workbooks sat in a
 * separate list on the Documents tab. The history puts each application on one line with its
 * stops: who saved it and when, each workbook that went out and when, and where the job stands
 * against the contract. Nothing here reads the database: the window hands it the saved
 * applications and the job's sent copies.
 */

/** A stamp as a day in the company's calendar, "Aug 1"; '' when it is not a time. */
export const payApplicationDay = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : ''
}
/** A stamp as a day and time, "Aug 1, 9:12 AM". */
export const payApplicationDayTime = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverDateTimeShort(ms) : ''
}

/** The `sent_documents.kind` the window files a downloaded workbook under. */
export const PAY_APPLICATION_COPY_KIND = 'pay_application'

export function isPayApplicationCopy(row: Pick<SentCopy, 'kind'>): boolean {
  return row.kind === PAY_APPLICATION_COPY_KIND
}

export type PayApplicationHistoryLine = {
  app: SavedPayApplication
  /** The workbooks downloaded from this application as saved, newest first. */
  wentOut: SentCopy[]
}

/** Where the job stands, as the latest application says it: the G702's lines 1, 4, 5 and 6. */
export type PayApplicationSummary = {
  count: number
  /** The application the figures come from. */
  latestNumber: number
  contractSumToDate: number
  totalCompletedAndStored: number
  /** Completed and stored over the contract to date, 0 to 1; 0 on a contract of 0. */
  fractionComplete: number
  retainageHeld: number
  /** Earned less retainage to date: what has been certified for payment so far. */
  certifiedToDate: number
  /** The contract to date less what is completed and stored: the work left. */
  workLeft: number
}

export type PayApplicationHistory = {
  /** One line per saved application, in number order. */
  lines: PayApplicationHistoryLine[]
  /** Workbooks downloaded with no saved application to point at (no number was typed), newest first. */
  unsaved: SentCopy[]
  /** Null when nothing is saved on the job. */
  summary: PayApplicationSummary | null
}

const newestFirst = (rows: ReadonlyArray<SentCopy>): SentCopy[] => rows.slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0))

const round2 = (n: number): number => Math.round(n * 100) / 100

export function payApplicationSummary(apps: ReadonlyArray<SavedPayApplication>): PayApplicationSummary | null {
  if (apps.length === 0) return null
  const latest = apps.reduce((a, b) => (b.applicationNumber > a.applicationNumber ? b : a))
  const contract = latest.contractSumToDate
  const completed = latest.totalCompletedAndStored
  return {
    count: apps.length,
    latestNumber: latest.applicationNumber,
    contractSumToDate: contract,
    totalCompletedAndStored: completed,
    fractionComplete: contract > 0 ? Math.max(0, Math.min(1, completed / contract)) : 0,
    retainageHeld: latest.retainageHeld,
    certifiedToDate: latest.totalEarnedLessRetainage,
    workLeft: round2(contract - completed),
  }
}

/**
 * The history: the saved applications in number order, each with the workbooks filed on it;
 * the workbooks filed on no application; and the summary. Only pay application copies count;
 * a copy on another application's id, or another kind of paper, is left out.
 */
export function payApplicationHistory(apps: ReadonlyArray<SavedPayApplication>, sent: ReadonlyArray<SentCopy>): PayApplicationHistory {
  const copies = newestFirst(sent.filter(isPayApplicationCopy))
  const byApp = new Map<string, SentCopy[]>()
  const unsaved: SentCopy[] = []
  const ids = new Set(apps.map((a) => a.id))
  for (const copy of copies) {
    if (copy.sourceId && ids.has(copy.sourceId)) {
      const list = byApp.get(copy.sourceId) ?? []
      list.push(copy)
      byApp.set(copy.sourceId, list)
    } else if (!copy.sourceId) {
      unsaved.push(copy)
    }
  }
  const lines = apps
    .slice()
    .sort((a, b) => a.applicationNumber - b.applicationNumber)
    .map((app) => ({ app, wentOut: byApp.get(app.id) ?? [] }))
  return { lines, unsaved, summary: payApplicationSummary(apps) }
}

/** The file a kept workbook is stored under, from its path in the bucket; '' when the copy was not kept. */
export function payApplicationFileName(copy: Pick<SentCopy, 'copyPath'>): string {
  return (copy.copyPath ?? '').split('/').filter(Boolean).pop() ?? ''
}

const percentWords = (fraction: number): string => `${Math.round(fraction * 100)}% complete`

/** The one line under the heading: "2 saved · $24,458.76 certified · 72% complete". */
export function payApplicationSummaryWords(summary: PayApplicationSummary): string {
  const saved = `${summary.count} saved`
  return [saved, `${formatAiaMoney(summary.certifiedToDate)} certified`, percentWords(summary.fractionComplete)].join(' · ')
}

/** Whether a saved application was saved again after it was first saved. */
export function wasSavedAgain(app: Pick<SavedPayApplication, 'createdAt' | 'updatedAt'>): boolean {
  if (!app.createdAt || !app.updatedAt) return false
  const a = Date.parse(app.createdAt)
  const b = Date.parse(app.updatedAt)
  // The two stamps come from one transaction on the first save; a later save moves the second.
  return Number.isFinite(a) && Number.isFinite(b) && b - a > 1000
}

/**
 * "Saved Aug 1 by Taunya", and "· saved again Sep 18 by Robert" when it was. `when` draws a
 * stamp as a day; the names are the users' as the row carries them, or nothing.
 */
export function payApplicationSavedWords(app: Pick<SavedPayApplication, 'createdAt' | 'updatedAt' | 'createdByName' | 'updatedByName'>, when: (iso: string) => string): string {
  const first = app.createdAt ? when(app.createdAt) : app.updatedAt ? when(app.updatedAt) : ''
  if (!first) return ''
  const by = (name: string): string => (name ? ` by ${name}` : '')
  const firstBy = app.createdAt ? app.createdByName : app.updatedByName
  const parts = [`Saved ${first}${by(firstBy)}`]
  if (wasSavedAgain(app) && app.updatedAt) parts.push(`saved again ${when(app.updatedAt)}${by(app.updatedByName)}`)
  return parts.join(' · ')
}

/** "Went out Sep 2, 8:05 AM by Taunya" for a kept workbook. */
export function payApplicationWentOutWords(copy: Pick<SentCopy, 'sentAt' | 'sentByName'>, when: (iso: string) => string): string {
  const at = when(copy.sentAt)
  return `Went out${at ? ` ${at}` : ''}${copy.sentByName ? ` by ${copy.sentByName}` : ''}`
}

/**
 * What the application said when its workbook went out (v2.4714): filed with the copy as
 * `sent_documents.source_snapshot`, so a later save can be named against it. The lines carry
 * the four typed amounts; the totals are the G702's.
 */
export type PayApplicationSnapshotLine = { id: string; label: string; scheduledValue: number; fromPrevious: number; thisPeriod: number; stored: number }
export type PayApplicationSnapshot = {
  applicationNumber: number
  periodTo: string | null
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePct: number
  retainageHeld: number
  totalEarnedLessRetainage: number
  currentPaymentDue: number
  lines: PayApplicationSnapshotLine[]
}

const snapshotLine = (l: PayApplicationLine): PayApplicationSnapshotLine => ({
  id: l.id,
  label: l.label,
  scheduledValue: l.scheduledValue,
  fromPrevious: l.fromPrevious,
  thisPeriod: l.thisPeriod,
  stored: l.stored,
})

export function payApplicationSnapshot(app: SavedPayApplication): PayApplicationSnapshot {
  return {
    applicationNumber: app.applicationNumber,
    periodTo: app.periodTo,
    contractSumToDate: app.contractSumToDate,
    totalCompletedAndStored: app.totalCompletedAndStored,
    retainagePct: app.retainagePct,
    retainageHeld: app.retainageHeld,
    totalEarnedLessRetainage: app.totalEarnedLessRetainage,
    currentPaymentDue: app.currentPaymentDue,
    lines: app.lines.map(snapshotLine),
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A filed snapshot read back, defensively; null when it is not one (another paper's snapshot, or nothing). */
export function parsePayApplicationSnapshot(raw: unknown): PayApplicationSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.applicationNumber !== 'number' || !Array.isArray(r.lines)) return null
  return {
    applicationNumber: r.applicationNumber,
    periodTo: typeof r.periodTo === 'string' ? r.periodTo : null,
    contractSumToDate: num(r.contractSumToDate),
    totalCompletedAndStored: num(r.totalCompletedAndStored),
    retainagePct: num(r.retainagePct),
    retainageHeld: num(r.retainageHeld),
    totalEarnedLessRetainage: num(r.totalEarnedLessRetainage),
    currentPaymentDue: num(r.currentPaymentDue),
    lines: r.lines
      .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
      .map((l) => ({ id: str(l.id), label: str(l.label), scheduledValue: num(l.scheduledValue), fromPrevious: num(l.fromPrevious), thisPeriod: num(l.thisPeriod), stored: num(l.stored) })),
  }
}

/** One amount that moved since the workbook went out. */
export type ChangedAmount = { label: string; was: number; now: number }
export type ChangedAfterWentOut = {
  /** The newest workbook that carries a snapshot: what the GC has. */
  copy: SentCopy
  differences: ChangedAmount[]
}

const centsOf = (n: number): number => Math.round(n * 100)
const differs = (a: number, b: number): boolean => centsOf(a) !== centsOf(b)

/**
 * The saved application against the newest workbook that went out with a snapshot: null when
 * no workbook carries one, or nothing moved. Lines match by id, then by label; a line only on
 * one side is named as added or taken off. Then the G702's totals that moved.
 */
export function changedAfterWentOut(app: SavedPayApplication, wentOut: ReadonlyArray<SentCopy>): ChangedAfterWentOut | null {
  const newest = newestFirst(wentOut).find((c) => parsePayApplicationSnapshot(c.sourceSnapshot) != null)
  const snap = newest ? parsePayApplicationSnapshot(newest.sourceSnapshot) : null
  if (!newest || !snap) return null
  const differences: ChangedAmount[] = []
  const name = (label: string): string => label.trim() || 'The line'
  const matched = new Set<PayApplicationSnapshotLine>()
  for (const line of app.lines) {
    const then = snap.lines.find((l) => !matched.has(l) && l.id === line.id) ?? snap.lines.find((l) => !matched.has(l) && l.label.trim() === line.label.trim())
    if (!then) {
      differences.push({ label: `${name(line.label)}, a new line, this period`, was: 0, now: line.thisPeriod })
      continue
    }
    matched.add(then)
    const pairs: Array<[string, number, number]> = [
      ['scheduled value', then.scheduledValue, line.scheduledValue],
      ['from previous application', then.fromPrevious, line.fromPrevious],
      ['this period', then.thisPeriod, line.thisPeriod],
      ['stored', then.stored, line.stored],
    ]
    for (const [what, was, now] of pairs) if (differs(was, now)) differences.push({ label: `${name(line.label)} ${what}`, was, now })
  }
  for (const then of snap.lines) if (!matched.has(then)) differences.push({ label: `${name(then.label)}, a line taken off, this period`, was: then.thisPeriod, now: 0 })
  const totals: Array<[string, number, number]> = [
    ['contract sum to date', snap.contractSumToDate, app.contractSumToDate],
    ['completed and stored', snap.totalCompletedAndStored, app.totalCompletedAndStored],
    ['retainage held', snap.retainageHeld, app.retainageHeld],
    ['payment due', snap.currentPaymentDue, app.currentPaymentDue],
  ]
  for (const [what, was, now] of totals) if (differs(was, now)) differences.push({ label: what, was, now })
  return differences.length > 0 ? { copy: newest, differences } : null
}

/** "Changed after it went out Sep 2: Top Out this period $12,078.40 → $11,323.50 · payment due $10,870.56 → $10,191.15". */
export function changedAfterWords(changed: ChangedAfterWentOut, when: (iso: string) => string): string {
  const at = when(changed.copy.sentAt)
  const moved = changed.differences.map((d) => `${d.label} ${formatAiaMoney(d.was)} → ${formatAiaMoney(d.now)}`).join(' · ')
  return `Changed after it went out${at ? ` ${at}` : ''}: ${moved}`
}
