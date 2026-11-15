import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DifficultyPicks } from '../lib/bids/difficultyCriteria'
import { bidPicksUnder, difficultyBidScales } from '../lib/bids/bidDifficultyPicks'
import { BID_DIFFICULTY_PICKS_CHANGED_EVENT, supabaseBidDifficultyPicksIo, type BidDifficultyPicksIo } from '../lib/bids/bidDifficultyPicksIo'
import type { DifficultyVersionLite } from '../lib/bids/gcDifficultyRating'
import { loadPublishedDifficultyVersions } from '../lib/bids/gcDifficultyRatingIo'

const DEFAULT_IO = supabaseBidDifficultyPicksIo()
const NO_PICKS: DifficultyPicks = {}

export type BidDifficultyPicksState = {
  /** The published criteria version; null until read, or when none is published. */
  published: DifficultyVersionLite | null
  /** The bid's own picks as the published version knows them. */
  picks: DifficultyPicks
  /** Whether the published version has a scale picked on the bid at all. */
  hasBidScales: boolean
  loaded: boolean
  /** Saves one pick (null clears it) and resolves to the picks as saved. Throws on a refusal. */
  pick: (key: string, points: number | null) => Promise<DifficultyPicks>
}

/**
 * A bid's own difficulty picks (punch list #357, PR 6): the site. Reads the published criteria and the bid's row,
 * carries the stored picks to the published version by the rule, and writes a pick under it. Each read fails soft
 * to no picks: a Workbench never waits on this.
 */
export function useBidDifficultyPicks(bidId: string | null, opts: { io?: BidDifficultyPicksIo; loadVersions?: () => Promise<{ published: DifficultyVersionLite | null }> } = {}): BidDifficultyPicksState {
  const io = opts.io ?? DEFAULT_IO
  const loadVersions = opts.loadVersions ?? loadPublishedDifficultyVersions
  const [published, setPublished] = useState<DifficultyVersionLite | null>(null)
  const [stored, setStored] = useState<DifficultyPicks>(NO_PICKS)
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    loadVersions()
      .then((v) => {
        if (live) setPublished(v.published)
      })
      .catch(() => {
        if (live) setPublished(null)
      })
    return () => {
      live = false
    }
  }, [loadVersions])

  useEffect(() => {
    setStored(NO_PICKS)
    setLoaded(false)
    if (!bidId) return
    let live = true
    io.load(bidId)
      .then((row) => {
        if (!live) return
        setStored(row?.picks ?? NO_PICKS)
        setLoaded(true)
      })
      .catch(() => {
        if (!live) return
        setStored(NO_PICKS)
        setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [bidId, io, tick])

  // Another surface saved a pick on this bid (the master's sheet): read again.
  useEffect(() => {
    if (!bidId) return
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<string>).detail === bidId) setTick((n) => n + 1)
    }
    window.addEventListener(BID_DIFFICULTY_PICKS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(BID_DIFFICULTY_PICKS_CHANGED_EVENT, onChanged)
  }, [bidId])

  const body = published?.body ?? null
  const picks = useMemo(() => bidPicksUnder(stored, body), [stored, body])
  const hasBidScales = difficultyBidScales(body).length > 0

  const pick = useCallback(
    async (key: string, points: number | null) => {
      if (!bidId || !published) throw new Error('No criteria are published yet.')
      const next: DifficultyPicks = { ...bidPicksUnder(stored, published.body) }
      if (points == null) delete next[key]
      else next[key] = points
      const saved = await io.save(bidId, published.id, next)
      setStored(saved.picks)
      return bidPicksUnder(saved.picks, published.body)
    },
    [bidId, published, stored, io],
  )

  return { published, picks, hasBidScales, loaded, pick }
}
