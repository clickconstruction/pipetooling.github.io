import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupFieldPhotosByEstimate, type HandoverEstimateRow, type HandoverGroup, type HandoverPhotoRow } from '../lib/quickfill/fieldPhotoHandover'

export type FieldPhotoHandoverRow = { estimate_id: string; moved_at: string }

export type QuickfillFieldPhotos = {
  /** The estimates still holding field photos, oldest first; null until the first load. */
  groups: HandoverGroup[] | null
  /** The hand-over rows the read saw, for "moved since the last look". */
  handovers: FieldPhotoHandoverRow[]
  loading: boolean
  problem: string | null
  reload: () => Promise<void>
  /** An estimate whose photos were just moved leaves the list at once. */
  removeGroup: (estimateId: string) => void
}

/**
 * The Field photos → Drive read, at page level (v2.5888, punch list #180, PR 5): the estimates still
 * holding Quick Estimate photos in app storage, grouped oldest first. The page reports the count from
 * here so it stays live while the strip is collapsed, which is when the round marks the station; the
 * section signs the photo URLs itself when it is on screen. Fail-soft: a failed read leaves the last
 * list and says so.
 */
export function useQuickfillFieldPhotos(enabled: boolean): QuickfillFieldPhotos {
  const [groups, setGroups] = useState<HandoverGroup[] | null>(null)
  const [handovers, setHandovers] = useState<FieldPhotoHandoverRow[]>([])
  const [loading, setLoading] = useState(enabled)
  const [problem, setProblem] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setGroups(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: photos, error } = await supabase.from('estimate_field_photos').select('id, estimate_id, storage_path, filename, created_at').order('created_at', { ascending: true }).limit(400)
      if (error) throw error
      const photoRows = (photos ?? []) as HandoverPhotoRow[]
      if (photoRows.length === 0) {
        setGroups([])
        setHandovers([])
        setProblem(null)
        return
      }
      const estimateIds = [...new Set(photoRows.map((p) => p.estimate_id))]
      const [{ data: ests }, { data: moved }] = await Promise.all([
        supabase.from('estimates').select('id, estimate_number, doc_kind, title, status, customers(name)').in('id', estimateIds),
        supabase.from('estimate_photo_handover').select('estimate_id, moved_at').in('estimate_id', estimateIds),
      ])
      const handoverRows = (moved ?? []) as FieldPhotoHandoverRow[]
      const movedIds = new Set(handoverRows.map((h) => h.estimate_id))
      const estimateRows: HandoverEstimateRow[] = ((ests ?? []) as Array<{ id: string; estimate_number: number | null; doc_kind: string; title: string; status: string; customers: { name: string } | { name: string }[] | null }>)
        .filter((e) => !movedIds.has(e.id))
        .map((e) => {
          const c = Array.isArray(e.customers) ? e.customers[0] : e.customers
          return { id: e.id, estimate_number: e.estimate_number, doc_kind: e.doc_kind, title: e.title, status: e.status, customerName: c?.name ?? null }
        })
      setGroups(groupFieldPhotosByEstimate(photoRows, estimateRows))
      setHandovers(handoverRows)
      setProblem(null)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not load the field photos.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const removeGroup = useCallback((estimateId: string) => {
    setGroups((prev) => (prev ? prev.filter((g) => g.estimateId !== estimateId) : prev))
  }, [])

  return { groups, handovers, loading, problem, reload, removeGroup }
}
