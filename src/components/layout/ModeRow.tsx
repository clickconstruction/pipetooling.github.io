import { useCallback, useEffect, useRef, useState } from 'react'
import { AppTopBanner } from './AppTopBanner'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { isBodyScrollLockHeld } from '../../lib/bodyScrollLock'
import { recordJobModeEnabledOncePerSession } from '../../lib/jobModeTelemetry'
import type { JobModeSource } from '../../lib/jobModeToggle'
import {
  MODE_ROW_HANDLE,
  MODE_ROW_NO_MEMORY,
  MODE_ROW_OPEN_DWELL_MS,
  MODE_ROW_PRESS_CONTROL,
  MODE_ROW_PULL_PX,
  MODE_ROW_SHOWN_CONTROL,
  MODE_ROW_THIRDS,
  MODE_ROW_WORDS,
  modeRowCountOpen,
  modeRowDraw,
  modeRowLandingPath,
  modeRowOnPage,
  modeRowPressWrites,
  modeRowPull,
  modeRowThirdOn,
  readModeRowMemory,
  writeModeRowMemory,
  type ModeRowMemory,
  type ModeRowThird,
} from '../../lib/modeRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { PageMode, PageModeKey } from '../../lib/pageMode'

/** True when the finger started inside something that is itself scrolled, or on a map: that drag is not a pull on the page. */
function touchBelongsElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('canvas, .gm-style, .leaflet-container, [data-no-mode-pull]')) return true
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true
  }
  return false
}

function pageScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0
}

/**
 * The three thirds, the one of the mode drawn filled. `ModeRow` draws them above the header. The window
 * that shows another person's Task Mode draws them too, with no press, so that window looks like the
 * person's own screen.
 */
export function ModeRowThirds({ on, onPress }: { on: ModeRowThird; onPress?: (third: ModeRowThird) => void }) {
  return (
    <div className="modeRow" role="group" aria-label={MODE_ROW_WORDS.group}>
      {MODE_ROW_THIRDS.map((third) => (
        <button key={third} type="button" className="modeRowThird" data-mode-third={third} aria-pressed={third === on} onClick={() => onPress?.(third)}>
          {MODE_ROW_WORDS.thirds[third]}
        </button>
      ))}
    </div>
  )
}

/**
 * The mode row (punch list #425): **Task Mode · Dashboard · Job Mode**, the first line above the header.
 * `modeRow.ts` holds who gets it, where, when it shows and every word. This component draws it, counts
 * the page's opens, listens for the pull while it is tucked and sends each press through the page
 * mode's one door.
 *
 * It is an `AppTopBanner`, so on a Home Screen iPhone the row, or its handle, pays the status bar and
 * the header under it pays none. `Layout` mounts it before every other line.
 */
