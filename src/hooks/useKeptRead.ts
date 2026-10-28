import { useEffect, useId, useRef, useState } from 'react'
import { useIsDigitalTwin } from './useIsDigitalTwin'
import { isImpersonationSessionActive } from '../lib/impersonationSession'
import { buildKeptRead, keptReadIsUsable, keptReadOnScreen, type KeptRead, type KeptReadOnScreenStore } from '../lib/keptRead'
import { readKeptRead, writeKeptRead } from '../lib/keptReadStore'

/**
 * The kept read's one hook (#183 PR 2, v2.6031): a page hands it the key of what it is reading,
 * the rows it has rendered and whether its live read is out, and gets back the rows to draw.
 * While the live read of a key this session has not landed runs, those are the rows this device
 * kept for the key with their `readAt`, so the page paints at once with its stamp and its figures
 * muted; once every read of the page landed they are the live rows, written back as the kept read
 * for next time. A failed live read leaves the kept rows up with `failed` set, so the stamp reads
 * *could not read again*. The Pipeline is the first page on it (`JobsListCacheContext.tsx`).
 *
 *   - A half page is never kept: the write happens on the edge where `loading` turns false, with
 *     the rows of that render, so a page passes `loading` true until its last read landed.
 *   - A twin or an impersonated session never keeps a read (the key carries the acting user, and
 *     sign-out and an account switch clear the store: `useKeptReadsClearedOnAccountChange`, mounted
 *     in `AuthProvider`).
 *   - A key change drops the kept rows of the old key; a scope the page wants that the kept read
 *     does not cover means nothing kept is shown (`keptReadIsUsable`).
 *
 * While it hands back kept rows it registers on `keptReadOnScreen`, so the strip can say *The page
 * you see was read at 7:52 AM.*
 */

export interface UseKeptReadOptions {
  /** True while a live read of the page is out; the kept rows are written on the edge where it turns false. */
  loading: boolean
  /** The scopes the page wants: a kept read that does not cover every one is not shown. */
  scopes: readonly string[]
  /** What the landed rows cover, when wider than `scopes` (the Pipeline's merged sections); `scopes` when unset. */
  covers?: readonly string[]
  /** The live read failed: the kept rows stay up and `failed` is handed back; nothing is written. */
  failed?: boolean
  /** Force the hook on or off; unset, it is off for a twin and for an impersonated session. */
  enabled?: boolean
  /** The page's own check on each stored row; a row off the shape voids the kept read. */
  rowIsValid?: (row: unknown) => boolean
  /** The registry the strip reads; the app's unless a test passes its own. */
  onScreen?: KeptReadOnScreenStore
}

export interface UseKeptReadResult<T> {
  /** The rows to draw: the kept rows while the live read runs or after it failed, else the live rows. */
  rows: readonly T[] | null
  /** When the rows are kept, the epoch ms they were read; null when they are live. */
  readAt: number | null
  /** When the rows are kept, the scopes they cover; null when they are live. */
  scopes: readonly string[] | null
  /** The kept rows stayed up because the live read failed. */
  failed: boolean
}

export function useKeptRead<T>(key: string | null, rows: readonly T[] | null, opts: UseKeptReadOptions): UseKeptReadResult<T> {
  const twin = useIsDigitalTwin()
  const allowed = opts.enabled ?? (!twin && !isImpersonationSessionActive())
  const onScreen = opts.onScreen ?? keptReadOnScreen
  const id = useId()
  const [kept, setKept] = useState<KeptRead<T> | null>(null)
  const [failed, setFailed] = useState(false)

  // The latest of what the page hands in, read at the instant an effect decides.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const scopesRef = useRef(opts.scopes)
  scopesRef.current = opts.scopes
  const coversRef = useRef(opts.covers)
  coversRef.current = opts.covers
  const failedRef = useRef(opts.failed === true)
  failedRef.current = opts.failed === true
  const rowIsValidRef = useRef(opts.rowIsValid)
  rowIsValidRef.current = opts.rowIsValid
  const loadingRef = useRef(opts.loading)
  loadingRef.current = opts.loading
  const keptRef = useRef(kept)
  keptRef.current = kept

  /** The key whose live read landed last; a read out for it is a refresh, so nothing kept is shown. */
  const landedKeyRef = useRef<string | null>(null)
  /** Bumps on every decision, so a store read that comes back late is dropped. */
  const genRef = useRef(0)
  const prevLoadingRef = useRef(opts.loading)

  // A key change: the rows kept for the old key are not this page's.
  useEffect(() => {
    if (keptRef.current && keptRef.current.key !== key) {
      setKept(null)
      setFailed(false)
    }
  }, [key])

  // A live read out for a key other than the landed one: look for the read this device kept.
  useEffect(() => {
    if (!allowed || !key || !opts.loading) return
    if (landedKeyRef.current === key) return
    if (keptRef.current?.key === key) return
    const gen = ++genRef.current
    const wanted = scopesRef.current
    void readKeptRead(key, rowIsValidRef.current).then((found) => {
      if (gen !== genRef.current) return
      if (!loadingRef.current) return // the live read landed first
      if (!found || !keptReadIsUsable({ kept: found, key, wantedScopes: wanted, now: Date.now() })) return
      setKept(found as KeptRead<T>)
      setFailed(false)
    })
  }, [allowed, key, opts.loading])

  // The edges of loading. Turned true with kept rows up: a read again, so the stamp reads *reading
  // again…* once more. Turned false: landed → the live rows are what this device keeps now;
  // failed → the kept rows stay up and say so.
  useEffect(() => {
    const was = prevLoadingRef.current
    prevLoadingRef.current = opts.loading
    if (!key) return
    if (opts.loading) {
      if (!was && keptRef.current) setFailed(false)
      return
    }
    if (!was) return
    genRef.current += 1
    if (failedRef.current) {
      if (keptRef.current) setFailed(true)
      return
    }
    const landed = rowsRef.current
    if (landed == null) return
    landedKeyRef.current = key
    setKept(null)
    setFailed(false)
    if (allowed) void writeKeptRead(buildKeptRead({ key, scopes: coversRef.current ?? scopesRef.current, rows: landed, now: Date.now() }))
  }, [allowed, key, opts.loading])

  // Say so to the strip while kept rows are on screen.
  useEffect(() => {
    if (!kept) return
    onScreen.show(id, kept.readAt)
    return () => onScreen.hide(id)
  }, [id, kept, onScreen])

  if (kept) return { rows: kept.rows, readAt: kept.readAt, scopes: kept.scopes, failed }
  return { rows, readAt: null, scopes: null, failed: false }
}

/** The earliest stamp of the kept parts on screen, for the strip's sentence; null when the page is live. */
export function useKeptReadOnScreen(store: KeptReadOnScreenStore = keptReadOnScreen): number | null {
  const [readAt, setReadAt] = useState<number | null>(() => store.read())
  useEffect(() => {
    const refresh = () => setReadAt(store.read())
    refresh()
    return store.subscribe(refresh)
  }, [store])
  return readAt
}
