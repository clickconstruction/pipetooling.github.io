import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { APP_SETTINGS_KEY_EASTER_EGGS } from '../lib/appSettingsKeys'
import {
  EASTER_EGG_SPRITES,
  defaultEasterEggConfig,
  eggActiveFor,
  fleeScaleAtMinute,
  parseEasterEggsSetting,
  rollEggAppearance,
  type EasterEggCatch,
  type EasterEggConfig,
  type EasterEggTuning,
} from '../lib/easterEggsConfig'
import { calendarYmdInAppTzFromIso, startOfYmdInAppTzMs, todayYmdInAppTz } from '../utils/dateUtils'
import { EGG_MOTION, createEggState, eggOpacity, eggTransform, stepEgg, type EggState } from '../lib/easterEggMotion'
import {
  RING,
  aimArc,
  flightFacing,
  flightGone,
  launchFromPull,
  placeRing,
  startFlight,
  stepFlight,
  type Flight,
  type RingPos,
} from '../lib/easterEggRing'
import { loadSpriteMask, makeTouching, type SpriteMask } from '../lib/easterEggSilhouette'

/** Settings → Easter eggs "Preview here now" fires this to skip the dice. */
export const EASTER_EGG_PREVIEW_EVENT = 'pipetooling:easter-egg-preview'

type Mode = 'kernel' | 'caught' | 'aim' | 'flight' | 'return'

/** How long a swish lingers before the visit ends. */
const SWISH_MS = 1200

/**
 * The visit (v2.2074) plus the ring game (v2.3282): one requestAnimationFrame
 * loop drives the pure kernels (`easterEggMotion.ts` for the wander/flee visit,
 * `easterEggRing.ts` for catch → ring → slingshot → flight) and writes styles
 * through refs — zero React re-renders per frame. The sprite takes pointer
 * events only while he is catchable, so he never blocks a click. Never mounted
 * under prefers-reduced-motion (the host gates).
 */
