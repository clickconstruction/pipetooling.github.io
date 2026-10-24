/**
 * Where they drive in from, found on the map (the owner's ask of 2026-10-23): a search box over the app's own map. The
 * words go through `geocode-one`, the same function the office address and the map's default view use, and the place
 * it finds draws as one pin on the Google canvas, or OpenStreetMap when the key is missing or Google fails on this
 * page (`resolveDashboardMapProvider`). Use this place hands the found words and the pin back; the window keeps nothing.
 */
import { lazy, Suspense, useState } from 'react'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { mapGeocodeErrorMessage } from '../../lib/map/geocodeErrorMessage'
import type { GeocodeOneResponse } from '../../lib/map/invokeGeocodeOneRefreshGoogleOnly'
import { MAP_CANVAS_SELECTED_COLOR, type MapCanvasPin } from '../../lib/map/mapCanvasTypes'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, input } from '../gc/gcUi'

const PinsMapCanvas = lazy(() => import('../map/PinsMapCanvas'))
const PinsMapGoogleCanvas = lazy(() => import('../map/PinsMapGoogleCanvas'))

export type HomePick = { words: string; pin: { lat: number; lng: number } }

const MAP_HEIGHT = 320

/** The words through the app's geocoder: the place, or why it was not found. */
async function findPlace(words: string): Promise<{ ok: true; words: string; lat: number; lng: number } | { ok: false; why: string }> {
  try {
    const r = await supabase.functions.invoke<GeocodeOneResponse>('geocode-one', { body: { address: words } })
    if (r.error) return { ok: false, why: formatErrorMessage(r.error, 'The map could not look that up.') }
    const d = r.data
    if (!d || typeof d !== 'object' || !('ok' in d)) return { ok: false, why: 'The map gave no answer.' }
    if (!d.ok) return { ok: false, why: mapGeocodeErrorMessage(d.error ?? 'unknown', d.detail) }
    // The geocoder's normalized form is a lookup key in lower case; the words as typed are the ones to keep.
    return { ok: true, words: words.trim(), lat: d.lat, lng: d.lng }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e, 'The map could not look that up.') }
  }
}

export function HomeMapWindow({ start, onPick, onClose }: { start: { words: string; pin: { lat: number; lng: number } | null }; onPick: (home: HomePick) => void; onClose: () => void }) {
  const [words, setWords] = useState(start.words)
  const [found, setFound] = useState<HomePick | null>(start.pin ? { words: start.words, pin: start.pin } : null)
  const [looking, setLooking] = useState(false)
  const [why, setWhy] = useState<string | null>(null)
  const [googleFailed, setGoogleFailed] = useState(false)
  const [fitSignal, setFitSignal] = useState(0)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const pins: MapCanvasPin[] = found ? [{ id: 'home', lat: found.pin.lat, lng: found.pin.lng, color: MAP_CANVAS_SELECTED_COLOR, title: found.words }] : []

  const look = async () => {
    const q = words.trim()
    if (!q || looking) return
    setLooking(true)
    setWhy(null)
    const r = await findPlace(q)
    setLooking(false)
    if (!r.ok) return setWhy(r.why)
    setFound({ words: r.words, pin: { lat: r.lat, lng: r.lng } })
    setFitSignal((n) => n + 1)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Find their home on the map" data-home-map="" style={{ position: 'fixed', inset: 0, zIndex: 790, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '1rem' }}>
      <div style={{ width: 'min(40rem, 100%)', maxHeight: '100%', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '0.9rem 1rem', display: 'grid', gap: '0.7rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Where they drive in from</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type an address, a city or a zip. The map finds it and pins it.</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void look()
          }}
          style={{ display: 'flex', gap: '0.5rem' }}
        >
          <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="1600 Oak St, Round Rock" style={{ ...input, flex: 1 }} disabled={looking} autoFocus />
          <Btn kind="primary" onClick={() => void look()} disabled={looking || !words.trim()}>
            {looking ? 'Looking…' : 'Find it'}
          </Btn>
        </form>
        {why ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-red-800)' }}>
            {why}
          </p>
        ) : null}
        <div style={{ position: 'relative', height: MAP_HEIGHT, overflow: 'hidden', isolation: 'isolate', background: 'var(--bg-muted)', borderRadius: 8 }}>
          {found ? (
            <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
              {provider === 'google' ? (
                <PinsMapGoogleCanvas apiKey={googleMapsBrowserKey()} onUnavailable={() => setGoogleFailed(true)} pins={pins} selectedId="home" onSelect={() => undefined} fitSignal={fitSignal} height={MAP_HEIGHT} isMobile={false} />
              ) : (
                <PinsMapCanvas pins={pins} selectedId="home" onSelect={() => undefined} fitSignal={fitSignal} height={MAP_HEIGHT} isMobile={false} />
              )}
            </Suspense>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              The map shows the place once it is found.
            </div>
          )}
        </div>
        {found ? (
          <div data-home-found="" style={{ fontSize: '0.85rem' }}>
            Found: <strong>{found.words}</strong>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Btn kind="plain" onClick={onClose}>
            Not now
          </Btn>
          <Btn kind="primary" onClick={() => found && onPick(found)} disabled={!found}>
            Use this place
          </Btn>
        </div>
      </div>
    </div>
  )
}
