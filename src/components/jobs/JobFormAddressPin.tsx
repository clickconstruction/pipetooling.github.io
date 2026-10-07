import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import { invokeGeocodeOneRefreshGoogleOnly, type GeocodeOneResponse } from '../../lib/map/invokeGeocodeOneRefreshGoogleOnly'
import { ADDRESS_PIN_PAUSE_MS, addressLooksWhole, addressPinFailureReason, addressPinWords, type AddressPinState } from '../../lib/jobs/addressPinWords'

/**
 * The *On the map* line under the Job address (v2.4783, the owner's ask of
 * 2026-10-07): the address pins itself through `geocode-one` — the cache, then the
 * street map, Google and the Census — on blur or a pause after a whole-looking
 * address, and says the county it landed in so a wrong pin is seen at the desk.
 * Advice, never law: nothing here blocks a save, and nothing is written on the job;
 * the pin lives in `address_geocodes` under the address, where the Map page and the
 * court map read it. Only the roles the function admits see the line.
 */
export default function JobFormAddressPin({ address, blurSignal = 0 }: { address: string; blurSignal?: number }) {
  // Outside an AuthProvider (render smokes of the form) there is no role and the line stays silent.
  const role = useOptionalAuth()?.role ?? null
  const allowed = role === 'dev' || role === 'master_technician' || role === 'estimator' || isAssistantLike(role)
  const [state, setState] = useState<AddressPinState>({ kind: 'idle' })
  const [lastRunFor, setLastRunFor] = useState('')
  const timer = useRef<number | null>(null)
  const key = normalizeAddressForGeocodeKey(address)

  const place = useCallback(async (addr: string, googleOnly = false) => {
    const k = normalizeAddressForGeocodeKey(addr)
    setLastRunFor(k)
    setState({ kind: 'placing' })
    try {
      const res = googleOnly
        ? await invokeGeocodeOneRefreshGoogleOnly(addr)
        : await supabase.functions.invoke<GeocodeOneResponse>('geocode-one', { body: { address: addr } })
      const data = (res as { data?: GeocodeOneResponse | null }).data ?? (res as GeocodeOneResponse)
      if (!data || typeof data !== 'object' || !('ok' in data)) throw new Error('no answer')
      if (data.ok) setState({ kind: 'placed', county: ((data as { county?: string }).county ?? '').trim(), source: data.source ?? 'cache' })
      else setState({ kind: 'failed', reason: addressPinFailureReason(data.error) })
    } catch {
      setState({ kind: 'failed', reason: addressPinFailureReason('upstream') })
    }
  }, [])

  // On open and on every change: the cache says at once whether the address is placed; nothing is looked up.
  useEffect(() => {
    if (!allowed) return
    if (timer.current) window.clearTimeout(timer.current)
    if (!key || key.length < 8) {
      setState({ kind: 'idle' })
      return
    }
    if (key === lastRunFor) return
    let alive = true
    void (async () => {
      const { data } = await supabase.from('address_geocodes').select('lat').eq('address_normalized', key).maybeSingle()
      if (!alive) return
      if (data) {
        setState({ kind: 'placed', county: '', source: 'cache' })
        setLastRunFor(key)
      } else {
        setState({ kind: 'unplaced' })
        // A whole-looking address pins itself after a pause; a fragment waits for the blur.
        if (addressLooksWhole(address)) timer.current = window.setTimeout(() => void place(address), ADDRESS_PIN_PAUSE_MS)
      }
    })()
    return () => {
      alive = false
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, allowed])

  // Leaving the field: an unplaced address is looked up now.
  useEffect(() => {
    if (!allowed || blurSignal === 0) return
    if (state.kind === 'unplaced' && key.length >= 8) void place(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blurSignal])

  if (!allowed || state.kind === 'idle') return null
  const w = addressPinWords(state)
  const color = w.tone === 'ok' ? '#16a34a' : w.tone === 'amber' ? '#d97706' : 'var(--text-muted)'
  return (
    <div data-job-address-pin data-pin-state={state.kind} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem', marginTop: 3 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>On the map</span>
      <span style={{ color: w.tone === 'ok' ? 'var(--text)' : color, animation: w.tone === 'pulse' ? 'jobAddressPinPulse 1.2s ease-in-out infinite' : undefined }}>{w.main}</span>
      {w.tone === 'ok' ? <span aria-hidden style={{ color: '#16a34a' }}>✓</span> : null}
      {w.note ? <span style={{ color: 'var(--text-muted)' }}>· {w.note}</span> : null}
      {state.kind === 'unplaced' ? <button type="button" onClick={() => void place(address)} style={chip}>Place it</button> : null}
      {state.kind === 'placed' ? <button type="button" onClick={() => void place(address, true)} title="Ask Google for the pin instead" style={chip}>Not right? Pin from Google</button> : null}
      {state.kind === 'failed' ? <button type="button" onClick={() => void place(address)} style={chip}>Try again</button> : null}
    </div>
  )
}

const chip: React.CSSProperties = { font: 'inherit', fontSize: '0.7rem', padding: '0 8px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', lineHeight: 1.6 }
