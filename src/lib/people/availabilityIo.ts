/**
 * The answers' door: how the hours a person can work in a week are read and written. One
 * interface, two doors. `supabaseAvailabilityIo` reads and writes `person_available_hours`
 * (v2.6707; append-only, the newest answer in force wins, the first answer reads the weeks before
 * it). `localAvailabilityIo` keeps the answers in this browser alone, for a render smoke or a
 * design spike, so the board and My Time can be tried with no table.
 *
 * Every write is a new row: a change of mind is a new answer from a new day, never an edit.
 */
import { supabase } from '../supabase'
import { chunkIds } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { AvailableHoursAnswer } from './utilization'
import { parseWeekDays, type WeekDays } from './weekAvailability'

export type AvailabilityIo = {
  /** Every answer for these people (or everyone when `userIds` is omitted), oldest first. */
  listAnswers(userIds?: readonly string[]): Promise<AvailableHoursAnswer[]>
  /** One new answer. `set_by` is the signed-in person; `effective_from` is the week's Sunday the answer holds from. */
  addAnswer(answer: Omit<AvailableHoursAnswer, 'set_at'>): Promise<AvailableHoursAnswer>
  /** Where the answers live, so a surface can say so while a spike runs on this browser. */
  readonly kind: 'local' | 'supabase'
}

const ANSWER_COLUMNS = 'user_id, hours_per_week, days, effective_from, set_by, created_at, note'

type AnswerRow = {
  user_id: string
  hours_per_week: number | string
  days: unknown
  effective_from: string
  set_by: string | null
  created_at: string
  note: string | null
}

function rowToAnswer(r: AnswerRow): AvailableHoursAnswer {
  return {
    user_id: r.user_id,
    hours_per_week: Number(r.hours_per_week),
    days: parseWeekDays(r.days),
    effective_from: r.effective_from,
    set_by: r.set_by,
    set_at: r.created_at,
    note: r.note,
  }
}

const byDate = (a: AvailableHoursAnswer, b: AvailableHoursAnswer) => a.effective_from.localeCompare(b.effective_from) || a.set_at.localeCompare(b.set_at)

/** The table's door. RLS decides whose answers come back: one's own, or everyone's for the clock's readers. */
export function supabaseAvailabilityIo(): AvailabilityIo {
  return {
    kind: 'supabase',
    async listAnswers(userIds) {
      const chunks = userIds ? chunkIds([...userIds]) : [null]
      const rows: AnswerRow[] = []
      for (const chunk of chunks) {
        if (chunk && chunk.length === 0) continue
        const data = await withSupabaseRetry(async () => {
          let q = supabase.from('person_available_hours').select(ANSWER_COLUMNS).order('effective_from').order('created_at')
          if (chunk) q = q.in('user_id', chunk)
          return await q
        }, 'available hours')
        rows.push(...((data ?? []) as unknown as AnswerRow[]))
      }
      return rows.map(rowToAnswer).sort(byDate)
    },
    async addAnswer(answer) {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('person_available_hours')
            .insert({
              user_id: answer.user_id,
              hours_per_week: answer.hours_per_week,
              days: (answer.days ?? null) as WeekDays | null,
              effective_from: answer.effective_from,
              set_by: answer.set_by,
              note: answer.note ?? null,
            })
            .select(ANSWER_COLUMNS)
            .single(),
        'save available hours',
      )
      return rowToAnswer(data as unknown as AnswerRow)
    },
  }
}

const LOCAL_KEY = 'people.availableHours.v1'

function readLocal(): AvailableHoursAnswer[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AvailableHoursAnswer[]) : []
  } catch {
    return []
  }
}

function writeLocal(rows: AvailableHoursAnswer[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows))
  } catch {
    // A private window or blocked storage: the answer lives for this page only.
  }
}

/** This browser's storage. Nothing leaves the device; for smokes and spikes. */
export function localAvailabilityIo(): AvailabilityIo {
  return {
    kind: 'local',
    async listAnswers(userIds) {
      const rows = readLocal()
      const filtered = userIds ? rows.filter((r) => userIds.includes(r.user_id)) : rows
      return filtered.sort(byDate)
    },
    async addAnswer(answer) {
      const row: AvailableHoursAnswer = { ...answer, set_at: new Date().toISOString() }
      writeLocal([...readLocal(), row])
      return row
    },
  }
}

/** The door every surface uses. */
export function defaultAvailabilityIo(): AvailabilityIo {
  return supabaseAvailabilityIo()
}
