import type { SavedPayApplication } from './aiaPayApplications'
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
