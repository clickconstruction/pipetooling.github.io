/**
 * Quick time add (docs/recent-features/v2.3655.md, v2.3659, v2.3663, v2.3676–v2.3678): office staff add 5–30 minutes for an off-hours call
 * or email without clocking in. The rules are the database's — `add_quick_time()` (migration
 * 20260921042405) refuses whatever this kernel would — and this is their mirror, so the sheet
 * can say why Save is off before a round trip. The sentences here ARE the RPC's sentences;
 * `quickTimeAdd.test.ts` pins the two together.
 *
 * A quick add is an ordinary finished clock session marked `quick_add_minutes`, on the Office
 * job. Pure: no React, no supabase.
 */

/** The element under the Dashboard's clock row that the clock portals its door into. */
export const QUICK_ADD_DOOR_SLOT_ID = 'clock-quick-add-door'

export const QUICK_ADD_STEP = 5
export const QUICK_ADD_MAX = 30
export const QUICK_ADD_NOTE_MIN = 3
export const QUICK_ADD_NOTE_MAX = 200
/** `app_settings.quick_add_daily_ceiling_minutes` when the row is missing. */
export const QUICK_ADD_DEFAULT_DAILY_CEILING = 120

/** The roles the door is for when the owner has not chosen (owner call 1, 2026-09-20). Field roles never see it. */
export const QUICK_ADD_ROLES: readonly string[] = ['assistant', 'controller', 'estimator', 'dev']

/**
 * The roles the owner may give the door to on Settings → People & teams (v2.3677) — the office
 * roles and the leaders who take after-hours calls (primary, master technician). Field roles
 * (helpers, subs, superintendent) are not offered: their time is the clock's.
 */
export const QUICK_ADD_ROLE_CHOICES: readonly { role: string; label: string }[] = [
  { role: 'assistant', label: 'Assistant' },
  { role: 'controller', label: 'Controller' },
  { role: 'estimator', label: 'Estimator' },
  { role: 'primary', label: 'Primary' },
  { role: 'master_technician', label: 'Master technician' },
  { role: 'dev', label: 'Dev' },
]

/** A window that is not today's is still taken when it ended within this many minutes (v2.3678: the half hour after midnight). */
export const QUICK_ADD_RECENT_WINDOW_MINUTES = 120
export const QUICK_ADD_CEILING_MIN = 5
export const QUICK_ADD_CEILING_MAX = 600

/**
 * `app_settings.quick_add_roles_v1` (a comma list) → the roles with the door. Unknown names and
 * field roles are dropped; a missing, blank or all-unknown value is the default list — the same
 * reading `add_quick_time()` makes.
 */
export function parseQuickAddRoles(valueText: string | null | undefined): string[] {
  const known = new Set(QUICK_ADD_ROLE_CHOICES.map((c) => c.role))
  const roles = [...new Set((valueText ?? '').split(',').map((r) => r.trim().toLowerCase()).filter((r) => known.has(r)))]
  return roles.length > 0 ? roles : [...QUICK_ADD_ROLES]
}

export function serializeQuickAddRoles(roles: readonly string[]): string {
  return QUICK_ADD_ROLE_CHOICES.map((c) => c.role).filter((r) => roles.includes(r)).join(',')
}

/** `app_settings.quick_add_daily_ceiling_minutes` → whole minutes in 5…600; anything else is the default 120. */
export function parseQuickAddDailyCeiling(valueNum: number | string | null | undefined): number {
  const n = typeof valueNum === 'string' ? Number(valueNum.trim()) : valueNum
  if (n == null || !Number.isFinite(n)) return QUICK_ADD_DEFAULT_DAILY_CEILING
  const whole = Math.floor(n)
  return whole >= QUICK_ADD_CEILING_MIN && whole <= QUICK_ADD_CEILING_MAX ? whole : QUICK_ADD_DEFAULT_DAILY_CEILING
}

export const QUICK_ADD_SENTENCES = {
  notOffice: 'Quick time is for office staff.',
  readOnly: 'Training mode is read-only — nothing was added.',
  salaried: 'Your hours come from your salary schedule, so there is nothing to add.',
  shape: 'Quick time is 5 to 30 minutes, in fives.',
  note: 'Say what it was — the office reads this when it approves your hours.',
  today: 'Quick time is for today, or the last two hours. For another day, use My Time.',
  clockedIn: 'You are clocked in — this time is already counting.',
} as const

