import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { APP_SETTINGS_KEY_EASTER_EGGS } from '../lib/appSettingsKeys'
import {
  EASTER_EGG_SPRITES,
  eggActiveFor,
  parseEasterEggsSetting,
  rollEggAppearance,
  type EasterEggConfig,
} from '../lib/easterEggsConfig'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { createEggState, eggOpacity, eggTransform, stepEgg } from '../lib/easterEggMotion'

/** Settings → Easter eggs "Preview here now" fires this to skip the dice. */
export const EASTER_EGG_PREVIEW_EVENT = 'pipetooling:easter-egg-preview'

/**
 * The visit itself (v2.2074): a fixed, pointer-events-none sprite driven by
 * the pure kernel in `easterEggMotion.ts` from one requestAnimationFrame loop
 * — style written via refs, zero React re-renders per frame. Plays 7s, leaves,
 * calls onDone. Never mounted when prefers-reduced-motion is set (host gates).
 */
function FloatingEasterEggSprite({ src, onDone }: { src: string; onDone: () => void }) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 3 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)
    let state = createEggState(window.innerWidth, window.innerHeight, performance.now())
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      state = stepEgg(state, {
        mouseX: mouse.x,
        mouseY: mouse.y,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        dtSec: (now - last) / 1000,
        nowMs: now,
      })
      last = now
      if (state.phase === 'done') {
        onDoneRef.current()
        return
      }
      img.style.transform = eggTransform(state, now)
      img.style.opacity = String(eggOpacity(state, now))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <>
      <style>{`@media print { .easter-egg-sprite { display: none !important; } }`}</style>
      <img
        ref={imgRef}
        src={src}
        alt=""
        aria-hidden="true"
        className="easter-egg-sprite"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 110,
          pointerEvents: 'none',
          zIndex: 9000,
          willChange: 'transform',
          opacity: 0,
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))',
        }}
      />
    </>
  )
}

/**
 * Mounted once in the Layout: loads the dev-managed `easter_eggs_v1` config,
 * and on each targeted-surface open rolls 1-in-15 for a 7-second visit. The
 * Settings block's preview event skips the dice (and the surface check) so a
 * dev can watch it anywhere.
 */
export function EasterEggHost({ userId }: { userId: string | null }) {
  const location = useLocation()
  const [configs, setConfigs] = useState<EasterEggConfig[]>([])
  const [activeEggKey, setActiveEggKey] = useState<string | null>(null)
  const lastSurfaceSigRef = useRef<string | null>(null)
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const data = (await withSupabaseRetry(
          async () =>
            supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_EASTER_EGGS).maybeSingle(),
          'fetch easter eggs config',
        )) as { value_text: string | null } | null
        if (!cancelled) setConfigs(parseEasterEggsSetting(data?.value_text))
      } catch {
        /* eggs are never worth an error */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // Preview event from Settings — skip dice and surface targeting.
  useEffect(() => {
    const onPreview = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key
      if (key && key in EASTER_EGG_SPRITES && !reducedMotion) setActiveEggKey(key)
    }
    window.addEventListener(EASTER_EGG_PREVIEW_EVENT, onPreview)
    return () => window.removeEventListener(EASTER_EGG_PREVIEW_EVENT, onPreview)
  }, [reducedMotion])

  // One appearance decision per surface OPEN (entering a targeted surface),
  // not per render: the first open of each company day is a guaranteed visit
  // (v2.2077), every later open rolls the 1-in-15 dice.
  useEffect(() => {
    if (reducedMotion || activeEggKey) return
    const tab = new URLSearchParams(location.search).get('tab')
    const eligible = configs.filter((c) => eggActiveFor(c, userId, location.pathname, tab))
    const sig = eligible.length > 0 ? `${location.pathname}|${eligible.map((c) => c.key).join(',')}` : null
    if (sig === lastSurfaceSigRef.current) return
    lastSurfaceSigRef.current = sig
    if (!sig) return
    const egg = eligible[Math.floor(Math.random() * eligible.length)]!
    const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
    const debutStorageKey = `easter-egg-debut:${egg.key}:${userId ?? ''}`
    let lastDebutYmd: string | null = null
    try {
      lastDebutYmd = window.localStorage.getItem(debutStorageKey)
    } catch {
      /* private mode — dice only */
    }
    const roll = rollEggAppearance(lastDebutYmd, todayYmd)
    if (roll.isDailyDebut) {
      try {
        window.localStorage.setItem(debutStorageKey, todayYmd)
      } catch {
        /* fine — tomorrow debuts again */
      }
    }
    if (roll.appear) setActiveEggKey(egg.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, configs, userId, reducedMotion])

  const sprite = activeEggKey ? EASTER_EGG_SPRITES[activeEggKey] : null
  if (!sprite) return null
  return <FloatingEasterEggSprite src={sprite.asset} onDone={() => setActiveEggKey(null)} />
}
