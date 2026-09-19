/**
 * Labor book provenance (the Labor refresh PR 6b, v2.3597). One book per trade — the 🤖 Robot
 * Default — and every entry says where its hours came from. The columns the fold added
 * (v2.3596): `origin` (robot · human), the robot's own three numbers (`robot_*_hrs`, kept
 * under a human override so Reset works), and `set_by / set_at / set_note` — who last set the
 * hours by hand and why. The database trigger stamps `set_by`; this file only reads.
 *
 * Five readings of an entry:
 *   robot        the robot's number stands (no person has set the hours)
 *   human        a person's entry with no robot number under it (a folded book's row, Add entry)
 *   override     a person changed a robot number; the robot's own is kept beside it
 *   learned      a queue answer taught the book this entry ("learned from BP375")
 *   calibrated   Book vs jobs → Set wrote it ("calibrated ×1.13 · 4 jobs")
 *
 * Who may do what is `laborBookRights(role)`: leaders (dev · master tech) set and reset anything;
 * estimators override, reset their own overrides, and PROPOSE a calibration (a leader confirms);
 * the office (assistant · controller) reads.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type StageHours = { rough: number; top: number; trim: number }

export type ProvenanceEntry = {
  origin?: string | null
  rough_in_hrs: number | string
  top_out_hrs: number | string
  trim_set_hrs: number | string
  robot_rough_in_hrs?: number | string | null
  robot_top_out_hrs?: number | string | null
  robot_trim_set_hrs?: number | string | null
  set_by?: string | null
  set_at?: string | null
  set_note?: string | null
}

export type ProvenanceKind = 'robot' | 'human' | 'override' | 'learned' | 'calibrated'

export type EntryProvenance = {
  kind: ProvenanceKind
  /** The chip: "robot" · "human · from Default" · "override · Wendi · Sep 18" · "learned · BP375 · Wendi" · "calibrated ×1.13 · 4 jobs · Sep 18". */
  words: string
  /** The hover: the robot's own numbers under an override, the fold's note on a conflict, nothing when there is nothing to add. */
  title: string
  robotHours: StageHours | null
  /** The visible hours are not the robot's — Reset to robot has somewhere to go. */
  differsFromRobot: boolean
}

const num = (v: number | string | null | undefined): number => (v == null || v === '' ? 0 : Number(v) || 0)
const fmt1 = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

export const entryHours = (e: ProvenanceEntry): StageHours => ({ rough: num(e.rough_in_hrs), top: num(e.top_out_hrs), trim: num(e.trim_set_hrs) })

/** The robot's own numbers, or null when the robot never had a say on this entry. */
export function robotHoursOf(e: ProvenanceEntry): StageHours | null {
  if (e.robot_rough_in_hrs == null || e.robot_top_out_hrs == null || e.robot_trim_set_hrs == null) return null
  return { rough: num(e.robot_rough_in_hrs), top: num(e.robot_top_out_hrs), trim: num(e.robot_trim_set_hrs) }
}

export const hoursEqual = (a: StageHours, b: StageHours): boolean => Math.abs(a.rough - b.rough) < 0.005 && Math.abs(a.top - b.top) < 0.005 && Math.abs(a.trim - b.trim) < 0.005

/** "2/3/2" · "1/0.5/1". */
export const stageHoursWords = (h: StageHours): string => `${fmt1(h.rough)}/${fmt1(h.top)}/${fmt1(h.trim)}`

