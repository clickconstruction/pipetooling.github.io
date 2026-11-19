import { useEffect, useState } from 'react'

import { loadLatestPull, loadNewestPermitDay } from '../lib/research/permitResearchIo'
import { cityQuiet, type CityQuiet } from '../lib/research/permitQuiet'
import { RESEARCH_CITIES } from '../lib/research/permitResearch'

/**
 * Permits, the city picker's marks (v2.7880): each city's newest permit day and whether the city
 * has gone quiet, by `cityQuiet`. The cities are read one at a time, as the skim's nudge reads
 * them, so the reads never crowd the lists. A city that cannot be read keeps its bare name. Reads
 * again when `refreshKey` changes (Pull now) and when the day turns.
 */
export function usePermitCityQuiet(enabled: boolean, todayYmd: string, refreshKey: number): Readonly<Record<string, CityQuiet>> {
  const [byCity, setByCity] = useState<Record<string, CityQuiet>>({})

  useEffect(() => {
    if (!enabled) return
    let live = true
    void (async () => {
      for (const city of RESEARCH_CITIES) {
        try {
          const [newestDay, pull] = await Promise.all([loadNewestPermitDay(city, todayYmd), loadLatestPull(city).catch(() => null)])
          if (!live) return
          const answer = cityQuiet({ city, newestDay, todayYmd, pull, nowMs: Date.now() })
          setByCity((prev) => ({ ...prev, [city]: answer }))
        } catch {
          // One city that cannot be read does not hide the others; its row stays the name alone.
        }
      }
    })()
    return () => {
      live = false
    }
  }, [enabled, todayYmd, refreshKey])

  return byCity
}
