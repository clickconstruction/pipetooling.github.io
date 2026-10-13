/**
 * Docsmit's switches and numbers (the Docsmit train — `docs/DOCSMIT_LIEN_RUN_PLAN.md`, "Managed from
 * Developer settings"): `app_settings` rows under `docsmit_*`, read by the run and written by the
 * Developer block. Pure: rows in, one typed object out with every default filled, and back.
 */
import type { MailReceipt } from './mailPiece'

export type DocsmitSettings = {
  /** Which Docsmit the functions talk to; informational here, the secret DOCSMIT_BASE_URL decides. */
  env: 'tracksmit' | 'prod'
  /** Runs open on paper and the button hides. */
  paused: boolean
  /** Which door a run opens on: Docsmit, paper, or whatever the last run used. */
  runDefault: 'docsmit' | 'paper' | 'last'
  /** D1: the electronic return receipt, or the green card. */
  returnReceipt: MailReceipt
  /** The plain First Class copy beside the certified one, by default. */
  plusDefault: boolean
  /** Docsmit's production cutoff, Central, "15:00". */
  cutoffLocal: string
  /** Business days before a window's last day the send-by strip aims at. */
  sendByBufferDays: number
  /** The balance under which the run warns. */
  creditWarn: number
  /** How often the poll reads back. */
  pollMinutes: number
  /** Callbacks on, once PR 8 lands. */
  callbacks: boolean
  /** The poll also lists what was sent by hand from Docsmit's site. */
  matchSite: boolean
}

export const DOCSMIT_SETTINGS_DEFAULT: DocsmitSettings = {
  env: 'tracksmit',
  paused: false,
  runDefault: 'docsmit',
  returnReceipt: 'electronic',
  plusDefault: false,
  cutoffLocal: '15:00',
  sendByBufferDays: 1,
  creditWarn: 25,
  pollMinutes: 60,
  callbacks: false,
  matchSite: false,
}

/** The `app_settings` keys, one per field. */
export const DOCSMIT_SETTING_KEYS = {
  env: 'docsmit_env',
  paused: 'docsmit_paused',
  runDefault: 'docsmit_run_default',
  returnReceipt: 'docsmit_return_receipt',
  plusDefault: 'docsmit_plus_default',
  cutoffLocal: 'docsmit_cutoff_local',
  sendByBufferDays: 'docsmit_send_by_buffer_days',
  creditWarn: 'docsmit_credit_warn',
  pollMinutes: 'docsmit_poll_minutes',
  callbacks: 'docsmit_callbacks',
  matchSite: 'docsmit_match_site',
} as const satisfies Record<keyof DocsmitSettings, string>

export const DOCSMIT_SETTING_KEY_LIST: string[] = Object.values(DOCSMIT_SETTING_KEYS)

export type SettingRowLike = { key: string; value_text?: string | null; value_num?: number | null }

function bool(v: string | undefined, d: boolean): boolean {
  if (v === undefined) return d
  const s = v.trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
  return d
}

function num(v: string | undefined, d: number, min: number, max: number): number {
  if (v === undefined) return d
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

function clock(v: string | undefined, d: string): string {
  if (v === undefined) return d
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return d
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return d
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** The settings from the rows that exist; a missing, blank or malformed row keeps its default. */
export function docsmitSettingsFrom(rows: ReadonlyArray<SettingRowLike>): DocsmitSettings {
  const text = new Map<string, string>()
  for (const r of rows) {
    const v = typeof r.value_text === 'string' && r.value_text.trim() ? r.value_text : typeof r.value_num === 'number' ? String(r.value_num) : undefined
    if (v !== undefined) text.set(r.key, v)
  }
  const get = (k: keyof DocsmitSettings) => text.get(DOCSMIT_SETTING_KEYS[k])
  const d = DOCSMIT_SETTINGS_DEFAULT
  const env = (get('env') ?? '').trim().toLowerCase()
  const runDefault = (get('runDefault') ?? '').trim().toLowerCase()
  const receipt = (get('returnReceipt') ?? '').trim().toLowerCase()
  return {
    env: env === 'prod' ? 'prod' : env === 'tracksmit' ? 'tracksmit' : d.env,
    paused: bool(get('paused'), d.paused),
    runDefault: runDefault === 'docsmit' || runDefault === 'paper' || runDefault === 'last' ? runDefault : d.runDefault,
    returnReceipt: receipt === 'card' ? 'card' : receipt === 'err' || receipt === 'electronic' ? 'electronic' : d.returnReceipt,
    plusDefault: bool(get('plusDefault'), d.plusDefault),
    cutoffLocal: clock(get('cutoffLocal'), d.cutoffLocal),
    sendByBufferDays: Math.round(num(get('sendByBufferDays'), d.sendByBufferDays, 0, 10)),
    creditWarn: num(get('creditWarn'), d.creditWarn, 0, 100_000),
    pollMinutes: Math.round(num(get('pollMinutes'), d.pollMinutes, 5, 24 * 60)),
    callbacks: bool(get('callbacks'), d.callbacks),
    matchSite: bool(get('matchSite'), d.matchSite),
  }
}

/** The rows that spell these settings, as the Developer block writes them (`value_text` only). */
export function docsmitSettingRows(s: DocsmitSettings): Array<{ key: string; value_text: string }> {
  return [
    { key: DOCSMIT_SETTING_KEYS.env, value_text: s.env },
    { key: DOCSMIT_SETTING_KEYS.paused, value_text: String(s.paused) },
    { key: DOCSMIT_SETTING_KEYS.runDefault, value_text: s.runDefault },
    { key: DOCSMIT_SETTING_KEYS.returnReceipt, value_text: s.returnReceipt === 'card' ? 'card' : 'err' },
    { key: DOCSMIT_SETTING_KEYS.plusDefault, value_text: String(s.plusDefault) },
    { key: DOCSMIT_SETTING_KEYS.cutoffLocal, value_text: s.cutoffLocal },
    { key: DOCSMIT_SETTING_KEYS.sendByBufferDays, value_text: String(s.sendByBufferDays) },
    { key: DOCSMIT_SETTING_KEYS.creditWarn, value_text: String(s.creditWarn) },
    { key: DOCSMIT_SETTING_KEYS.pollMinutes, value_text: String(s.pollMinutes) },
    { key: DOCSMIT_SETTING_KEYS.callbacks, value_text: String(s.callbacks) },
    { key: DOCSMIT_SETTING_KEYS.matchSite, value_text: String(s.matchSite) },
  ]
}
