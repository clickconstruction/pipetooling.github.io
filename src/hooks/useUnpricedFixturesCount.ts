import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUnpricedFixturesCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase.rpc('list_tally_parts_with_po')
      if (error || cancelled) return
      const rows = (data ?? []) as Array<{ job_id: string; part_id: string | null; fixture_cost: number | null }>
      const unpricedJobIds = new Set<string>()
      for (const r of rows) {
        if (r.part_id == null && (r.fixture_cost == null || Number(r.fixture_cost) === 0)) {
          unpricedJobIds.add(r.job_id)
        }
      }
      if (!cancelled) setCount(unpricedJobIds.size)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return count
}
