/**
 * Vehicle check-in settings (v2.2199, owner mockup 9ebd178b): the cadence that
 * drives Quickfill's Vehicle odometers section — assigned vehicles every
 * `assignedDays`, motor-pool vehicles every `motorPoolDays` (0 = skip) — plus
 * the questions asked at capture ("Any lights on the dash?"). One
 * `app_settings` key, dev-written from the Vehicles board's ⚙ Check-in
 * settings modal; all authenticated read. Defaults make the feature work with
 * no setup. Question ids are stable; check-ins store the LABEL as asked, so
 * renames never rewrite history (D5).
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export const APP_SETTINGS_KEY_VEHICLE_CHECKIN_SETTINGS = 'vehicle_checkin_settings_v1' as const

export type VehicleCheckinQuestion = { id: string; label: string }

export type VehicleCheckinSettings = {
  /** Days between required readings for vehicles held by a person. */
  assignedDays: number
  /** Days between required readings for motor-pool vehicles; 0 = skip them. */
  motorPoolDays: number
  questions: VehicleCheckinQuestion[]
}

export const DEFAULT_VEHICLE_CHECKIN_SETTINGS: VehicleCheckinSettings = {
  assignedDays: 7,
  motorPoolDays: 30,
  questions: [{ id: 'dash-lights', label: 'Any lights on the dash?' }],
}

function cleanDays(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(365, Math.floor(n))
}

export function parseVehicleCheckinSettings(valueText: string | null | undefined): VehicleCheckinSettings {
  if (valueText == null || valueText.trim() === '') return { ...DEFAULT_VEHICLE_CHECKIN_SETTINGS, questions: [...DEFAULT_VEHICLE_CHECKIN_SETTINGS.questions] }
  try {
    const parsed = JSON.parse(valueText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad shape')
    const o = parsed as Record<string, unknown>
    const questions = Array.isArray(o.questions)
      ? (o.questions as unknown[])
          .map((q) => {
            if (!q || typeof q !== 'object') return null
            const qq = q as Record<string, unknown>
            const id = typeof qq.id === 'string' ? qq.id.trim() : ''
            const label = typeof qq.label === 'string' ? qq.label.trim() : ''
            return id && label ? { id, label: label.slice(0, 200) } : null
          })
          .filter((q): q is VehicleCheckinQuestion => q != null)
      : [...DEFAULT_VEHICLE_CHECKIN_SETTINGS.questions]
    return {
      assignedDays: cleanDays(o.assignedDays, DEFAULT_VEHICLE_CHECKIN_SETTINGS.assignedDays),
      motorPoolDays: cleanDays(o.motorPoolDays, DEFAULT_VEHICLE_CHECKIN_SETTINGS.motorPoolDays),
      questions,
    }
  } catch {
    return { ...DEFAULT_VEHICLE_CHECKIN_SETTINGS, questions: [...DEFAULT_VEHICLE_CHECKIN_SETTINGS.questions] }
  }
}

export function serializeVehicleCheckinSettings(s: VehicleCheckinSettings): string {
  return JSON.stringify({
    assignedDays: cleanDays(s.assignedDays, DEFAULT_VEHICLE_CHECKIN_SETTINGS.assignedDays),
    motorPoolDays: cleanDays(s.motorPoolDays, DEFAULT_VEHICLE_CHECKIN_SETTINGS.motorPoolDays),
    questions: s.questions.map((q) => ({ id: q.id, label: q.label.trim().slice(0, 200) })).filter((q) => q.label),
  })
}

export async function fetchVehicleCheckinSettings(): Promise<VehicleCheckinSettings> {
  try {
    const row = (await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_VEHICLE_CHECKIN_SETTINGS).maybeSingle(),
      'fetch vehicle check-in settings',
    )) as { value_text: string | null } | null
    return parseVehicleCheckinSettings(row?.value_text ?? null)
  } catch {
    return { ...DEFAULT_VEHICLE_CHECKIN_SETTINGS, questions: [...DEFAULT_VEHICLE_CHECKIN_SETTINGS.questions] }
  }
}

export async function saveVehicleCheckinSettings(s: VehicleCheckinSettings): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_VEHICLE_CHECKIN_SETTINGS, value_text: serializeVehicleCheckinSettings(s) }, { onConflict: 'key' }),
    'save vehicle check-in settings',
  )
}

/** Answers as stored on a vehicle_checkins row: the question text AS ASKED. */
export type VehicleCheckinAnswer = { q: string; flagged: boolean; comment: string }

export function parseVehicleCheckinAnswers(raw: unknown): VehicleCheckinAnswer[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .map((a) => {
      if (!a || typeof a !== 'object') return null
      const o = a as Record<string, unknown>
      const q = typeof o.q === 'string' ? o.q : ''
      if (!q) return null
      return { q, flagged: o.flagged === true, comment: typeof o.comment === 'string' ? o.comment : '' }
    })
    .filter((a): a is VehicleCheckinAnswer => a != null)
}

/** Ledger body: "⚠ Any lights on the dash — “ABS light”" lines, or "All clear". */
export function checkinLedgerBody(answers: VehicleCheckinAnswer[]): { flaggedLines: string[]; allClear: boolean } {
  const flaggedLines = answers
    .filter((a) => a.flagged)
    .map((a) => `${a.q}${a.comment.trim() ? ` — “${a.comment.trim()}”` : ''}`)
  return { flaggedLines, allClear: flaggedLines.length === 0 }
}
