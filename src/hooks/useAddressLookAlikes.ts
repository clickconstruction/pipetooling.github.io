import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { addressesOnFile } from '../lib/addresses/addressesOnFile'
import { lookAlikes, pairKeys, type LookAlikePair, type LookAlikes, type MapPoint, type PlaceAnswer } from '../lib/addresses/lookAlikes'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { formatErrorMessage } from '../utils/errorHandling'
import type { SpellingFixRow } from '../lib/addresses/fixSpelling'
import { everyRow, forgetAddressesOnFile, readAddresses } from './useAddressesOnFile'

/**
 * Addresses that look alike (punch list #439, piece 2): the reads and the two writes behind the window and the
 * count on the Pipeline's tools button. The table of answers is younger than the generated types, so the client
 * is cast once here.
 */
const db = supabase as unknown as SupabaseClient

/** The map's own points, one under each address as written. A row with no point is left out. */
async function readMapPoints(): Promise<Map<string, MapPoint>> {
  const rows = await everyRow('address_geocodes', 'address_normalized, lat, lng', 'address_normalized')
  const out = new Map<string, MapPoint>()
  for (const r of rows) {
    if (typeof r.address_normalized === 'string' && typeof r.lat === 'number' && typeof r.lng === 'number') out.set(r.address_normalized, { lat: r.lat, lng: r.lng })
  }
  return out
}

async function readAnswers(): Promise<PlaceAnswer[]> {
  const rows = await everyRow('address_place_answers', 'key_a, key_b, same, by_name, answered_at', 'key_a')
  const out: PlaceAnswer[] = []
  for (const r of rows) {
    if (typeof r.key_a !== 'string' || typeof r.key_b !== 'string' || typeof r.same !== 'boolean') continue
    out.push({ keyA: r.key_a, keyB: r.key_b, same: r.same, byName: typeof r.by_name === 'string' ? r.by_name : '', at: typeof r.answered_at === 'string' ? r.answered_at : '' })
  }
  return out
}

/** One whole read: every address on file, the map's points and the answers, paired up. Throws with the reason. */
export async function readLookAlikes(): Promise<LookAlikes> {
  // The addresses come fresh, and a failed read throws: an empty list here would read as nothing waiting.
  const [addresses, points, answers] = await Promise.all([readAddresses(), readMapPoints(), readAnswers()])
  return lookAlikes(addressesOnFile(addresses.rows, addresses.developments), points, answers)
}

/** Keep an answer for a pair. Answering again replaces the first answer. Null when it landed, else the reason. */
export async function answerLookAlike(pair: Pick<LookAlikePair, 'a' | 'b'>, same: boolean): Promise<string | null> {
  const { keyA, keyB } = pairKeys(pair.a.key, pair.b.key)
  try {
    const { error } = await db.from('address_place_answers').upsert({ key_a: keyA, key_b: keyB, same }, { onConflict: 'key_a,key_b' })
    return error ? formatErrorMessage(error, 'The answer was not kept.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The answer was not kept.')
  }
}

/** Take an answer back, so the pair is asked again. Null when it landed, else the reason. */
export async function undoLookAlike(pair: Pick<LookAlikePair, 'a' | 'b'>): Promise<string | null> {
  const { keyA, keyB } = pairKeys(pair.a.key, pair.b.key)
  try {
    const { error } = await db.from('address_place_answers').delete().eq('key_a', keyA).eq('key_b', keyB)
    return error ? formatErrorMessage(error, 'The answer was not taken back.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The answer was not taken back.')
  }
}

/** One row the fix did not change, with the reason. */
export type SpellingFixFailure = { row: SpellingFixRow; reason: string }

/**
 * Fix the spelling: write `to` as the address of each picked job and bid. It keeps going past a row that fails
 * and answers every one that did not take with its reason. A row the reader may not change answers no error and
 * no row, so that is read as a refusal too.
 */
export async function fixSpelling(rows: ReadonlyArray<SpellingFixRow>, to: string): Promise<{ done: number; failed: SpellingFixFailure[] }> {
  let done = 0
  const failed: SpellingFixFailure[] = []
  for (const row of rows) {
    try {
      const write = row.kind === 'job' ? db.from('jobs_ledger').update({ job_address: to }) : db.from('bids').update({ address: to })
      const { data, error } = await write.eq('id', row.id).select('id')
      if (error) failed.push({ row, reason: formatErrorMessage(error, 'The address was not changed.') })
      else if (!Array.isArray(data) || data.length === 0) failed.push({ row, reason: 'Your account may not change this one.' })
      else done += 1
    } catch (e) {
      failed.push({ row, reason: formatErrorMessage(e, 'The address was not changed.') })
    }
  }
  // The job form's list of addresses on file is a minute old at most: after a fix it reads again.
  if (done > 0) forgetAddressesOnFile()
  return { done, failed }
}

// ---------- The count on the tools button ----------

const COUNT_FRESH_MS = 5 * 60_000
/** How long the count waits after the page opens before it reads. */
export const COUNT_WAIT_MS = 2500
let keptCount: { at: number; toLook: number } | null = null
const countFollowers = new Set<(n: number | null) => void>()

/** Tell every count on the page the new number, after an answer in the window. */
export function lookAlikeCountChanged(toLook: number): void {
  keptCount = { at: Date.now(), toLook }
  for (const f of [...countFollowers]) f(toLook)
}

/**
 * How many pairs still wait for an answer, for the count on the Pipeline's tools button. Read once `enabled`,
 * kept five minutes, and null until it is known or when the read fails: a count is a hint, so a failure shows
 * no number.
 */
export function useLookAlikeCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(keptCount?.toLook ?? null)
  useEffect(() => {
    if (!enabled) return
    countFollowers.add(setCount)
    let live = true
    // The count is a hint, so it waits its turn: the page's own reads go first.
    const timer =
      !keptCount || Date.now() - keptCount.at >= COUNT_FRESH_MS
        ? window.setTimeout(() => {
            void readLookAlikes().then(
              (found) => {
                if (live) lookAlikeCountChanged(found.toLook)
              },
              () => undefined,
            )
          }, COUNT_WAIT_MS)
        : null
    return () => {
      live = false
      if (timer != null) window.clearTimeout(timer)
      countFollowers.delete(setCount)
    }
  }, [enabled])
  return count
}

/** The window's read: the pairs, a failure with its reason, and a way to read again. */
export function useAddressLookAlikes(): { found: LookAlikes | null; failure: OfflineRecoveryLastError | null; loading: boolean; reload: () => void } {
  const [found, setFound] = useState<LookAlikes | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true)
    setFailure(null)
    readLookAlikes().then(
      (f) => {
        if (!live) return
        setFound(f)
        setLoading(false)
        lookAlikeCountChanged(f.toLook)
      },
      (e) => {
        if (!live) return
        setFailure(recoveryFailureFromError(e, 'Couldn’t read the addresses that look alike'))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [tick])
  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { found, failure, loading, reload }
}