export function FloatingEasterEggVisit({ src, tuning, catchCfg, onDone }: { src: string; tuning: EasterEggTuning; catchCfg: EasterEggCatch; onDone: () => void }) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const ringRef = useRef<SVGSVGElement | null>(null)
  const ringInnerRef = useRef<SVGGElement | null>(null)
  const bandRef = useRef<SVGLineElement | null>(null)
  const dotsRef = useRef<SVGGElement | null>(null)
  const captionRef = useRef<HTMLDivElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const cfgRef = useRef({ tuning, catchCfg })
  cfgRef.current = { tuning, catchCfg }

  useEffect(() => {
    const img = imgRef.current
    const ring = ringRef.current
    const band = bandRef.current
    const dots = dotsRef.current
    const caption = captionRef.current
    if (!img || !ring || !band || !dots || !caption) return

    const W = EGG_MOTION.SPRITE_W
    const H = EGG_MOTION.SPRITE_H
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 3 }
    let egg: EggState = createEggState(window.innerWidth, window.innerHeight, performance.now())
    let mode: Mode = 'kernel'
    let playMsLeft = cfgRef.current.tuning.playSec * 1000
    let caughtAt = 0
    let shotsLeft = 0
    let anchor: { x: number; y: number } | null = null
    let drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null
    let pointerId: number | null = null
    let fly: Flight | null = null
    let ringPos: RingPos | null = null
    let swishAt = 0
    let mask: SpriteMask | null = null
    let captionTimer = 0
    let disposed = false
    let last = performance.now()
    let raf = 0

    void loadSpriteMask(src, W, H).then((m) => {
      if (!disposed) mask = m
    })
    const swishScale = (f: Flight) => (f.scored ? Math.max(0.55, 1 - ((performance.now() - swishAt) / 1400) * 0.45) : 1)
    const touching = (px: number, py: number, f: Flight) => makeTouching(mask, W, H, flightFacing, swishScale)(px, py, f)

    const center = () => ({ x: egg.x + W / 2, y: egg.y + H / 2 })
    const say = (text: string) => {
      caption.textContent = text
      caption.style.opacity = '1'
      window.clearTimeout(captionTimer)
      captionTimer = window.setTimeout(() => {
        caption.style.opacity = '0'
      }, 1600)
    }
    const showRing = () => {
      const c = center()
      ringPos = placeRing(c, window.innerWidth, window.innerHeight, cfgRef.current.catchCfg.ringScale)
      ring.setAttribute('width', String(ringPos.w))
      ring.setAttribute('height', String(ringPos.h))
      ring.style.left = `${ringPos.x}px`
      ring.style.top = `${ringPos.y}px`
      ring.classList.remove('easter-egg-ring-swish', 'easter-egg-ring-clank')
      ring.style.opacity = '1'
    }
    const hideRing = () => {
      ring.style.opacity = '0'
    }
    const clearAim = () => {
      band.setAttribute('opacity', '0')
      dots.innerHTML = ''
    }
    const clank = () => {
      ring.classList.remove('easter-egg-ring-clank')
      void ring.getBoundingClientRect()
      ring.classList.add('easter-egg-ring-clank')
    }
    const finish = () => {
      mode = 'kernel'
      hideRing()
      clearAim()
      img.style.opacity = '0'
      img.style.pointerEvents = 'none'
      onDoneRef.current()
    }
    const paintKernel = (now: number) => {
      img.style.transform = eggTransform(egg, now)
      img.style.opacity = String(eggOpacity(egg, now))
      img.style.pointerEvents = egg.phase === 'play' && cfgRef.current.catchCfg.enabled ? 'auto' : 'none'
    }
    const paintAim = () => {
      if (!anchor || !drag) return
      const { power, gravity, aimPreviewSec } = cfgRef.current.catchCfg
      const l = launchFromPull(anchor, drag, power)
      egg = { ...egg, x: l.startX - W / 2, y: l.startY - H / 2 }
      band.setAttribute('x1', String(anchor.x))
      band.setAttribute('y1', String(anchor.y))
      band.setAttribute('x2', String(l.startX))
      band.setAttribute('y2', String(l.startY))
      band.setAttribute('opacity', l.pull > 6 ? '0.8' : '0')
      dots.innerHTML = aimArc(l, gravity, aimPreviewSec, window.innerHeight)
        .map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${d.r.toFixed(1)}" opacity="${d.opacity.toFixed(2)}"/>`)
        .join('')
      const ang = l.pull > 12 ? ((Math.atan2(l.vy, l.vx) * 180) / Math.PI) * 0.35 : 0
      const sq = 1 - (l.pull / RING.PULL_MAX) * 0.12
      img.style.transform = `translate3d(${egg.x}px, ${egg.y}px, 0) rotate(${ang}deg) scaleX(${egg.facing}) scale(${sq.toFixed(3)}, ${(2 - sq).toFixed(3)})`
      img.style.opacity = '1'
    }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      if (drag && e.pointerId === pointerId) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true
        drag.x = e.clientX
        drag.y = e.clientY
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!(mode === 'kernel' && egg.phase === 'play') && mode !== 'caught') return
      if (!cfgRef.current.catchCfg.enabled) return
      e.preventDefault()
      try {
        img.setPointerCapture(e.pointerId)
      } catch {
        /* synthetic events have no capture */
      }
      pointerId = e.pointerId
      if (mode === 'kernel') {
        playMsLeft = Math.max(0, cfgRef.current.tuning.playSec * 1000 - (performance.now() - egg.phaseStartMs))
        shotsLeft = cfgRef.current.catchCfg.shots
        caughtAt = performance.now()
        egg = { ...egg, vx: 0, vy: 0 }
        showRing()
        say('Caught him! A ring appeared — pull him back and let go.')
      }
      const c = center()
      anchor = { x: c.x, y: c.y }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }
      mode = 'aim'
      img.style.cursor = 'grabbing'
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== pointerId || !anchor) return
      img.style.cursor = 'grab'
      const l = launchFromPull(anchor, drag, cfgRef.current.catchCfg.power)
      const moved = drag.moved
      drag = null
      pointerId = null
      if (mode !== 'aim') return
      if (!moved || l.pull < 14) {
        mode = 'caught'
        caughtAt = performance.now()
        clearAim()
        return
      }
      clearAim()
      fly = startFlight(l)
      shotsLeft -= 1
      mode = 'flight'
      img.style.pointerEvents = 'none'
    }

    const tick = (now: number) => {
      if (disposed) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { tuning: tun, catchCfg: cc } = cfgRef.current
      if (mode === 'kernel' || mode === 'return') {
        const playMs = mode === 'return' ? Math.max(4000, tun.playSec * 1000) : playMsLeft
        const before = egg.phase
        egg = stepEgg(egg, { mouseX: mouse.x, mouseY: mouse.y, viewportW: window.innerWidth, viewportH: window.innerHeight, dtSec: dt, nowMs: now, playMs, fleeScale: tun.fleeScale })
        if (mode === 'return' && egg.phase === 'play') {
          mode = 'kernel'
          playMsLeft = Math.max(4000, tun.playSec * 1000)
        } else if (before === 'enter' && egg.phase === 'play') {
          playMsLeft = tun.playSec * 1000
        } else if (before === 'play' && egg.phase === 'leave') {
          hideRing()
        }
        if (egg.phase === 'done') {
          finish()
          return
        }
        paintKernel(now)
      } else if (mode === 'caught') {
        img.style.pointerEvents = 'auto'
        const breathe = 1 + Math.sin(now / 320) * 0.025
        img.style.transform = `translate3d(${egg.x}px, ${egg.y}px, 0) scaleX(${egg.facing}) scale(${breathe.toFixed(3)})`
        img.style.opacity = '1'
        if (now - caughtAt > cc.holdSec * 1000) {
          // He wriggles free: back to a short play, ring gone.
          mode = 'kernel'
          egg = { ...egg, phase: 'play', phaseStartMs: now }
          playMsLeft = 3500
          hideRing()
          say('He wriggled free.')
        }
      } else if (mode === 'aim') {
        paintAim()
      } else if (mode === 'flight' && fly) {
        const { flight, event } = stepFlight(fly, { dtSec: dt, gravity: cc.gravity, ring: ringPos, touching })
        fly = flight
        if (event.clank) clank()
        if (event.scored) {
          swishAt = now
          ring.classList.add('easter-egg-ring-swish')
          say('Swish. Floaty says thanks.')
        }
        egg = { ...egg, x: fly.x - W / 2, y: fly.y - H / 2 }
        const scale = swishScale(fly)
        const op = fly.scored ? Math.max(0, 1 - (now - swishAt) / 1100) : 1
        img.style.transform = `translate3d(${egg.x}px, ${egg.y}px, 0) rotate(${fly.spin.toFixed(1)}deg) scaleX(${flightFacing(fly)}) scale(${scale.toFixed(3)})`
        img.style.opacity = String(op)
        if (fly.scored && now - swishAt > SWISH_MS) {
          finish()
          return
        }
        if (!fly.scored && flightGone(fly, window.innerWidth, window.innerHeight)) {
          if (shotsLeft > 0) {
            say(`Missed — he's coming back for another. ${shotsLeft} left.`)
            egg = createEggState(window.innerWidth, window.innerHeight, now)
            mode = 'return'
          } else {
            say('Out of shots. Floaty floats off.')
            finish()
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    img.addEventListener('pointerdown', onPointerDown)
    raf = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearTimeout(captionTimer)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      img.removeEventListener('pointerdown', onPointerDown)
    }
  }, [src])

  return (
    <>
      <style>{`
        @media print { .easter-egg-layer { display: none !important; } }
        .easter-egg-ring { transition: opacity .45s ease; }
        .easter-egg-ring .easter-egg-ring-body { transform-origin: 50% 50%; transform-box: fill-box; }
        .easter-egg-ring-swish .easter-egg-ring-body { animation: easterEggRingSwish .8s ease-out; }
        .easter-egg-ring-swish ellipse { stroke: #1f9d55; transition: stroke .2s; }
        .easter-egg-ring-clank { animation: easterEggRingClank .35s ease-out; }
        @keyframes easterEggRingSwish { 0% { transform: scale(1) } 35% { transform: scale(1.16) } 70% { transform: scale(0.96) } 100% { transform: scale(1) } }
        @keyframes easterEggRingClank { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-3px,0) } 60% { transform: translate(2px,0) } }
      `}</style>
      <svg className="easter-egg-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8999, overflow: 'visible' }}>
        <line ref={bandRef} x1={0} y1={0} x2={0} y2={0} stroke="#c25f1c" strokeWidth={3} strokeLinecap="round" opacity={0} />
        <g ref={dotsRef} fill="#2f6fe4" />
      </svg>
      <svg
        ref={ringRef}
        className="easter-egg-layer easter-egg-ring"
        aria-hidden="true"
        viewBox={`0 0 ${RING.W} ${RING.H}`}
        width={RING.W}
        height={RING.H}
        style={{ position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: 8999, overflow: 'visible', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))' }}
      >
        <g ref={ringInnerRef} className="easter-egg-ring-body">
          <ellipse cx={100} cy={36} rx={82} ry={16} fill="none" stroke="#e8792f" strokeWidth={3} opacity={0.35} />
          <ellipse cx={100} cy={36} rx={80} ry={14} fill="none" stroke="#e8792f" strokeWidth={7} />
          <path d="M22 36 A78 12 0 0 1 178 36" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
        </g>
      </svg>
      <img
        ref={imgRef}
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="easter-egg-layer easter-egg-sprite"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: EGG_MOTION.SPRITE_W,
          pointerEvents: 'none',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserDrag: 'none',
          zIndex: 9000,
          willChange: 'transform',
          opacity: 0,
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))',
        } as React.CSSProperties}
      />
      <div
        ref={captionRef}
        className="easter-egg-layer"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '50%',
          top: 58,
          transform: 'translateX(-50%)',
          zIndex: 9001,
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '8px 14px',
          fontSize: '0.8125rem',
          opacity: 0,
          transition: 'opacity .25s',
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 32px)',
        }}
      />
    </>
  )
}