/** The composer's kinds. The note is written "Call — Acme, the Oak St invoice". */
export const QUICK_ADD_KINDS = ['Call', 'Email', 'Text'] as const
export type QuickAddKind = (typeof QUICK_ADD_KINDS)[number]

/** "ended … ago" choices under the When line; 0 = just now. */
export const QUICK_ADD_AGO_CHOICES: readonly number[] = [0, 15, 30, 60, 120]

export function quickAddAgoLabel(agoMinutes: number): string {
  if (agoMinutes <= 0) return 'just now'
  return agoMinutes < 60 ? `${agoMinutes} min ago` : `${agoMinutes / 60} h ago`
}

/** The six cells of the bar. */
export const QUICK_ADD_CELLS: readonly number[] = [5, 10, 15, 20, 25, 30]

/**
 * Tapping a cell jumps the length there; tapping the lit LAST cell steps back one — which is
 * why the bar needs no −5 (tap "10" while on 10 → 5; tap "5" while on 5 → 0).
 */
export function tapQuickAddCell(current: number, cellMinutes: number): number {
  if (!QUICK_ADD_CELLS.includes(cellMinutes)) return current
  return current === cellMinutes ? cellMinutes - QUICK_ADD_STEP : cellMinutes
}

/** The note as stored: the kind, an em dash, the words — trimmed and capped as the RPC caps it. */
export function quickAddNote(kind: QuickAddKind, words: string): string {
  return `${kind} — ${words.trim().replace(/\s+/g, ' ')}`.slice(0, QUICK_ADD_NOTE_MAX)
}

/** The button says the number back: "Add time" · "Add 10 min — say what it was" · "Add 10 min". */
export function quickAddButtonLabel(minutes: number, words: string): string {
  if (!isQuickAddLength(minutes)) return 'Add time'
  return words.trim().length >= QUICK_ADD_NOTE_MIN ? `Add ${minutes} min` : `Add ${minutes} min — say what it was`
}

/** +5 / −5 on the stepper: fives, never below 0, never past 30. */
export function stepQuickAddMinutes(current: number, direction: 1 | -1): number {
  const snapped = Math.round((Number.isFinite(current) ? current : 0) / QUICK_ADD_STEP) * QUICK_ADD_STEP
  return Math.min(QUICK_ADD_MAX, Math.max(0, snapped + direction * QUICK_ADD_STEP))
}

export function isQuickAddLength(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= QUICK_ADD_STEP && minutes <= QUICK_ADD_MAX && minutes % QUICK_ADD_STEP === 0
}

/** Who gets the door at all. Salaried people who still record hours punch like anyone, so they do. `roles` is the owner's list (v2.3677), the default when unset. */
export function canUseQuickAdd(who: { role: string | null | undefined; isSalary: boolean; recordsHoursButSalary: boolean; readOnly: boolean; clockedIn: boolean }, roles: readonly string[] = QUICK_ADD_ROLES): boolean {
  if (!who.role || !roles.includes(who.role)) return false
  if (who.readOnly || who.clockedIn) return false
  return !(who.isSalary && !who.recordsHoursButSalary)
}

export type QuickAddWindow = { startMs: number; endMs: number }

/** The session a quick add writes: it ends on the minute it was said to end, and starts `minutes` before. */
export function quickAddWindow(endedAtMs: number, minutes: number): QuickAddWindow {
  const endMs = Math.floor(endedAtMs / 60_000) * 60_000
  return { startMs: endMs - minutes * 60_000, endMs }
}

export type QuickAddSession = { clockedInMs: number; clockedOutMs: number | null; rejected?: boolean; revoked?: boolean }

/** The first of the person's live, finished sessions the window runs into; null when it is clear. */
export function quickAddClash(window: QuickAddWindow, sessions: readonly QuickAddSession[]): QuickAddSession | null {
  return (
    [...sessions]
      .filter((s) => !s.rejected && !s.revoked && s.clockedOutMs != null)
      .sort((a, b) => a.clockedInMs - b.clockedInMs)
      .find((s) => s.clockedInMs < window.endMs && (s.clockedOutMs as number) > window.startMs) ?? null
  )
}