/** "Sep 18" in the company's calendar; null for a bad date. */
export function shortDateWords(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

const LEARNED_PREFIX = 'learned from '
const CALIBRATED_PREFIX = 'calibrated'
const FROM_PREFIX = 'from '
/** The fold's conflict note: `Default had 2.00/3.00/2.00 — Robot kept`. */
const FOLD_CONFLICT = /^(.+?) had ([\d.]+)\/([\d.]+)\/([\d.]+) — Robot kept/

export function entryProvenance(e: ProvenanceEntry, nameOf: (userId: string) => string | null | undefined = () => null): EntryProvenance {
  const robotHours = robotHoursOf(e)
  const hours = entryHours(e)
  const differsFromRobot = robotHours != null && !hoursEqual(hours, robotHours)
  const note = (e.set_note ?? '').trim()
  const who = e.set_by ? (nameOf(e.set_by) ?? 'someone') : null
  const when = shortDateWords(e.set_at)
  const robotSaid = robotHours && differsFromRobot ? `robot said ${stageHoursWords(robotHours)}` : ''

  if (note.startsWith(LEARNED_PREFIX)) {
    return { kind: 'learned', words: ['learned', note.slice(LEARNED_PREFIX.length).trim(), who].filter(Boolean).join(' · '), title: robotSaid, robotHours, differsFromRobot }
  }
  if (note.startsWith(CALIBRATED_PREFIX)) {
    return { kind: 'calibrated', words: [note, when].filter(Boolean).join(' · '), title: [who ? `set by ${who}` : '', robotSaid].filter(Boolean).join(' · '), robotHours, differsFromRobot }
  }
  if (e.set_by && differsFromRobot) {
    return { kind: 'override', words: ['override', who, when].filter(Boolean).join(' · '), title: robotSaid, robotHours, differsFromRobot }
  }
  if (robotHours != null || e.origin === 'robot') {
    const conflict = FOLD_CONFLICT.exec(note)
    const words = conflict ? `robot · picked over ${conflict[1]} ${stageHoursWords({ rough: Number(conflict[2]), top: Number(conflict[3]), trim: Number(conflict[4]) })}` : 'robot'
    return { kind: 'robot', words, title: conflict ? note : '', robotHours, differsFromRobot }
  }
  const words = note.startsWith(FROM_PREFIX) ? `human · ${note}` : ['human', who, when].filter(Boolean).join(' · ')
  return { kind: 'human', words, title: '', robotHours, differsFromRobot: false }
}

// ─── who may ─────────────────────────────────────────────────────────────────

export type LaborBookRights = {
  /** Sees the book, its chips and the evidence. */
  read: boolean
  /** Overrides an entry, adds or deletes one, answers the queue into the book. */
  edit: boolean
  /** Resets any override to the robot's number (an estimator resets only their own). */
  resetAny: boolean
  /** Book vs jobs → Set: writes it, proposes it for a leader, or cannot. */
  calibrate: 'set' | 'propose' | 'none'
}

export function laborBookRights(role: string | null | undefined): LaborBookRights {
  if (role === 'dev' || role === 'master_technician') return { read: true, edit: true, resetAny: true, calibrate: 'set' }
  if (role === 'estimator') return { read: true, edit: true, resetAny: false, calibrate: 'propose' }
  if (role === 'assistant' || role === 'controller') return { read: true, edit: false, resetAny: false, calibrate: 'none' }
  return { read: false, edit: false, resetAny: false, calibrate: 'none' }
}

/** Reset to robot: there is a robot number, the hours differ from it, and this person may undo it. */
export function canResetToRobot(e: ProvenanceEntry, rights: LaborBookRights, userId: string | null | undefined): boolean {
  const p = entryProvenance(e)
  if (!p.robotHours || !p.differsFromRobot) return false
  if (rights.resetAny) return true
  return rights.edit && !!userId && e.set_by === userId
}

// ─── the book, summed up ─────────────────────────────────────────────────────

export type BookSummaryEntry = ProvenanceEntry & { alias_names?: string[] | null }

/** "26 entries · 46 aliases · 9 overrides · 2 learned" — the head line beside the book's name. */
export function bookSummaryWords(entries: ReadonlyArray<BookSummaryEntry>): string {
  const n = entries.length
  const aliases = entries.reduce((s, e) => s + (e.alias_names?.length ?? 0), 0)
  let overrides = 0
  let learned = 0
  for (const e of entries) {
    const k = entryProvenance(e).kind
    if (k === 'override' || k === 'calibrated') overrides += 1
    else if (k === 'learned') learned += 1
  }
  const parts = [`${n} entr${n === 1 ? 'y' : 'ies'}`, `${aliases} alias${aliases === 1 ? '' : 'es'}`]
  if (overrides > 0) parts.push(`${overrides} override${overrides === 1 ? '' : 's'}`)
  if (learned > 0) parts.push(`${learned} learned`)
  return parts.join(' · ')
}

export type TradeBook = { id: string; is_robot: boolean | null; archived_at?: string | null; created_at?: string | null }

/** The one book a trade prices with: its robot book, else the oldest live book (a trade the robot has not seeded). */
export function laborBookForTrade<T extends TradeBook>(versions: ReadonlyArray<T>): T | null {
  const live = versions.filter((v) => !v.archived_at)
  const sorted = [...live].sort((a, b) => Number(!!b.is_robot) - Number(!!a.is_robot) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  return sorted[0] ?? null
}

// ─── calibration ─────────────────────────────────────────────────────────────

export type CalibrationWrite = { id: string; rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number; set_note: string }

/** `calibrated ×1.13 · 4 jobs`. */
export const calibrationNote = (multiplier: number, jobs: number): string => `calibrated ×${multiplier.toFixed(2)} · ${jobs} job${jobs === 1 ? '' : 's'}`

const quarter = (n: number): number => Math.max(0, Math.round(n * 4) / 4)

/**
 * What Book vs jobs → Set writes: every robot entry the linked jobs touched takes the robot's
 * own numbers × the multiplier, to the quarter hour, as a calibrated override. A person's
 * override is never touched; a previous calibration is re-read from the robot's numbers, so
 * two Sets do not compound.
 */
export function calibrationSetPlan(entries: ReadonlyArray<{ id: string } & ProvenanceEntry>, multiplier: number, touchedIds: ReadonlySet<string>, jobs: number): CalibrationWrite[] {
  const out: CalibrationWrite[] = []
  if (!(multiplier > 0)) return out
  for (const e of entries) {
    if (!touchedIds.has(e.id)) continue
    const p = entryProvenance(e)
    if (!p.robotHours || (p.kind !== 'robot' && p.kind !== 'calibrated')) continue
    out.push({
      id: e.id,
      rough_in_hrs: quarter(p.robotHours.rough * multiplier),
      top_out_hrs: quarter(p.robotHours.top * multiplier),
      trim_set_hrs: quarter(p.robotHours.trim * multiplier),
      set_note: calibrationNote(multiplier, jobs),
    })
  }
  return out
}

export type CalibrationProposal = { multiplier: number; byName: string | null; at: string | null; note?: string | null }

/** "proposed ×1.13 by Wendi · Sep 18" — what the tile says under an estimator's Set until a leader confirms. */
export function calibrationProposalWords(p: CalibrationProposal): string {
  const when = shortDateWords(p.at)
  return [`proposed ×${p.multiplier.toFixed(2)}${p.byName ? ` by ${p.byName}` : ''}`, when].filter(Boolean).join(' · ')
}
