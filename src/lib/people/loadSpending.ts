// People → Spending's one load (punch list #52, PR 4b-2): the card charges in the window
// (`list_card_charges_window`), the tags that say what is fuel, the Office job, Tally's sorting
// floor and the names of everyone the charges belong to — then the pure roll-up. The tags, the
// Office job and the floor each fail soft (no fuel line, no Office bucket, no floor), as the Job
// window's own reads do; the charges themselves never fail soft.

import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchCardChargesWindow, type CardChargeWindowRow } from '../banking/cardChargesWindow'
import { loadCategoryTags } from '../banking/categoryTagsData'
import { buildCategoryTagLookups, pickFuelTag, type CategoryTagRow } from '../banking/categoryTags'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD, normalizeJobTallyMinPostedYmd } from '../appSettingsKeys'
import { buildSpendingRollup, type SpendingDirectory, type SpendingRollup } from './spendingRollup'

export type SpendingLoad = SpendingRollup & {
  fuelTag: CategoryTagRow | null
  sortingFloorYmd: string | null
  /** The charges as read, by id — what *Put on a job* opens. */
  chargeById: Map<string, CardChargeWindowRow>
}

async function fetchSortingFloorYmd(): Promise<string | null> {
  const row = await withSupabaseRetry(
    async () => supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD).maybeSingle(),
    'spending sorting floor',
  )
  return normalizeJobTallyMinPostedYmd((row as { value_text?: string | null } | null)?.value_text ?? null)
}

/** Names for the charges' people: every attributed or holding login, every attributed person record, and the logins those records link to. */
export async function loadSpendingDirectory(charges: readonly CardChargeWindowRow[]): Promise<SpendingDirectory> {
  const personIds = [...new Set(charges.map((c) => c.attributedPersonId).filter((id): id is string => !!id))]
  const people = personIds.length
    ? ((await fetchAllRowsChunkedIn(
        personIds,
        (chunk, from, to) => supabase.from('people').select('id, name, account_user_id').in('id', chunk).order('id').range(from, to),
        'spending people',
      )) as Array<{ id: string; name: string; account_user_id: string | null }>)
    : []
  const userIds = [
    ...new Set(
      [
        ...charges.flatMap((c) => [c.attributedUserId, c.holderUserId]),
        ...people.map((p) => p.account_user_id),
      ].filter((id): id is string => !!id),
    ),
  ]
  const users = userIds.length
    ? ((await fetchAllRowsChunkedIn(
        userIds,
        (chunk, from, to) => supabase.from('users').select('id, name').in('id', chunk).order('id').range(from, to),
        'spending users',
      )) as Array<{ id: string; name: string | null }>)
    : []
  return {
    userNameById: new Map(users.filter((u) => (u.name ?? '').trim()).map((u) => [u.id, (u.name ?? '').trim()])),
    personById: new Map(people.map((p) => [p.id, { name: p.name, accountUserId: p.account_user_id }])),
  }
}

export async function loadSpending(range: { startYmd: string; endYmd: string }): Promise<SpendingLoad> {
  const [charges, tagData, officeJobId, sortingFloorYmd] = await Promise.all([
    fetchCardChargesWindow(range),
    loadCategoryTags().catch(() => ({ tags: [], members: [] })),
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
    fetchSortingFloorYmd().catch(() => null),
  ])
  const directory = await loadSpendingDirectory(charges)
  const fuelTag = pickFuelTag(tagData.tags)
  const rollup = buildSpendingRollup({
    charges,
    lookups: buildCategoryTagLookups(tagData.tags, tagData.members),
    fuelTagId: fuelTag?.id ?? null,
    officeJobId,
    sortingFloorYmd,
    directory,
  })
  return { ...rollup, fuelTag, sortingFloorYmd, chargeById: new Map(charges.map((c) => [c.id, c])) }
}
