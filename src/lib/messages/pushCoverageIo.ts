/**
 * Punch list #141 PR 4: the read under the Office hours card's coverage line (`whoIsOff.ts` → `coverageGaps`,
 * `coverageLine`). The office team by name (`GC_OFFICE_TEAM`, the people the reply push reads as the office, real
 * accounts only), and each one's **Push me** row, through the owner-or-dev read of `user_push_hours`, or the office
 * read once `20261029180000` is on prod. Fail-soft: a read that fails reads as nobody, and the line stays off.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { GC_OFFICE_TEAM } from '../gc/access'
import { supabase } from '../supabase'
import { parsePushHours } from './pushHours'
import type { CoverageMember } from './whoIsOff'

export interface PushCoverageIo {
  /** Everyone in the office with their hours, by name. Never rejects. */
  load(): Promise<CoverageMember[]>
}

export function supabasePushCoverageIo(client: unknown = supabase): PushCoverageIo {
  const db = client as SupabaseClient
  return {
    async load() {
      try {
        const users = await db
          .from('users')
          .select('id, name')
          .in('role', [...GC_OFFICE_TEAM])
          .is('archived_at', null)
          .eq('is_digital_twin', false)
          .eq('is_sample', false)
          .eq('is_walk_tester', false)
        if (users.error) return []
        const people = ((users.data ?? []) as Array<{ id: string; name: string | null }>).map((u) => ({ id: u.id, name: (u.name ?? '').trim() })).filter((u) => u.name !== '')
        if (people.length === 0) return []
        const rows = await db
          .from('user_push_hours')
          .select('user_id, days, opens, closes')
          .in(
            'user_id',
            people.map((p) => p.id),
          )
        if (rows.error) return []
        const byId = new Map(((rows.data ?? []) as Array<{ user_id: string; days: unknown; opens: unknown; closes: unknown }>).map((r) => [r.user_id, parsePushHours(r)]))
        return people.map((p) => ({ id: p.id, name: p.name, hours: byId.get(p.id) ?? null })).sort((a, b) => a.name.localeCompare(b.name))
      } catch {
        return []
      }
    },
  }
}
