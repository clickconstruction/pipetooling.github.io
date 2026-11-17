/**
 * Tell the dev (punch list #380): the state of the page that goes with a note.
 *
 * The box lists every part of it before the press, so the sender sees what will be sent. It is
 * words and numbers the app already holds. It is never a picture of the screen, which could hold
 * a customer's address, a pay rate or an HR note.
 *
 * Pure: every function takes what it needs, `now` included. The reads of the page (the open
 * window, the screen) live with the component.
 */
import { humanRoleLabel } from '../roleLabels'
import type { RecentTrouble } from './trouble'

/** Which door the note came through. */
export type NoteDoor = 'wrench' | 'header' | 'window' | 'error_line'

export type NoteContext = {
  v: 1
  /** 'Jobs · Stages', from the page key. */
  page_label: string
  /** The open window's title, or null with none open. */
  window: string | null
  role: string | null
  /** The seat the note was written from, when it is not a plain one. */
  seat: { training?: true; twin?: true; viewing_as?: true }
  screen: { kind: 'phone' | 'desk'; width: number; height: number }
  /** The modes that were on: 'Job Mode', 'Dispatch Mode', 'Task Mode'. */
  modes: string[]
  app_version: string | null
  door: NoteDoor
  /** The last error lines shown, newest first, each with how long before the note. */
  errors: { words: string; ago_s: number }[]
  /** The last calls the server refused, newest first. A lost signal is never one of these. */
  refused: { what: string; status: number; ago_s: number }[]
}

export type NoteContextInput = {
  pageLabel: string
  windowTitle: string | null
  role: string | null
  training: boolean
  twin: boolean
  viewingAs: boolean
  isPhone: boolean
  width: number
  height: number
  modes: readonly string[]
  appVersion: string | null
  door: NoteDoor
  trouble: RecentTrouble
}

