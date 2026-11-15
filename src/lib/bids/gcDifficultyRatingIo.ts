/**
 * GC difficulty rating (punch list #357, PR 2): the reads and the one write of `gc_difficulty_ratings`, and the
 * shared read of every customer's standing for the chips (the Bid Board, the Workbench), held for a minute and dropped
 * when a rating is saved, as `inKindStandingIo.ts` holds the in-kind standings. The table is read by name until the
 * types are regenerated after the push.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { parseDifficultyCriteriaBody, type DifficultyPicks } from './difficultyCriteria'
import { gcDifficultyStandings, type DifficultyVersionLite, type GcDifficultyRating, type GcDifficultyStanding } from './gcDifficultyRating'
import { loadDifficultyPayingInputs } from './difficultyPayingIo'
import type { DifficultyPayingInputs } from './difficultyPaying'
import type { DifficultyPriceList } from './difficultyPrice'
import { loadPublishedDifficultyPrice } from './difficultyPriceIo'

export const GC_DIFFICULTY_CHANGED_EVENT = 'gc-difficulty-changed'

const COLS = 'id, customer_id, criteria_version_id, picks, pick_reasons, note, rated_by_name, rated_at'

type RawRow = { id: string; customer_id: string; criteria_version_id: string; picks: unknown; pick_reasons?: unknown; note: string | null; rated_by_name: string | null; rated_at: string }
type Result = { data: RawRow[] | null; error: unknown }

const TABLE = 'gc_difficulty_ratings' as never
const VERSIONS = 'difficulty_criteria_versions' as never

function rowFrom(raw: RawRow): GcDifficultyRating {
  const picks: DifficultyPicks = {}
  if (raw.picks != null && typeof raw.picks === 'object' && !Array.isArray(raw.picks)) {
    for (const [k, v] of Object.entries(raw.picks as Record<string, unknown>)) if (typeof v === 'number' && Number.isInteger(v)) picks[k] = v
  }
  const pickReasons: Record<string, string> = {}
  if (raw.pick_reasons != null && typeof raw.pick_reasons === 'object' && !Array.isArray(raw.pick_reasons)) {
    for (const [k, v] of Object.entries(raw.pick_reasons as Record<string, unknown>)) if (typeof v === 'string') pickReasons[k] = v
  }
  return { id: raw.id, customerId: raw.customer_id, criteriaVersionId: raw.criteria_version_id, picks, pickReasons, note: raw.note ?? '', ratedByName: raw.rated_by_name ?? '', ratedAt: raw.rated_at }
}

export interface GcDifficultyIo {
  /** Every published version, newest first, and the published one. */
  loadVersions(): Promise<{ versions: DifficultyVersionLite[]; published: DifficultyVersionLite | null }>
  /** A customer's ratings, newest first. */
  loadRatings(customerId: string): Promise<GcDifficultyRating[]>
  /** Writes a new rating; the database stamps who and when and holds the picks to the version. A bills scale's pick carries its words. */
  saveRating(customerId: string, criteriaVersionId: string, picks: DifficultyPicks, note: string, reasons?: Record<string, string>): Promise<GcDifficultyRating>
  /** The numbers behind the Paying scale for this GC (PR 3). */
  loadPaying(customerId: string): Promise<DifficultyPayingInputs>
  /** The published price list (PR 4): who may rate and the Paying rule. Absent or null reads as version 1's numbers. */
  loadPrice?(): Promise<DifficultyPriceList | null>
}

type VersionRaw = { id: string; version: number; status: string; body: unknown }

export async function loadPublishedDifficultyVersions(): Promise<{ versions: DifficultyVersionLite[]; published: DifficultyVersionLite | null }> {
  const result = (await supabase.from(VERSIONS).select('id, version, status, body').eq('status', 'published').order('version', { ascending: false })) as unknown as { data: VersionRaw[] | null; error: unknown }
  checkSupabaseError(result as never, 'read the difficulty criteria')
  const versions = (result.data ?? []).map((v) => ({ id: v.id, version: v.version, body: parseDifficultyCriteriaBody(v.body) ?? { scales: [] } }))
  return { versions, published: versions[0] ?? null }
}

export function supabaseGcDifficultyIo(): GcDifficultyIo {
  return {
    loadVersions: loadPublishedDifficultyVersions,
    async loadRatings(customerId) {
      const result = (await supabase.from(TABLE).select(COLS).eq('customer_id', customerId).order('rated_at', { ascending: false })) as unknown as Result
      checkSupabaseError(result as never, 'read the GC’s rating')
      return (result.data ?? []).map(rowFrom)
    },
    loadPaying: loadDifficultyPayingInputs,
    loadPrice: async () => (await loadPublishedDifficultyPrice())?.body ?? null,
    async saveRating(customerId, criteriaVersionId, picks, note, reasons = {}) {
      const row = { customer_id: customerId, criteria_version_id: criteriaVersionId, picks, pick_reasons: reasons, note } as never
      const result = (await supabase.from(TABLE).insert(row).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'save the rating')
      const saved = result.data?.[0]
      if (!saved) throw new Error('The rating was not saved. Nothing came back.')
      dropGcDifficultyStandings()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(GC_DIFFICULTY_CHANGED_EVENT))
      return rowFrom(saved)
    },
  }
}

/** Every customer's standing from the newest rating each, for the chips. */
export async function readGcDifficultyStandings(): Promise<Map<string, GcDifficultyStanding>> {
  const [{ versions, published }, ratings] = await Promise.all([
    loadPublishedDifficultyVersions(),
    (async () => {
      const result = (await supabase.from(TABLE).select(COLS).order('rated_at', { ascending: false }).limit(5000)) as unknown as Result
      checkSupabaseError(result as never, 'read the GC ratings')
      return (result.data ?? []).map(rowFrom)
    })(),
  ])
  return gcDifficultyStandings(ratings, versions, published)
}

const HOLD_MS = 60_000
let held: { at: number; read: Promise<Map<string, GcDifficultyStanding>> } | null = null

/** The shared read. A failed read is not held, so the next caller tries again. */
export function loadGcDifficultyStandings(): Promise<Map<string, GcDifficultyStanding>> {
  if (held && Date.now() - held.at < HOLD_MS) return held.read
  const read = readGcDifficultyStandings()
  held = { at: Date.now(), read }
  read.catch(() => {
    if (held?.read === read) held = null
  })
  return read
}

export function dropGcDifficultyStandings(): void {
  held = null
}
