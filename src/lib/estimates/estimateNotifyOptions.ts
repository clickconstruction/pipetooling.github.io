import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../subcontractorLikeRole'

/**
 * The "Also notify" picker's grouping rule (Estimates detail): everyone but
 * yourself, bucketed master technicians → assistants → superintendents →
 * everyone else, each bucket sorted by name, with a labeled separator between
 * non-empty buckets. Pure — the page maps the option entries to JSX.
 */

export type EstimateNotifyUserOption = { id: string; name: string; email: string; role?: UserRole }

export type EstimateNotifyGroupEntry =
  | { kind: 'separator'; id: string; label?: string }
  | { kind: 'option'; option: EstimateNotifyUserOption }

type EstimateNotifyBucketKey = 'master' | 'assistant' | 'superintendent' | 'rest'

/** Section caption on "Also notify" role-group separators (group below the divider). */
export function estimateAcceptNotifySeparatorLabel(bucketKey: EstimateNotifyBucketKey): string | undefined {
  switch (bucketKey) {
    case 'assistant':
      return 'Assistants'
    case 'superintendent':
      return 'Superintendents'
    case 'rest':
      return 'Everyone else'
    default:
      return undefined
  }
}

export function groupEstimateNotifyOptions(
  options: EstimateNotifyUserOption[],
  selfId: string | null | undefined,
): EstimateNotifyGroupEntry[] {
  const others = options.filter((opt) => opt.id !== selfId)
  const sortByName = (a: EstimateNotifyUserOption, b: EstimateNotifyUserOption) => {
    const na = a.name?.trim() || '—'
    const nb = b.name?.trim() || '—'
    return na.localeCompare(nb, undefined, { sensitivity: 'base' })
  }
  const masters: EstimateNotifyUserOption[] = []
  const assistants: EstimateNotifyUserOption[] = []
  const supers: EstimateNotifyUserOption[] = []
  const rest: EstimateNotifyUserOption[] = []
  for (const opt of others) {
    const r = opt.role
    if (r === 'master_technician') masters.push(opt)
    else if (isAssistantLike(r)) assistants.push(opt)
    else if (r === 'superintendent') supers.push(opt)
    else rest.push(opt)
  }
  masters.sort(sortByName)
  assistants.sort(sortByName)
  supers.sort(sortByName)
  rest.sort(sortByName)
  const bucketMeta: ReadonlyArray<{ key: EstimateNotifyBucketKey; rows: EstimateNotifyUserOption[] }> = [
    { key: 'master', rows: masters },
    { key: 'assistant', rows: assistants },
    { key: 'superintendent', rows: supers },
    { key: 'rest', rows: rest },
  ]
  const out: EstimateNotifyGroupEntry[] = []
  let prevKey: EstimateNotifyBucketKey | null = null
  for (const { key, rows } of bucketMeta) {
    if (!rows.length) continue
    if (prevKey !== null) {
      const sepLabel = estimateAcceptNotifySeparatorLabel(key)
      out.push({
        kind: 'separator',
        id: `estimate-notify-sep-${prevKey}-${key}`,
        ...(sepLabel ? { label: sepLabel } : {}),
      })
    }
    prevKey = key
    out.push(...rows.map((option) => ({ kind: 'option' as const, option })))
  }
  return out
}