const WORDS_MAX = 240
const WINDOW_MAX = 120

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`
}

function agoSeconds(at: number, now: number): number {
  return Math.max(0, Math.round((now - at) / 1000))
}

export function buildNoteContext(input: NoteContextInput, now: number): NoteContext {
  const seat: NoteContext['seat'] = {}
  if (input.training) seat.training = true
  if (input.twin) seat.twin = true
  if (input.viewingAs) seat.viewing_as = true
  const windowTitle = input.windowTitle ? clip(input.windowTitle, WINDOW_MAX) : ''
  return {
    v: 1,
    page_label: clip(input.pageLabel, 80) || 'Home',
    window: windowTitle || null,
    role: input.role,
    seat,
    screen: { kind: input.isPhone ? 'phone' : 'desk', width: Math.round(input.width), height: Math.round(input.height) },
    modes: input.modes.slice(0, 4),
    app_version: input.appVersion,
    door: input.door,
    errors: input.trouble.errors.slice(0, 3).map((e) => ({ words: clip(e.words, WORDS_MAX), ago_s: agoSeconds(e.at, now) })),
    refused: input.trouble.refused.slice(0, 5).map((r) => ({ what: clip(r.what, 80), status: r.status, ago_s: agoSeconds(r.at, now) })),
  }
}

// ---------------------------------------------------------------------------
// The address

/** Keys whose values are a pass of some kind and never belong on a note. */
const SECRET_KEY_RE = /^(t|token|access_token|refresh_token|code|key|sig|signature|secret|password|otp)$/i

export const PAGE_PATH_MAX = 600

/**
 * The in-app address a note is written on: the path and its query, without the hash and without
 * any key that is a pass. Clipped to what the table takes.
 */
export function notePagePath(pathname: string, search: string): string {
  const path = pathname && pathname.startsWith('/') ? pathname : '/'
  let query = ''
  try {
    const params = new URLSearchParams(search ?? '')
    for (const key of [...params.keys()]) if (SECRET_KEY_RE.test(key)) params.delete(key)
    query = params.toString()
  } catch {
    query = ''
  }
  const whole = query ? `${path}?${query}` : path
  return whole.length <= PAGE_PATH_MAX ? whole : path.slice(0, PAGE_PATH_MAX)
}

/** The address as a link the inbox may follow: an in-app path, or null for anything else. */
export function openThatPagePath(pagePath: string | null | undefined): string | null {
  if (!pagePath) return null
  if (!pagePath.startsWith('/') || pagePath.startsWith('//') || pagePath.includes('\\')) return null
  return pagePath
}

// ---------------------------------------------------------------------------
// The words

function agoWords(seconds: number): string {
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  return minutes <= 1 ? '1 min ago' : `${minutes} min ago`
}

/** The role in the words the app already uses for it; nothing for no role. */
export function roleWords(role: string | null | undefined): string {
  return role ? humanRoleLabel(role) : ''
}

function screenWords(ctx: NoteContext): string {
  const base = ctx.screen.kind === 'phone' ? 'Phone' : `Desk, ${ctx.screen.width} wide`
  return ctx.modes.length ? `${base}, ${ctx.modes.join(' and ')} on` : base
}

function seatWords(ctx: NoteContext): string {
  const parts: string[] = []
  if (ctx.seat.training) parts.push('training mode')
  if (ctx.seat.twin) parts.push('digital twin')
  if (ctx.seat.viewing_as) parts.push('viewed as by a dev')
  return parts.join(', ')
}

export type NoteContextLine = { label: string; value: string }

/**
 * The rows under *Goes with your note*: everything the note carries, in the sender's words, so
 * nothing leaves the screen that they did not see listed.
 */
export function noteContextLines(ctx: NoteContext, senderName: string | null): NoteContextLine[] {
  const from = [senderName?.trim() || 'You', roleWords(ctx.role)].filter(Boolean).join(', ')
  const seat = seatWords(ctx)
  const lines: NoteContextLine[] = [
    { label: 'Page', value: ctx.page_label },
    { label: 'Window open', value: ctx.window ?? 'None' },
    { label: 'From', value: seat ? `${from} (${seat})` : from },
    { label: 'Screen', value: screenWords(ctx) },
  ]
  if (ctx.app_version) lines.push({ label: 'App version', value: ctx.app_version })
  const lastError = ctx.errors[0]
  lines.push({ label: 'Last error line', value: lastError ? `${lastError.words} (${agoWords(lastError.ago_s)})` : 'None in the last 5 minutes' })
  if (ctx.refused.length) {
    lines.push({ label: 'Refused by the server', value: ctx.refused.map((r) => `${r.what} (${r.status})`).join(', ') })
  }
  return lines
}

export type NoteContextChip = { text: string; tone: 'plain' | 'page' | 'trouble' }

/** The chips on a note in the dev's inbox. */
export function noteContextChips(ctx: NoteContext): NoteContextChip[] {
  const chips: NoteContextChip[] = [{ text: ctx.page_label, tone: 'page' }]
  if (ctx.window) chips.push({ text: `Window open: ${ctx.window}`, tone: 'plain' })
  chips.push({ text: screenWords(ctx), tone: 'plain' })
  const seat = seatWords(ctx)
  if (seat) chips.push({ text: seat, tone: 'plain' })
  if (ctx.app_version) chips.push({ text: ctx.app_version, tone: 'plain' })
  if (ctx.door === 'error_line') chips.push({ text: 'From the error line', tone: 'plain' })
  for (const e of ctx.errors.slice(0, 1)) chips.push({ text: `Error: ${e.words}`, tone: 'trouble' })
  for (const r of ctx.refused.slice(0, 2)) chips.push({ text: `Refused: ${r.what} (${r.status})`, tone: 'trouble' })
  return chips
}

// ---------------------------------------------------------------------------
// Reading it back

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A row's `context` back as a `NoteContext`, or null for a guide's note or another shape. */
export function parseNoteContext(raw: unknown): NoteContext | null {
  if (!isRecord(raw) || raw.v !== 1 || typeof raw.page_label !== 'string') return null
  const screen = isRecord(raw.screen) ? raw.screen : {}
  const seat = isRecord(raw.seat) ? raw.seat : {}
  const door = raw.door
  const errors = Array.isArray(raw.errors) ? raw.errors : []
  const refused = Array.isArray(raw.refused) ? raw.refused : []
  const out: NoteContext = {
    v: 1,
    page_label: raw.page_label,
    window: typeof raw.window === 'string' && raw.window ? raw.window : null,
    role: typeof raw.role === 'string' ? raw.role : null,
    seat: {},
    screen: {
      kind: screen.kind === 'phone' ? 'phone' : 'desk',
      width: typeof screen.width === 'number' ? screen.width : 0,
      height: typeof screen.height === 'number' ? screen.height : 0,
    },
    modes: Array.isArray(raw.modes) ? raw.modes.filter((m): m is string => typeof m === 'string') : [],
    app_version: typeof raw.app_version === 'string' ? raw.app_version : null,
    door: door === 'header' || door === 'window' || door === 'error_line' ? door : 'wrench',
    errors: errors.flatMap((e) => (isRecord(e) && typeof e.words === 'string' ? [{ words: e.words, ago_s: typeof e.ago_s === 'number' ? e.ago_s : 0 }] : [])),
    refused: refused.flatMap((r) =>
      isRecord(r) && typeof r.what === 'string' ? [{ what: r.what, status: typeof r.status === 'number' ? r.status : 0, ago_s: typeof r.ago_s === 'number' ? r.ago_s : 0 }] : [],
    ),
  }
  if (seat.training === true) out.seat.training = true
  if (seat.twin === true) out.seat.twin = true
  if (seat.viewing_as === true) out.seat.viewing_as = true
  return out
}
