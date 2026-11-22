/**
 * The Document builder, step 6 (punch list #404): a trade's certificate held against a job's insurance sheet. One
 * certificate for each job (Taunya, 2026-11-21). Where a trade's certificate stands for one job, what the check list
 * allows, and the words for each. The sheet's lines come from `sheetAsks`, and a certificate is outdated when the
 * job's published sheet no longer reads the lines it was checked against (`asksOutdated`).
 *
 * A company uploads one certificate at a time from its page, with no job on it. The check gives it its job: marking
 * it good, or sending it back, names the job. A certificate checked for one job is never moved to another, so a
 * second job takes a second upload.
 *
 * Pure: no React, no supabase, no clock.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import type { BuilderChip } from './builders'
import { asksOutdated } from './sheet'

/** A company's certificate, as the table holds it. Days are the app's calendar days; instants are ISO. */
export type CertRow = {
  id: string
  companyId: string
  status: string
  /** The last day it is good. */
  expiresOn: string | null
  /** When the company sent it, or sent a newer file over it. */
  sentAt: string | null
  sentOn: string | null
  createdAt: string
  /** The file, where the company uploaded it. */
  url: string | null
  /** The job it was checked for. Null: not checked against a job's sheet yet. */
  sheetProjectId: string | null
  sheetRevision: number | null
  /** The sheet's lines it was marked good against. */
  sheetAsks: string[] | null
  checkedAt: string | null
  sentBackAt: string | null
  sentBackOn: string | null
  /** The lines it did not show when it was sent back. */
  missing: string[] | null
}

export type CertStanding =
  | { kind: 'none' }
  | { kind: 'came'; row: CertRow; cameOn: string | null }
  | { kind: 'good'; row: CertRow; goodUntil: string }
  | { kind: 'outdated'; row: CertRow }
  | { kind: 'ranOut'; row: CertRow; on: string }
  | { kind: 'sentBack'; row: CertRow; on: string | null; missing: number }

const newest = (rows: CertRow[], at: (r: CertRow) => string | null): CertRow | null =>
  [...rows].sort((a, b) => (at(b) ?? '').localeCompare(at(a) ?? '') || b.createdAt.localeCompare(a.createdAt))[0] ?? null

/** True while a certificate sent back has had no newer file sent over it. */
function stillSentBack(row: CertRow): boolean {
  return row.sentBackAt != null && (row.sentAt == null || row.sentAt <= row.sentBackAt)
}

/**
 * Where one company's certificate stands for one job. The rows are every certificate the company has. Only two kinds
 * count for a job: one checked for that job, and one waiting for a look with no job on it yet.
 */
export function certificateStanding(rows: ReadonlyArray<CertRow>, companyId: string, projectId: string, asksNow: ReadonlyArray<string>, today: string): CertStanding {
  const mine = rows.filter((r) => r.companyId === companyId && (r.sheetProjectId === projectId || (r.sheetProjectId === null && r.status === 'received')))
  // A file waiting for a look: sent and not looked at, or sent again after it was sent back.
  const waiting = newest(
    mine.filter((r) => r.status === 'received' && !stillSentBack(r)),
    (r) => r.sentAt,
  )
  if (waiting) return { kind: 'came', row: waiting, cameOn: waiting.sentOn }
  const back = newest(mine.filter(stillSentBack), (r) => r.sentBackAt)
  const good = newest(
    mine.filter((r) => r.status === 'signed' && r.sheetProjectId === projectId && r.sheetAsks != null),
    (r) => r.checkedAt,
  )
  if (back && (!good || (back.sentBackAt ?? '') >= (good.checkedAt ?? ''))) return { kind: 'sentBack', row: back, on: back.sentBackOn, missing: back.missing?.length ?? 0 }
  if (!good) return { kind: 'none' }
  if (good.expiresOn != null && good.expiresOn <= today) return { kind: 'ranOut', row: good, on: good.expiresOn }
  if (asksOutdated(good.sheetAsks ?? [], asksNow)) return { kind: 'outdated', row: good }
  return { kind: 'good', row: good, goodUntil: good.expiresOn ?? '' }
}

const things = (n: number): string => `${n} ${n === 1 ? 'thing' : 'things'} missing`

