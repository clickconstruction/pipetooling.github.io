/**
 * Your pay on a subcontractor's job window (punch list #355, v2.7399; Taunya's pick of 2026-11-15, "Draw it now"):
 * what is open on the sub's own sheets on this job, with the agreed price, what has been paid and when it pays.
 *
 * The money is the portal's. `my_sub_sheets_on_job` hands back the rows the sub's portal reads (their sheets on this
 * job through the junction, the items, the payments), and `buildSubSheets`, the portal's own kernel, works out
 * agreed, paid, back-charged and open. This file only adds the sheets up and puts them in words, the portal's own
 * where it has them. A job with no sheet of theirs says so; it never guesses.
 *
 * Pure: no React, no Supabase.
 */
import {
  buildSubSheets,
  type SubItemRow,
  type SubPaymentRow,
  type SubPortalSheet,
  type SubSheetRow,
} from '../../../supabase/functions/_shared/subPortalStatement'
import { formatPortalUsd } from '../portal/portalPayload'
import { portalShortUrl } from '../portal/portalShortOrigin'
import { formatSubPortalDate, subPortalT, type SubPortalStringKey } from '../subPortal/subPortalI18n'
import { subPortalRailStep } from '../subPortal/subPortalRail'

export type MySubSheets = {
  /** The signed-in account is a person on the roster; false, and the window draws no row. */
  onRoster: boolean
  /** Their sheets on this job as the portal states them, oldest first. */
  sheets: SubPortalSheet[]
  /** The day of their newest payment on these sheets, for a job that is paid in full. */
  lastPaymentYmd: string | null
  /** Their own portal, when they have an address or a live link; null draws no door. */
  portalUrl: string | null
}

const rows = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** The function's answer as the row reads it; null when the answer is not the shape it sends (a refusal, an old client). */
export function mySubSheetsFromRpc(raw: unknown, origin: string): MySubSheets | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.on_roster !== 'boolean') return null
  const payments = rows<SubPaymentRow>(r.payments)
  const sheets = buildSubSheets(rows<SubSheetRow>(r.sheets), rows<SubItemRow>(r.items), payments)
  const lastPaymentYmd = payments
    .filter((p) => Number(p.amount) > 0 && typeof p.payment_date === 'string' && p.payment_date)
    .map((p) => (p.payment_date as string).slice(0, 10))
    .sort()
    .pop() ?? null
  const slug = typeof r.portal_slug === 'string' ? r.portal_slug.trim() : ''
  const token = typeof r.portal_token === 'string' ? r.portal_token.trim() : ''
  const portalUrl = slug ? portalShortUrl(slug) : token ? `${origin}/sub?t=${encodeURIComponent(token)}` : null
  return { onRoster: r.on_roster, sheets, lastPaymentYmd, portalUrl }
}

export type SubPayWords = {
  /** The row's answer: *$2,100.00 open*, *Paid in full*, or *No sheet in your name here*. */
  value: string
  /** The quiet lines under it, in order. */
  lines: string[]
}

export const NO_SHEET_VALUE = 'No sheet in your name here'
export const NO_SHEET_LINE = 'The office has not put your work on this job yet.'
export const OPEN_YOUR_PORTAL = 'Open your portal'

const RAIL: readonly SubPortalStringKey[] = ['railWork', 'railWalk', 'railCustomer', 'railPaid']
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The row's words. Several sheets on one job add up, and the line says how many. What decides the last line, first
 * that applies: nothing open (paid in full, with the day of the last payment); the office's hold and its reason; the
 * earliest day the office has promised; else the stage of the sheet that is furthest behind, in the portal's word.
 */
export function subPayWords(read: Pick<MySubSheets, 'sheets' | 'lastPaymentYmd'>): SubPayWords {
  const { sheets } = read
  if (sheets.length === 0) return { value: NO_SHEET_VALUE, lines: [NO_SHEET_LINE] }
  const sum = (pick: (s: SubPortalSheet) => number) => round2(sheets.reduce((n, s) => n + pick(s), 0))
  const agreed = sum((s) => s.agreed)
  const paid = sum((s) => s.paid)
  const back = sum((s) => s.backcharges)
  const open = sum((s) => s.open)
  const money = [`${formatPortalUsd(agreed)} agreed`, paid > 0 ? `${formatPortalUsd(paid)} paid` : 'nothing paid yet', ...(back > 0 ? [`${formatPortalUsd(back)} back-charged`] : [])].join(' · ')
  const lines = [...(sheets.length > 1 ? [`${sheets.length} sheets on this job`] : []), money]
  if (open <= 0) {
    return { value: 'Paid in full', lines: [...lines, ...(read.lastPaymentYmd ? [`Last payment ${formatSubPortalDate(read.lastPaymentYmd, 'en')}`] : [])] }
  }
  const stillOpen = sheets.filter((s) => s.open > 0)
  const held = stillOpen.find((s) => s.payHoldReason)
  const payable = stillOpen.map((s) => (s.payableAfter ?? '').trim()).filter(Boolean).sort()[0]
  const last = held
    ? `On hold: ${held.payHoldReason}`
    : payable
      ? subPortalT('en', 'payableAfter', { date: formatSubPortalDate(payable, 'en') })
      : `Stage: ${subPortalT('en', RAIL[Math.min(...stillOpen.map((s) => subPortalRailStep(s)))] ?? 'railWork')}`
  return { value: `${formatPortalUsd(open)} open`, lines: [...lines, last] }
}
