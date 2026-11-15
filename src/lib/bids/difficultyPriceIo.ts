/**
 * GC difficulty rating (punch list #357, PR 4): the reads and writes of `difficulty_price_versions`, and the shared
 * read of the published price list for the card, the Bid Board and the Workbench, held for a minute and dropped when a
 * version is published. The guard in the database stamps who and when and takes the next version number, so the client
 * sends the body and the note and nothing else. The table is read by name until the types are regenerated after the
 * push.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { parseDifficultyPriceList, type DifficultyPriceList } from './difficultyPrice'

export const DIFFICULTY_PRICE_CHANGED_EVENT = 'difficulty-price-changed'

export type DifficultyPriceVersion = {
  id: string
  /** 0 on a draft. */
  version: number
  status: 'draft' | 'published'
  body: DifficultyPriceList
  note: string
  publishedAt: string | null
  publishedByName: string
  updatedAt: string
}

export interface DifficultyPriceIo {
  /** Every version, the draft (if any) first, then published newest first. */
  loadVersions(): Promise<DifficultyPriceVersion[]>
  /** Writes the draft's body and note; inserts the draft when `id` is null. */
  saveDraft(id: string | null, body: DifficultyPriceList, note: string): Promise<DifficultyPriceVersion>
  /** Flips the draft to published; the database takes the next version number. */
  publish(id: string): Promise<DifficultyPriceVersion>
}

const COLS = 'id, version, status, body, note, published_at, published_by_name, updated_at'

type RawRow = { id: string; version: number; status: string; body: unknown; note: string | null; published_at: string | null; published_by_name: string | null; updated_at: string }
type Result = { data: RawRow[] | null; error: unknown }

const TABLE = 'difficulty_price_versions' as never

function rowFrom(raw: RawRow): DifficultyPriceVersion {
  return {
    id: raw.id,
    version: raw.version,
    status: raw.status === 'published' ? 'published' : 'draft',
    body: parseDifficultyPriceList(raw.body) ?? parseDifficultyPriceList({})!,
    note: raw.note ?? '',
    publishedAt: raw.published_at,
    publishedByName: raw.published_by_name ?? '',
    updatedAt: raw.updated_at,
  }
}

export function sortDifficultyPriceVersions(rows: DifficultyPriceVersion[]): DifficultyPriceVersion[] {
  return [...rows].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'draft' ? -1 : 1
    return b.version - a.version
  })
}

export function publishedDifficultyPrice(rows: readonly DifficultyPriceVersion[]): DifficultyPriceVersion | null {
  return rows.filter((r) => r.status === 'published').sort((a, b) => b.version - a.version)[0] ?? null
}

export function draftDifficultyPrice(rows: readonly DifficultyPriceVersion[]): DifficultyPriceVersion | null {
  return rows.find((r) => r.status === 'draft') ?? null
}

function announce(): void {
  dropDifficultyPrice()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DIFFICULTY_PRICE_CHANGED_EVENT))
}

export function supabaseDifficultyPriceIo(): DifficultyPriceIo {
  return {
    async loadVersions() {
      const result = (await supabase.from(TABLE).select(COLS).order('version', { ascending: false })) as unknown as Result
      checkSupabaseError(result as never, 'read the pricing rules')
      return sortDifficultyPriceVersions((result.data ?? []).map(rowFrom))
    },
    async saveDraft(id, body, note) {
      const patch = { body, note } as never
      const result = (id
        ? await supabase.from(TABLE).update(patch).eq('id', id).select(COLS)
        : await supabase.from(TABLE).insert({ ...(patch as object), status: 'draft' } as never).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'save the pricing rules')
      const row = result.data?.[0]
      if (!row) throw new Error('The pricing rules were not saved. Nothing came back.')
      return rowFrom(row)
    },
    async publish(id) {
      const result = (await supabase.from(TABLE).update({ status: 'published' } as never).eq('id', id).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'publish the pricing rules')
      const row = result.data?.[0]
      if (!row) throw new Error('Nothing was published. The draft is not there, or the save was refused.')
      announce()
      return rowFrom(row)
    },
  }
}

/** The published price list, newest version; null when none is published. */
export async function readPublishedDifficultyPrice(): Promise<DifficultyPriceVersion | null> {
  const result = (await supabase.from(TABLE).select(COLS).eq('status', 'published').order('version', { ascending: false }).limit(1)) as unknown as Result
  checkSupabaseError(result as never, 'read the pricing rules')
  const row = result.data?.[0]
  return row ? rowFrom(row) : null
}

const HOLD_MS = 60_000
let held: { at: number; read: Promise<DifficultyPriceVersion | null> } | null = null

/** The shared read. A failed read is not held, so the next caller tries again. */
export function loadPublishedDifficultyPrice(): Promise<DifficultyPriceVersion | null> {
  if (held && Date.now() - held.at < HOLD_MS) return held.read
  const read = readPublishedDifficultyPrice()
  held = { at: Date.now(), read }
  read.catch(() => {
    if (held?.read === read) held = null
  })
  return read
}

export function dropDifficultyPrice(): void {
  held = null
}