/** The chip on a trade's row. */
export function certificateChip(s: CertStanding): BuilderChip {
  if (s.kind === 'none') return { tone: 'wait', words: 'No certificate yet' }
  if (s.kind === 'came') return { tone: 'warn', words: s.cameOn ? `Certificate came in ${formatWorkDateYmdMonthDayShort(s.cameOn)}` : 'Certificate came in' }
  if (s.kind === 'good') return { tone: 'ok', words: s.goodUntil ? `Certificate good to ${formatWorkDateYmdMonthDayShort(s.goodUntil)}` : 'Certificate good' }
  if (s.kind === 'outdated') return { tone: 'warn', words: 'The sheet changed since their certificate' }
  if (s.kind === 'ranOut') return { tone: 'warn', words: `Their certificate ran out ${formatWorkDateYmdMonthDayShort(s.on)}` }
  return { tone: 'wait', words: s.on ? `Sent back ${formatWorkDateYmdMonthDayShort(s.on)}, ${things(s.missing)}` : `Sent back, ${things(s.missing)}` }
}

/** The press on a trade's row, and the certificate it opens. Null: nothing to check, the next move is theirs. */
export function certificatePress(s: CertStanding): { label: string; row: CertRow } | null {
  if (s.kind === 'came') return { label: 'Check it against the sheet', row: s.row }
  if (s.kind === 'outdated') return { label: 'Check it again', row: s.row }
  return null
}

export type CertCheck = {
  /** The lines not ticked, in the sheet's order: what goes back to them, in words. */
  missing: string[]
  /** The first press: how far the ticking is, then the act. */
  goodLabel: string
  canMarkGood: boolean
  /** Why Mark it good is dead with every line ticked. An empty string otherwise. */
  goodWhy: string
  backLabel: string
  canSendBack: boolean
}

/**
 * What the check list allows. Mark it good needs every line ticked and a day it is good until that has not passed.
 * Send it back needs at least one line ticked and at least one left, so a certificate is never sent back unread.
 */
export function certificateCheck(asks: ReadonlyArray<string>, ticked: ReadonlyArray<boolean>, goodUntil: string, today: string): CertCheck {
  const done = asks.filter((_, i) => ticked[i] === true).length
  const missing = asks.filter((_, i) => ticked[i] !== true)
  const all = asks.length > 0 && missing.length === 0
  const day = /^\d{4}-\d{2}-\d{2}$/.test(goodUntil) ? goodUntil : ''
  const goodWhy = !all ? '' : !day ? 'Say the day it is good until.' : day <= today ? 'That day has passed. Ask them for the current certificate.' : ''
  return {
    missing,
    goodLabel: all ? 'Mark it good' : `${done} of ${asks.length} checked`,
    canMarkGood: all && goodWhy === '',
    goodWhy,
    backLabel: missing.length > 0 ? `Send it back, naming ${missing.length} ${missing.length === 1 ? 'thing' : 'things'} missing` : 'Send it back',
    canSendBack: done > 0 && missing.length > 0,
  }
}

/** The line over the list: how many certificates wait for a look, and how many trades have none. */
export function certificateCounts(standings: ReadonlyArray<CertStanding>): string {
  const toCheck = standings.filter((s) => s.kind === 'came' || s.kind === 'outdated').length
  const none = standings.filter((s) => s.kind === 'none' || s.kind === 'sentBack' || s.kind === 'ranOut').length
  const parts: string[] = []
  if (toCheck > 0) parts.push(`${toCheck} ${toCheck === 1 ? 'certificate' : 'certificates'} to check.`)
  if (none > 0) parts.push(`${none} ${none === 1 ? 'trade has' : 'trades have'} no good certificate.`)
  if (parts.length === 0) return standings.length > 0 ? 'Every trade has a certificate.' : ''
  return parts.join(' ')
}

/** The email that sends a certificate back: the lines it did not show, in the sheet's own words. */
export function certificateBackEmail(job: string, missing: ReadonlyArray<string>): { subject: string; lines: Array<string | { title?: string; items: string[] }> } {
  return {
    subject: `Your certificate of insurance for ${job} needs a change`,
    lines: [`We checked your certificate of insurance against what ${job} asks.`, { title: 'It did not show:', items: [...missing] }, 'Please ask your insurance agent for a certificate that shows these. Then send it from your page.'],
  }
}
