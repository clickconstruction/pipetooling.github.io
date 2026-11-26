/**
 * What a payoff keeps on a filed lien (punch list #435, piece 4): the day a release was asked for in writing, and a
 * leader's, a controller's or a dev's word that the bank confirmed the funds. Both live in the `fields` the
 * affidavit row already saves (`job_lien_filings`, kind `affidavit`), one per lien, as a release keeps its link and
 * its own instrument number (`lienReleaseOfRecord.ts`). The pick answered on 2026-11-26 over the card's small table:
 * a written request and a release are per lien in the Code (§ 53.152), and the check is already named by the
 * payment rows' number, day and note. A later piece may lift them into columns. No migration.
 *
 * Pure; tested beside it. The writes are `lienPayoffCardIo.ts`, the readers `lienPayoff.ts`, `lienPayoffCard.ts`
 * and `lienReleaseOfRecord.ts`.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'

/** Who said the bank confirmed the funds, when, and what the bank said. */
export type FundsConfirmed = { by: string; name: string; at: string; note: string }

export const PAYOFF_FIELD_KEYS = { asked: 'releaseAskedYmd', funds: 'fundsConfirmed' } as const

export type PayoffNote = {
  /** The day a release was asked for in writing, or ''. */
  askedYmd: string
  funds: FundsConfirmed | null
}

const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const asObject = (fields: unknown): Record<string, unknown> => (fields && typeof fields === 'object' && !Array.isArray(fields) ? { ...(fields as Record<string, unknown>) } : {})

/** The confirmation as the row holds it, or null when the row holds none or a broken one. */
export function readFundsConfirmed(raw: unknown): FundsConfirmed | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  const at = typeof f.at === 'string' ? f.at : ''
  if (!at) return null
  return { by: typeof f.by === 'string' ? f.by : '', name: typeof f.name === 'string' ? f.name.trim() : '', at, note: typeof f.note === 'string' ? f.note.trim() : '' }
}

/** The two facts off an affidavit row's `fields`. */
export function payoffNote(fields: unknown): PayoffNote {
  const f = asObject(fields)
  const asked = f[PAYOFF_FIELD_KEYS.asked]
  return { askedYmd: isYmd(asked) ? asked : '', funds: readFundsConfirmed(f[PAYOFF_FIELD_KEYS.funds]) }
}

export type PayoffFieldsChange = {
  /** '' takes the day off. Left out, the day is left alone. */
  askedYmd?: string
  /** Null takes the confirmation off. Left out, it is left alone. */
  funds?: FundsConfirmed | null
}

/** The row's `fields` with the change in it and every other field kept. */
export function payoffFieldsPatch(fields: unknown, change: PayoffFieldsChange): Record<string, unknown> {
  const out = asObject(fields)
  if (change.askedYmd !== undefined) {
    const day = change.askedYmd.trim()
    if (isYmd(day)) out[PAYOFF_FIELD_KEYS.asked] = day
    else delete out[PAYOFF_FIELD_KEYS.asked]
  }
  if (change.funds !== undefined) {
    if (change.funds) out[PAYOFF_FIELD_KEYS.funds] = { by: change.funds.by, name: change.funds.name, at: change.funds.at, note: change.funds.note }
    else delete out[PAYOFF_FIELD_KEYS.funds]
  }
  return out
}

/** A confirmation as the press makes it: who pressed, when, and what the bank said. */
export function fundsConfirmedNow(who: { id: string; name: string }, note: string, atIso: string): FundsConfirmed {
  return { by: who.id, name: who.name.trim(), at: atIso, note: note.trim() }
}

/** *Alex Rivera confirmed the funds Nov 26.*, with its values marked. The name falls back to *A leader*. */
export function fundsConfirmedWords(funds: FundsConfirmed): string {
  const day = formatYmdMonthDay(calendarYmdInAppTzFromIso(funds.at))
  return `${val('who', funds.name || 'A leader')} confirmed the funds ${val('day', day)}.`
}