export function quickAddClashSentence(clash: QuickAddSession, formatTime: (ms: number) => string): string {
  return `You already have hours ${formatTime(clash.clockedInMs)} – ${formatTime(clash.clockedOutMs as number)}. Pick an end time outside that, or edit that day on My Time.`
}

export function quickAddCeilingSentence(dayTotalWithThis: number, ceiling: number): string {
  return `That would be ${dayTotalWithThis} minutes of quick adds today (the most is ${ceiling}). If you are working a stretch, clock in instead.`
}

export type QuickAddDraft = {
  minutes: number
  /** What the person typed — the kind prefix does not count toward "say what it was". */
  note: string
  endedAtMs: number
  nowMs: number
  /** The company-calendar day (YYYY-MM-DD) of an instant — `ymdInAppTz` from dateUtils. */
  dayOf: (ms: number) => string
  formatTime: (ms: number) => string
  sessions: readonly QuickAddSession[]
  /** Minutes of live quick adds already on today. */
  dayTotalMinutes: number
  dailyCeilingMinutes?: number
}

/** Why this draft cannot be saved, in the RPC's words and the RPC's order — or null when it can. */
export function quickAddRefusal(d: QuickAddDraft): string | null {
  if (!isQuickAddLength(d.minutes)) return QUICK_ADD_SENTENCES.shape
  if (d.note.trim().length < QUICK_ADD_NOTE_MIN) return QUICK_ADD_SENTENCES.note
  const window = quickAddWindow(d.endedAtMs, d.minutes)
  const today = d.dayOf(d.nowMs)
  if (window.endMs > d.nowMs + 60_000) return QUICK_ADD_SENTENCES.today
  // Today on the company calendar, start and end — or ended within the last two hours, so the
  // call that ran 11:54 pm – 12:04 am can still be added at 12:05 (or 11:50 pm's at 12:30).
  const sameDay = d.dayOf(window.endMs) === today && d.dayOf(window.startMs) === today
  const recent = d.nowMs - window.endMs <= QUICK_ADD_RECENT_WINDOW_MINUTES * 60_000
  if (!sameDay && !recent) return QUICK_ADD_SENTENCES.today
  if (d.sessions.some((s) => !s.rejected && !s.revoked && s.clockedOutMs == null)) return QUICK_ADD_SENTENCES.clockedIn
  const clash = quickAddClash(window, d.sessions)
  if (clash) return quickAddClashSentence(clash, d.formatTime)
  const ceiling = d.dailyCeilingMinutes ?? QUICK_ADD_DEFAULT_DAILY_CEILING
  if (d.dayTotalMinutes + d.minutes > ceiling) return quickAddCeilingSentence(d.dayTotalMinutes + d.minutes, ceiling)
  return null
}

/**
 * "Adds 7:40 pm – 7:50 pm today · 10 min · Office" — the line under the sheet, before saving. Given
 * `dayOf` and `nowMs`, a window that started on an earlier day says "last night" instead of "today".
 */
export function quickAddEntryLine(minutes: number, endedAtMs: number, formatTime: (ms: number) => string, cal?: { dayOf: (ms: number) => string; nowMs: number }): string | null {
  if (!isQuickAddLength(minutes)) return null
  const w = quickAddWindow(endedAtMs, minutes)
  return `Adds ${formatTime(w.startMs)} – ${formatTime(w.endMs)} ${quickAddDayWord(w, cal)} · ${minutes} min · Office`
}

/** "today", or "last night" when the window started before today (v2.3678). */
export function quickAddDayWord(w: QuickAddWindow, cal?: { dayOf: (ms: number) => string; nowMs: number }): string {
  return cal && cal.dayOf(w.startMs) !== cal.dayOf(cal.nowMs) ? 'last night' : 'today'
}

/** "1 h 05 m across 8 entries" — the approver's weekly line for one person; null when there are none. */
export function weeklyQuickAddLine(rows: readonly { quickAddMinutes: number | null; rejected?: boolean; revoked?: boolean }[]): string | null {
  const live = rows.filter((r) => r.quickAddMinutes != null && !r.rejected && !r.revoked)
  if (live.length === 0) return null
  const total = live.reduce((n, r) => n + (r.quickAddMinutes as number), 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  const span = h > 0 ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`
  return `${span} across ${live.length} ${live.length === 1 ? 'entry' : 'entries'}`
}
