/**
 * GC difficulty rating (punch list #357, PR 1): the reads and writes of `difficulty_criteria_versions`.
 *
 * Everyone signed in reads the versions (the GC's card, the Workbench and the master's sheet read the published one in
 * later PRs); a dev saves the draft and publishes it. The guard in the database stamps who and when, takes the next
 * version number and refuses a change to a published row, so the client sends the body and the note and nothing else.
 * One interface, so the card's smoke hands it a fake. The table is read by name until the types are regenerated after
 * the push (`as never`, as `billsSentIo.ts` reads `bill_hand_ways`).
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { parseDifficultyCriteriaBody, type DifficultyCriteriaBody } from './difficultyCriteria'

export type DifficultyCriteriaVersion = {
  id: string
  /** 0 on a draft. */
  version: number
  status: 'draft' | 'published'
  body: DifficultyCriteriaBody
  note: string
  publishedAt: string | null
  publishedByName: string
  updatedAt: string
}

export interface DifficultyCriteriaIo {
  /** Every version, published newest first, the draft (if any) first of all. */
  loadVersions(): Promise<DifficultyCriteriaVersion[]>
  /** Writes the draft's body and note; inserts the draft when `id` is null. Resolves to the row as saved. */
  saveDraft(id: string | null, body: DifficultyCriteriaBody, note: string): Promise<DifficultyCriteriaVersion>
  /** Flips the draft to published; the database takes the next version number. */
  publish(id: string): Promise<DifficultyCriteriaVersion>
  discardDraft(id: string): Promise<void>
}

const COLS = 'id, version, status, body, note, published_at, published_by_name, updated_at'

type RawRow = {
  id: string
  version: number
  status: string
  body: unknown
  note: string | null
  published_at: string | null
  published_by_name: string | null
  updated_at: string
}

function rowFrom(raw: RawRow): DifficultyCriteriaVersion {
  return {
    id: raw.id,
    version: raw.version,
    status: raw.status === 'published' ? 'published' : 'draft',
    body: parseDifficultyCriteriaBody(raw.body) ?? { scales: [] },
    note: raw.note ?? '',
    publishedAt: raw.published_at,
    publishedByName: raw.published_by_name ?? '',
    updatedAt: raw.updated_at,
  }
}

type Result = { data: RawRow[] | null; error: unknown }

const TABLE = 'difficulty_criteria_versions' as never

export function supabaseDifficultyCriteriaIo(): DifficultyCriteriaIo {
  return {
    async loadVersions() {
      const result = (await supabase.from(TABLE).select(COLS).order('version', { ascending: false })) as unknown as Result
      checkSupabaseError(result as never, 'read the difficulty criteria')
      return sortVersions((result.data ?? []).map(rowFrom))
    },
    async saveDraft(id, body, note) {
      const patch = { body, note } as never
      const result = (id
        ? await supabase.from(TABLE).update(patch).eq('id', id).select(COLS)
        : await supabase.from(TABLE).insert({ ...(patch as object), status: 'draft' } as never).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'save the draft')
      const row = result.data?.[0]
      if (!row) throw new Error('The draft was not saved. Nothing came back.')
      return rowFrom(row)
    },
    async publish(id) {
      const result = (await supabase.from(TABLE).update({ status: 'published' } as never).eq('id', id).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'publish the criteria')
      const row = result.data?.[0]
      if (!row) throw new Error('Nothing was published. The draft is not there, or the save was refused.')
      return rowFrom(row)
    },
    async discardDraft(id) {
      const result = (await supabase.from(TABLE).delete().eq('id', id).eq('status', 'draft')) as unknown as { error: unknown }
      checkSupabaseError(result as never, 'discard the draft')
    },
  }
}

/** The draft first, then published versions newest first. */
export function sortVersions(rows: DifficultyCriteriaVersion[]): DifficultyCriteriaVersion[] {
  return [...rows].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'draft' ? -1 : 1
    return b.version - a.version
  })
}

export function publishedDifficultyCriteria(rows: DifficultyCriteriaVersion[]): DifficultyCriteriaVersion | null {
  return rows.filter((r) => r.status === 'published').sort((a, b) => b.version - a.version)[0] ?? null
}

export function draftDifficultyCriteria(rows: DifficultyCriteriaVersion[]): DifficultyCriteriaVersion | null {
  return rows.find((r) => r.status === 'draft') ?? null
}