export function ModeRow({
  userId,
  role,
  pathname,
  mode,
  setMode,
  onLand,
}: {
  userId: string | null | undefined
  role: string | null | undefined
  pathname: string
  /** The one mode the page is drawn in (`usePageMode`). */
  mode: PageMode
  /** The page mode's door. The row passes `row` as the door that turned Job Mode on. */
  setMode: (key: PageModeKey, on: boolean, source?: Exclude<JobModeSource, 'default'>) => void
  /** Go to a page: a press on the checklist that leaves Task Mode lands on the Dashboard. */
  onLand: (path: string) => void
}) {
  const phone = useNarrowViewport640()
  // The memory this page load holds for the person. Until the open is counted it is read straight
  // from the phone with this open added, so the first draw already knows whether to tuck.
  const [held, setHeld] = useState<{ userId: string; memory: ModeRowMemory } | null>(null)
  const memory: ModeRowMemory = !userId ? MODE_ROW_NO_MEMORY : held?.userId === userId ? held.memory : modeRowCountOpen(readModeRowMemory(userId))
  const [shownNow, setShownNow] = useState(false)
  /** Slide in only when a pull or the handle brought the row down, never on the page's first draw. */
  const [slideIn, setSlideIn] = useState(false)

  const draw = modeRowDraw({ role, pathname, mode, phone, memory, shownNow })
  const counts = !!userId && phone && draw !== 'none' && held?.userId !== userId

  // Count this open once per page load, once the row has stayed on the page on a phone for a moment:
  // a page that is sent on at once (the office's phone lands on the schedule) was not a look at the row.
  // The ref holds whose open was counted, so an effect that runs twice (React's strict mode) counts once.
  const countedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!counts || !userId || countedFor.current === userId) return
    const timer = window.setTimeout(() => {
      if (countedFor.current === userId) return
      countedFor.current = userId
      const next = modeRowCountOpen(readModeRowMemory(userId))
      writeModeRowMemory(userId, next)
      setHeld({ userId, memory: next })
    }, MODE_ROW_OPEN_DWELL_MS)
    return () => window.clearTimeout(timer)
  }, [counts, userId])

  // Leaving the row's pages tucks it again. The checklist counts as one of them in any mode, so the
  // moment between a press there and the landing on the Dashboard does not tuck the row.
  const onRowPath = modeRowOnPage(pathname, 'task')
  useEffect(() => {
    if (onRowPath) return
    setShownNow(false)
    setSlideIn(false)
  }, [onRowPath])

  // So does putting the phone away: the next look at the app starts with the row out of sight.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'hidden') return
      setShownNow(false)
      setSlideIn(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const bringDown = useCallback(
    (how: 'pull' | 'handle') => {
      recordNavClick(userId, role ?? null, MODE_ROW_SHOWN_CONTROL, `#${how}`)
      setSlideIn(true)
      setShownNow(true)
    },
    [userId, role],
  )

  // The pull: a finger going down at the top of the page, or a wheel turned up there.
  useEffect(() => {
    if (draw !== 'tucked') return
    let start: { x: number; y: number } | null = null
    let wheel = 0
    let wheelAt = 0
    function onStart(e: TouchEvent) {
      start = null
      const t = e.touches[0]
      if (!t || e.touches.length !== 1 || pageScrollTop() > 0 || isBodyScrollLockHeld() || touchBelongsElsewhere(e.target)) return
      start = { x: t.clientX, y: t.clientY }
    }
    function onMove(e: TouchEvent) {
      const t = e.touches[0]
      if (!start || !t) return
      const read = modeRowPull({ startX: start.x, startY: start.y, x: t.clientX, y: t.clientY, scrollTop: pageScrollTop() })
      if (read === 'wait') return
      start = null
      if (read === 'pull') bringDown('pull')
    }
    function onEnd() {
      start = null
    }
    function onWheel(e: WheelEvent) {
      if (e.deltaY >= 0 || pageScrollTop() > 0 || isBodyScrollLockHeld() || touchBelongsElsewhere(e.target)) {
        wheel = 0
        return
      }
      if (e.timeStamp - wheelAt > 400) wheel = 0
      wheelAt = e.timeStamp
      wheel -= e.deltaY
      if (wheel < MODE_ROW_PULL_PX * 2) return
      wheel = 0
      bringDown('pull')
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
      window.removeEventListener('wheel', onWheel)
    }
  }, [draw, bringDown])

  if (draw === 'none') return null

  if (draw === 'tucked') {
    if (!MODE_ROW_HANDLE) return null
    return (
      <AppTopBanner padY="0px" padX="0px" data-mode-row="tucked" style={{ background: 'var(--chrome-bg)' }}>
        <button type="button" className="modeRowHandle" aria-label={MODE_ROW_WORDS.handle} title={MODE_ROW_WORDS.handleTip} onClick={() => bringDown('handle')}>
          <span aria-hidden="true" />
        </button>
      </AppTopBanner>
    )
  }

  const on = modeRowThirdOn(mode)

  function press(third: ModeRowThird) {
    if (third === on) return
    recordNavClick(userId, role ?? null, MODE_ROW_PRESS_CONTROL, `#${third}`)
    if (third === 'job') recordJobModeEnabledOncePerSession(userId, role ?? null, 'row')
    if (userId) {
      const next = { ...memory, pressed: true }
      writeModeRowMemory(userId, next)
      setHeld({ userId, memory: next })
    }
    // The row stays in sight after a switch: the way back is where the thumb is.
    setSlideIn(false)
    setShownNow(true)
    for (const write of modeRowPressWrites(third)) setMode(write.key, write.on, 'row')
    const to = modeRowLandingPath(third, pathname)
    if (to) onLand(to)
    try {
      window.scrollTo({ top: 0 })
    } catch {
      /* ignore */
    }
  }

  return (
    <AppTopBanner
      padY="0.4rem"
      padX="0.6rem"
      data-mode-row="row"
      {...(slideIn ? { 'data-mode-row-in': '' } : null)}
      style={{ background: 'var(--chrome-bg)' }}
    >
      <ModeRowThirds on={on} onPress={press} />
    </AppTopBanner>
  )
}
