import { APP_SETTINGS_KEY_DISPATCH_NOTE_REQUIREMENT_CONFIG } from './appSettingsKeys'
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export const DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION = 1 as const

/**
 * Org-wide schedule-block note requirements.
 *
 * - `require_note_user_ids`: when one of these users is the block assignee, the edit-note icon
 *   highlights red (`#dc2626`) when the block has no note (else stays grey).
 * - `skip_note_user_ids`: when one of these users is the assignee, the entire action-icon cluster
 *   (edit-note, chains, `−`, `+`) renders grey. Click handlers remain functional — visual only.
 * - `skip_note_job_ids`: when the block's `job_id` is in this list, the cluster also renders grey.
 *   `require_note_user_ids` still wins over this list (assignee-level requirement is not silenced
 *   by a per-job opt-out).
 *
 * A user appearing in both user lists is dropped from `skip_note_user_ids` by normalization (the
 * `require` list wins) so the UI cannot represent a contradiction. The job list is orthogonal and
 * has no exclusion against the user lists.
 */
export type DispatchNoteRequirementsConfigV1 = {
  v: typeof DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION
  require_note_user_ids: string[]
  skip_note_user_ids: string[]
  skip_note_job_ids: string[]
}

export type DispatchNoteRequirement = 'required' | 'skip' | 'default'

export function defaultDispatchNoteRequirementsConfig(): DispatchNoteRequirementsConfigV1 {
  return {
    v: DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION,
    require_note_user_ids: [],
    skip_note_user_ids: [],
    skip_note_job_ids: [],
  }
}

function normalizeIdList(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of raw) {
    if (typeof v !== 'string') return null
    const t = v.trim()
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Parses + dedupes both lists, and drops any user that appears in both (require wins).
 * Returns `null` when the shape is invalid.
 */
export function normalizeDispatchNoteRequirementsConfig(
  raw: unknown,
): DispatchNoteRequirementsConfigV1 | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION) return null
  const requireIds = normalizeIdList(o.require_note_user_ids)
  const skipIds = normalizeIdList(o.skip_note_user_ids)
  const skipJobIds = normalizeIdList(o.skip_note_job_ids)
  if (requireIds === null || skipIds === null || skipJobIds === null) return null
  const requireSet = new Set(requireIds)
  const skipDeduped = skipIds.filter((id) => !requireSet.has(id))
  return {
    v: DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION,
    require_note_user_ids: requireIds,
    skip_note_user_ids: skipDeduped,
    skip_note_job_ids: skipJobIds,
  }
}

/** Returns the effective requirement for a user; empty/unknown userId resolves to `'default'`. */
export function noteRequirementForUserId(
  config: DispatchNoteRequirementsConfigV1,
  userId: string | null | undefined,
): DispatchNoteRequirement {
  if (!userId) return 'default'
  if (config.require_note_user_ids.includes(userId)) return 'required'
  if (config.skip_note_user_ids.includes(userId)) return 'skip'
  return 'default'
}

/**
 * Returns the effective requirement for a schedule block, combining its assignee user and job.
 *
 * Precedence (highest wins):
 *   1. `userId ∈ require_note_user_ids` -> `'required'` (assignee requirement overrides per-job opt-out)
 *   2. `jobId ∈ skip_note_job_ids` -> `'skip'`
 *   3. `userId ∈ skip_note_user_ids` -> `'skip'`
 *   4. otherwise -> `'default'`
 *
 * Past-day gating is layered on top by `effectiveNoteRequirement` at the card render site.
 */
export function noteRequirementForBlock(
  config: DispatchNoteRequirementsConfigV1,
  input: { userId: string | null | undefined; jobId: string | null | undefined },
): DispatchNoteRequirement {
  const { userId, jobId } = input
  if (userId && config.require_note_user_ids.includes(userId)) return 'required'
  if (jobId && config.skip_note_job_ids.includes(jobId)) return 'skip'
  if (userId && config.skip_note_user_ids.includes(userId)) return 'skip'
  return 'default'
}

/**
 * Gates a requirement to today + future work days only. On past work days, every requirement
 * collapses back to `'default'` so the schedule history never lights up red ("needs attention")
 * or paints over normal blue/red icons as greyed-out — the require/skip lists are forward-looking
 * by design.
 */
export function effectiveNoteRequirement(
  requirement: DispatchNoteRequirement,
  isPastDay: boolean,
): DispatchNoteRequirement {
  return isPastDay ? 'default' : requirement
}

/**
 * Edit-note icon color decision table.
 *
 * - `skip` → grey (whole cluster greys out).
 * - `required` + no note → red (needs attention).
 * - `required` + note → grey (red reserved for the "needs attention" state).
 * - `default` → blue when no note, grey when noted (existing behavior).
 */
export function editNoteIconColorForBlock(args: {
  requirement: DispatchNoteRequirement
  hasNote: boolean
}): string {
  const { requirement, hasNote } = args
  if (requirement === 'skip') return '#9ca3af'
  if (requirement === 'required') return hasNote ? '#9ca3af' : '#dc2626'
  return hasNote ? '#9ca3af' : '#1d4ed8'
}

/**
 * Color for the surrounding action icons (chains, `−`, `+`) on a schedule card:
 * forced grey when the assignee is `skip`, else the caller's default color.
 */
export function surroundingIconColorForRequirement(
  requirement: DispatchNoteRequirement,
  defaultColor: string,
): string {
  if (requirement === 'skip') return '#9ca3af'
  return defaultColor
}

export async function fetchDispatchNoteRequirementsConfigFromAppSettings(): Promise<{
  config: DispatchNoteRequirementsConfigV1
  rowExists: boolean
}> {
  try {
    const data = (await withSupabaseRetry(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', APP_SETTINGS_KEY_DISPATCH_NOTE_REQUIREMENT_CONFIG)
          .maybeSingle(),
      'fetch_dispatch_note_requirements_config',
    )) as { value_text: string | null } | null
    if (data == null) {
      return { config: defaultDispatchNoteRequirementsConfig(), rowExists: false }
    }
    const text = data.value_text
    if (text == null || text.trim() === '') {
      return { config: defaultDispatchNoteRequirementsConfig(), rowExists: true }
    }
    try {
      const parsed: unknown = JSON.parse(text)
      const n = normalizeDispatchNoteRequirementsConfig(parsed)
      return { config: n ?? defaultDispatchNoteRequirementsConfig(), rowExists: true }
    } catch {
      return { config: defaultDispatchNoteRequirementsConfig(), rowExists: true }
    }
  } catch {
    return { config: defaultDispatchNoteRequirementsConfig(), rowExists: false }
  }
}

export async function upsertDispatchNoteRequirementsConfigToAppSettings(
  cfg: DispatchNoteRequirementsConfigV1,
): Promise<void> {
  const normalized = normalizeDispatchNoteRequirementsConfig(cfg) ?? defaultDispatchNoteRequirementsConfig()
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        {
          key: APP_SETTINGS_KEY_DISPATCH_NOTE_REQUIREMENT_CONFIG,
          value_text: JSON.stringify(normalized),
        },
        { onConflict: 'key' },
      ),
    'upsert_dispatch_note_requirements_config',
  )
}
