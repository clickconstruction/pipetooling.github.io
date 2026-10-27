import { useEffect, useState } from 'react'
import { summarizeUnpricedFixtures } from '../lib/quickfill/unpricedFixtures'
import { loadUnpricedFixtureRows } from '../lib/quickfill/unpricedFixturesIo'

/**
 * Quickfill's count for the Unpriced fixtures station: jobs with a fixture nothing prices. The
 * station's banner reads the same rows through the same kernel (punch list #184 sweep B), so the
 * two never disagree. Fail-soft: a failed read keeps the count at zero.
 */
export function useUnpricedFixturesCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rows = await loadUnpricedFixtureRows()
        if (!cancelled) setCount(summarizeUnpricedFixtures(rows).jobCount)
      } catch {
        // Fail-soft, as before: the station keeps a zero.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return count
}