/**
 * Mounted once in the Layout: loads the dev-managed `easter_eggs_v1` config,
 * and on each targeted-surface open rolls the per-egg 1-in-N for a visit. The
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

  // Preview event from Settings — skip dice and surface targeting. The event may
  // carry the card's unsaved tuning so a dev can feel a slider before it saves.
  useEffect(() => {
    const onPreview = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string; config?: EasterEggConfig }>).detail
      const key = detail?.key
      if (!key || !(key in EASTER_EGG_SPRITES) || reducedMotion) return
      if (detail?.config) setConfigs((prev) => [...prev.filter((c) => c.key !== key), detail.config!])
      setActiveEggKey(key)
    }
    window.addEventListener(EASTER_EGG_PREVIEW_EVENT, onPreview)
    return () => window.removeEventListener(EASTER_EGG_PREVIEW_EVENT, onPreview)
  }, [reducedMotion])

  // One appearance decision per surface OPEN (entering a targeted surface),
  // not per render: the first open of each company day is a guaranteed visit
  // (v2.2077), every later open rolls the egg's 1-in-N dice.
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
    const roll = rollEggAppearance(lastDebutYmd, todayYmd, Math.random, 1 / egg.tuning.oddsOneIn)
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
  if (!sprite || !activeEggKey) return null
  const cfg = configs.find((c) => c.key === activeEggKey) ?? defaultEasterEggConfig(activeEggKey)
  // He gets faster through the company day (v2.3282): fix this visit's flee speed at mount.
  const now = new Date()
  const minutesIntoDay = (now.getTime() - startOfYmdInAppTzMs(todayYmdInAppTz(now))) / 60000
  const tuning = { ...cfg.tuning, fleeScale: fleeScaleAtMinute(cfg.tuning, minutesIntoDay) }
  return <FloatingEasterEggVisit src={sprite.asset} tuning={tuning} catchCfg={cfg.catch} onDone={() => setActiveEggKey(null)} />
}
