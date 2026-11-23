/**
 * The Working hours row's door (punch list #429, PR 3): a person's rows on `person_available_hours`, the names of
 * whoever set them, and the one save, `set_working_hours`. The database refuses the save for anyone who is not a
 * dev or the controller; the row offers no press to anyone else, so a refusal here is a rule that changed under
 * an open page, and its words are the database's own.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { supabaseAvailabilityIo } from './availabilityIo'
import type { AvailableHoursAnswer } from './utilization'
import type { WeekDays } from './weekAvailability'

export type WorkingHoursIo = {
  /** Every row for the person, answers and set weeks, oldest first. */
  rows(userId: string): Promise<AvailableHoursAnswer[]>
  /** The display names of the people who set rows, by id. A name that cannot be read is left out. */
  names(userIds: readonly string[]): Promise<Record<string, string>>
  /** Sets the person's working hours from a Sunday. `days` null takes them off again. */
  save(args: { userId: string; days: WeekDays | null; effectiveFrom: string; reason: string | null }): Promise<void>
}

export function supabaseWorkingHoursIo(): WorkingHoursIo {
  const answers = supabaseAvailabilityIo()
  return {
    rows: (userId) => answers.listAnswers([userId]),
    async names(userIds) {
      const ids = [...new Set(userIds)].filter(Boolean)
      if (ids.length === 0) return {}
      const rows = await withSupabaseRetry(async () => await supabase.from('users').select('id, name').in('id', ids), 'load who set working hours')
      const out: Record<string, string> = {}
      for (const r of (rows ?? []) as Array<{ id: string; name: string | null }>) if (r.name?.trim()) out[r.id] = r.name.trim()
      return out
    },
    async save({ userId, days, effectiveFrom, reason }) {
      // The function arrives with migration 20261123075925; the generated types learn it after the push.
      await withSupabaseRetry(
        async () => await supabase.rpc('set_working_hours' as never, { p_user_id: userId, p_days: days, p_effective_from: effectiveFrom, p_reason: reason, p_dry_run: false } as never),
        'set working hours',
        { maxRetries: 0 },
      )
    },
  }
}
