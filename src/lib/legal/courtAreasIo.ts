import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { courtAreaFromRow, type CourtArea, type CourtAreaPolygon } from './courtAreas'
import type { CourtAreaDraft } from './courtAreasDraft'

/** The office's court areas (v2.4769): read, draw, rename, retire. `court_areas` is not in the generated types until the push. */

export type CourtAreaRow = { id: string; county: string; precinct: string; label: string | null; polygon: unknown; source: string | null; source_note: string | null; active: boolean | null; created_at: string; updated_at: string }

/** The untyped client: `court_areas` is not in the generated types until the push lands. */
function table(db: SupabaseClient) {
  return db.from('court_areas')
}

export async function listCourtAreas(db: SupabaseClient): Promise<Array<CourtArea & { createdAt: string }>> {
  const res = (await table(db).select('id, county, precinct, label, polygon, source, source_note, active, created_at, updated_at').eq('active', true).order('county').order('precinct')) as unknown as { data: CourtAreaRow[] | null; error: null }
  checkSupabaseError(res, 'load the court areas')
  return (res.data ?? []).map((r) => {
    const a = courtAreaFromRow(r)
    return a ? { ...a, createdAt: r.created_at } : null
  }).filter((a): a is CourtArea & { createdAt: string } => a !== null)
}

export async function insertCourtArea(db: SupabaseClient, draft: CourtAreaDraft, polygon: CourtAreaPolygon, userId: string | null): Promise<string> {
  const res = (await table(db).insert({ county: draft.county.trim(), precinct: draft.precinct.trim(), label: draft.label.trim(), polygon, source: 'drawn', source_note: draft.sourceNote.trim(), drawn_by: userId }).select('id').single()) as unknown as { data: { id: string } | null; error: null }
  checkSupabaseError(res, 'save the court area')
  return res.data?.id ?? ''
}

export async function updateCourtArea(db: SupabaseClient, id: string, patch: Partial<CourtAreaDraft> & { polygon?: CourtAreaPolygon }): Promise<void> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.county != null) fields.county = patch.county.trim()
  if (patch.precinct != null) fields.precinct = patch.precinct.trim()
  if (patch.label != null) fields.label = patch.label.trim()
  if (patch.sourceNote != null) fields.source_note = patch.sourceNote.trim()
  if (patch.polygon) fields.polygon = patch.polygon
  const res = (await table(db).update(fields).eq('id', id)) as unknown as { data: unknown; error: null }
  checkSupabaseError(res, 'change the court area')
}

/** Retire, never delete: the classification that read it stays explainable. */
export async function retireCourtArea(db: SupabaseClient, id: string): Promise<void> {
  const res = (await table(db).update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)) as unknown as { data: unknown; error: null }
  checkSupabaseError(res, 'remove the court area')
}
