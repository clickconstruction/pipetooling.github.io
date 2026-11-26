import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeAddressKey } from '../lib/developments/notInIt'
import type { AddressOnFile } from '../lib/addresses/addressesOnFile'
import { pairKeys, type MapPoint, type PlaceAnswer } from '../lib/addresses/lookAlikes'
import { SAME_SPOT_BOX_DEGREES, samePlaceOnFile, sameSpotOnFile, type SameSpotOnFile } from '../lib/addresses/sameSpotOnFile'
import { answerPlaceKeys, readAnswers } from './useAddressLookAlikes'

/**
 * The reads and the write behind the job form's question about a place (punch list #439, piece 2, its last part):
 * the answers kept so far, the map's points in a small box around the typed address, and the answer a press
 * keeps. It reads only once the typed address has a point, is not on file itself, and the box has been left.
 *
 * A hint, never a gate: a read that fails answers nothing and the form works as before. The answers are kept for a
 * minute, shared by every box on the page, and an answer kept here joins them at once.
 */
const FRESH_MS = 60_000
let keptAnswers: { at: number; answers: PlaceAnswer[] } | null = null

/** Forget the kept answers. For tests. */
export function forgetPlaceAnswers(): void {
  keptAnswers = null
}

async function answersRead(): Promise<PlaceAnswer[]> {
  if (keptAnswers && Date.now() - keptAnswers.at < FRESH_MS) return keptAnswers.answers
  const answers = await readAnswers()
  keptAnswers = { at: Date.now(), answers }
  return answers
}

/** The map's points within the box around `at`, one under each address as written. */
async function pointsNear(at: MapPoint): Promise<Map<string, MapPoint>> {
  const d = SAME_SPOT_BOX_DEGREES
  const { data, error } = await supabase
    .from('address_geocodes')
    .select('address_normalized, lat, lng')
    .gte('lat', at.lat - d)
    .lte('lat', at.lat + d)
    .gte('lng', at.lng - d)
    .lte('lng', at.lng + d)
    .limit(500)
  if (error) throw error
  const out = new Map<string, MapPoint>()
  for (const r of (data ?? []) as { address_normalized: unknown; lat: unknown; lng: unknown }[]) {
    if (typeof r.address_normalized === 'string' && typeof r.lat === 'number' && typeof r.lng === 'number') out.set(r.address_normalized, { lat: r.lat, lng: r.lng })
  }
  return out
}

type Read = { key: string; spot: string; points: Map<string, MapPoint>; answers: PlaceAnswer[] }

export type SameSpotRead = {
  /** The addresses on file to ask about, the nearest first. */
  asks: SameSpotOnFile[]
  /** The addresses on file the answers already make one place with the typed one. */
  joined: AddressOnFile[]
  /** Keep an answer about the typed address and one on file. Null when it landed, else the reason. */
  answer: (entry: AddressOnFile, same: boolean) => Promise<string | null>
}

export function useSameSpotOnFile({
  address,
  list,
  point,
  enabled,
  skipKeys,
}: {
  address: string
  list: ReadonlyArray<AddressOnFile>
  /** The typed address's own map point, once the map has one. */
  point: MapPoint | null
  enabled: boolean
  skipKeys?: ReadonlySet<string>
}): SameSpotRead {
  const key = normalizeAddressKey(address)
  const onFile = useMemo(() => list.some((a) => a.key === key), [list, key])
  const lat = point?.lat ?? null
  const lng = point?.lng ?? null
  const spot = lat != null && lng != null ? `${lat},${lng}` : ''
  const wanted = enabled && key !== '' && !onFile && list.length > 0 && spot !== ''
  const [read, setRead] = useState<Read | null>(null)

  useEffect(() => {
    if (!wanted || lat == null || lng == null) return
    let live = true
    void Promise.all([pointsNear({ lat, lng }), answersRead()]).then(
      ([points, answers]) => {
        if (live) setRead({ key, spot, points, answers })
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [wanted, key, spot, lat, lng])

  // A read made for another address or another point says nothing about this one.
  const mine = wanted && read && read.key === key && read.spot === spot ? read : null
  const asks = useMemo(
    () => (mine && lat != null && lng != null ? sameSpotOnFile(list, address, { lat, lng }, mine.points, mine.answers, skipKeys) : []),
    [mine, list, address, lat, lng, skipKeys],
  )
  const joined = useMemo(() => (mine ? samePlaceOnFile(list, address, mine.answers) : []), [mine, list, address])

  const answer = useCallback(
    async (entry: AddressOnFile, same: boolean): Promise<string | null> => {
      const problem = await answerPlaceKeys(key, entry.key, same)
      if (problem) return problem
      const kept: PlaceAnswer = { ...pairKeys(key, entry.key), same, byName: '', at: new Date().toISOString() }
      const without = (answers: PlaceAnswer[]) => answers.filter((a) => !(a.keyA === kept.keyA && a.keyB === kept.keyB))
      if (keptAnswers) keptAnswers = { at: keptAnswers.at, answers: [...without(keptAnswers.answers), kept] }
      setRead((r) => (r ? { ...r, answers: [...without(r.answers), kept] } : r))
      return null
    },
    [key],
  )
  return { asks, joined, answer }
}
