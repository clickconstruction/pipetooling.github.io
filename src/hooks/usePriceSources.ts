import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadPriceSources } from '../lib/materials/priceSheet/priceRowIo'
import type { PriceSource } from '../lib/materials/priceSheet/rowCard'

/**
 * Where each of a part's prices came from, by price row id (punch list #308): a quote, a pasted row,
 * a call. Empty for a price typed with no source, and until the columns are live. `reloadKey` reads
 * again after a price is filed or taken back.
 */
export function usePriceSources(partId: string | null | undefined, reloadKey: unknown = 0): Map<string, PriceSource> {
  const [sources, setSources] = useState<Map<string, PriceSource>>(new Map())
  useEffect(() => {
    if (!partId) {
      setSources(new Map())
      return
    }
    let cancelled = false
    void loadPriceSources(supabase, partId).then((m) => {
      if (!cancelled) setSources(m)
    })
    return () => {
      cancelled = true
    }
  }, [partId, reloadKey])
  return sources
}
