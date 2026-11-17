import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { onNoteTagsChanged } from '../lib/jobs/noteTagsIo'

const EMPTY: ReadonlyMap<string, string[]> = new Map()

/**
 * Who each task waits on (punch list #375): the names tagged in a note on it and not yet answered,
 * by task. Review's board draws them beside a row's note count. One read for the tasks listed,
 * chunked so a wide board cannot overflow the address, and read again when a tag changes in this
 * tab. A read that fails draws nothing: the words are an addition to a row that reads whole.
 */
export function useOpenTaskTagNames(itemIds: readonly string[]): ReadonlyMap<string, string[]> {
  const key = useMemo(() => [...new Set(itemIds)].sort().join(','), [itemIds])
  const [state, setState] = useState<{ key: string; byItem: ReadonlyMap<string, string[]> }>({ key: '', byItem: EMPTY })
  const [changed, setChanged] = useState(0)
  useEffect(() => (key ? onNoteTagsChanged(() => setChanged((n) => n + 1)) : undefined), [key])

  useEffect(() => {
    if (!key) return
    let live = true
    const ids = key.split(',')
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
    void Promise.all(chunks.map((chunk) => supabase.from('task_note_tags').select('item_id, tagged_name, created_at').is('cleared_at', null).in('item_id', chunk))).then((results) => {
      if (!live || results.some((r) => r.error)) return
      const rows = results.flatMap((r) => r.data ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
      const byItem = new Map<string, string[]>()
      for (const r of rows) {
        const names = byItem.get(r.item_id) ?? []
        if (!names.includes(r.tagged_name)) names.push(r.tagged_name)
        byItem.set(r.item_id, names)
      }
      setState({ key, byItem: byItem.size === 0 ? EMPTY : byItem })
    })
    return () => {
      live = false
    }
  }, [key, changed])

  return state.key === key ? state.byItem : EMPTY
}
