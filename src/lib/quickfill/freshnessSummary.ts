/**
 * Quickfill jump-strip summary (v2.2184): one line under the phone strip —
 * "3 of 19 fresh · 16 need a look · oldest 3d" — from the same marks the chips
 * color. Fresh = green; "need a look" = amber or red. A section handed in with
 * `green` is counted by that (the chip's own rhythm rule, v2.3892); without it
 * the flat rule stands — marked within 12h;
 * never-marked sections count as needing a look and as the oldest.
 */
export type FreshnessBucket = 'fresh' | 'stale' | 'never'

export function freshnessBucket(markedAtIso: string | null | undefined, now: Date): FreshnessBucket {
  if (!markedAtIso) return 'never'
  const hours = (now.getTime() - new Date(markedAtIso).getTime()) / 3_600_000
  return hours <= 12 ? 'fresh' : 'stale'
}

export function quickfillFreshnessSummary(
  sections: ReadonlyArray<{ sectionId: string; markedAt: string | null; personal?: boolean; green?: boolean }>,
  now = new Date(),
): { total: number; fresh: number; needLook: number; oldestDays: number | null; line: string } {
  const tracked = sections.filter((s) => !s.personal)
  let fresh = 0
  let needLook = 0
  let oldestMs: number | null = null
  let never = false
  for (const s of tracked) {
    const flat = freshnessBucket(s.markedAt, now)
    const b: FreshnessBucket = flat === 'never' || s.green == null ? flat : s.green ? 'fresh' : 'stale'
    if (b === 'fresh') fresh++
    else needLook++
    if (b === 'never') never = true
    else if (s.markedAt) {
      const age = now.getTime() - new Date(s.markedAt).getTime()
      if (oldestMs == null || age > oldestMs) oldestMs = age
    }
  }
  const total = tracked.length
  const oldestDays = oldestMs == null ? null : Math.floor(oldestMs / 86_400_000)
  const parts: string[] = []
  parts.push(`${fresh} of ${total} fresh`)
  if (needLook > 0) parts.push(`${needLook} need${needLook === 1 ? 's' : ''} a look`)
  if (never) parts.push('some never marked')
  else if (oldestDays != null && oldestDays >= 1) parts.push(`oldest ${oldestDays}d`)
  return { total, fresh, needLook, oldestDays, line: total === 0 ? '' : parts.join(' · ') }
}
