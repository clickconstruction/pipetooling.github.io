/**
 * Follow Up calling order (v2.2301).
 *
 * "Never called" means no `didnt_answer` / `answered` interaction has ever
 * been recorded on the prospect — the two calling buttons. A site-visit note
 * or email sets `last_contact` but is not a call, which is why never-called
 * prospects were sinking into the coldest-first backlog.
 *
 * `never_called_first` is a re-order, not a filter: never-called prospects
 * lead (oldest entry first), everyone else follows in the caller-supplied
 * order (coldest first from the query), so the queue never runs dry.
 */

export type CallingOrderMode = 'coldest' | 'never_called_first'

export const CALLING_ORDER_STORAGE_KEY = 'prospects_calling_order_v1'

export const CALL_INTERACTION_TYPES = ['didnt_answer', 'answered'] as const

export function readCallingOrderMode(raw: string | null | undefined): CallingOrderMode {
  return raw === 'never_called_first' ? 'never_called_first' : 'coldest'
}

type OrderableProspect = { id: string; created_at: string | null }

export function orderFollowUpProspects<T extends OrderableProspect>(
  prospects: readonly T[],
  calledIds: ReadonlySet<string>,
  mode: CallingOrderMode,
): T[] {
  if (mode === 'coldest') return [...prospects]
  const never: T[] = []
  const called: T[] = []
  for (const p of prospects) (calledIds.has(p.id) ? called : never).push(p)
  never.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  return [...never, ...called]
}

/**
 * Queue-row age label: "added Nd ago" (never any contact), "noted Nd ago"
 * (touched but never called), "called Nd ago" (has call history).
 */
export function queueAgeLabel(
  p: { id: string; created_at: string | null; last_contact: string | null },
  calledIds: ReadonlySet<string>,
  nowMs: number,
): string {
  const days = (iso: string | null): number | null => {
    if (!iso) return null
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return null
    return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
  }
  if (calledIds.has(p.id)) {
    const d = days(p.last_contact)
    return d == null ? 'called' : `called ${d}d ago`
  }
  if (p.last_contact) {
    const d = days(p.last_contact)
    return d == null ? 'noted' : `noted ${d}d ago`
  }
  const d = days(p.created_at)
  return d == null ? 'added' : `added ${d}d ago`
}
