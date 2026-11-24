import { useCallback, useEffect, useReducer, useRef, type CSSProperties, type FocusEvent, type PointerEvent } from 'react'
import { AppTopBanner } from './AppTopBanner'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { isBodyScrollLockHeld } from '../../lib/bodyScrollLock'
import { recordJobModeEnabledOncePerSession } from '../../lib/jobModeTelemetry'
import type { JobModeSource } from '../../lib/jobModeToggle'
import {
  MODE_ROW_HANDLE,
  MODE_ROW_PRESS_CONTROL,
  MODE_ROW_PULL_PX,
  MODE_ROW_SENT_CONTROL,
  MODE_ROW_SHOWN_CONTROL,
  MODE_ROW_THIRDS,
  MODE_ROW_WORDS,
  modeRowDraw,
  modeRowLandingPath,
  modeRowPressWrites,
  modeRowPull,
  modeRowThirdOn,
  type ModeRowDraw,
  type ModeRowThird,
} from '../../lib/modeRow'
import {
  MODE_ROW_GONE,
  MODE_ROW_IN_MS,
  MODE_ROW_OUT_MS,
  MODE_ROW_SHOW_MS,
  MODE_ROW_SWIPE_PX,
  modeRowCountDeadline,
  modeRowCountStep,
  modeRowOnScreen,
  modeRowTakesPress,
} from '../../lib/modeRowCount'
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

/** Whether the focus that landed came from a keyboard. A tap that leaves focus on a third is not a hold. */
function focusFromKeyboard(target: Element): boolean {
  try {
    return target.matches(':focus-visible')
  } catch {
    return true
  }
}

/** The count's three lengths, handed to `index.css` so the bar and the slides run on the kernel's own numbers. */
const COUNT_LENGTHS = {
  '--mode-row-show-ms': `${MODE_ROW_SHOW_MS}ms`,
  '--mode-row-in-ms': `${MODE_ROW_IN_MS}ms`,
  '--mode-row-out-ms': `${MODE_ROW_OUT_MS}ms`,
} as CSSProperties

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
 * `modeRow.ts` holds who gets it, where and every word, and `modeRowCount.ts` its five seconds. This
 * component draws it, feeds the count what happened, listens for the pull while the row is out of
 * sight and sends each press through the page mode's one door.
 *
 * On the Dashboard (punch list #433) the page's first line is the row's small handle, an
 * `AppTopBanner`, so on a Home Screen iPhone the handle pays the status bar and paints the band under
 * the clock and the camera. The row is drawn over that line and what follows it, inside a clip that
 * starts where the handle does. So the row starts under the phone's own bar, slides away behind it,
 * and never pushes the page: nothing under it moves when it comes or goes.
 *
 * In Task Mode the row is a line of the page, as it always was, with no count. `Layout` mounts it
 * before every other line.
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
  const draw = modeRowDraw({ role, pathname, mode, phone })
  const counted = draw === 'counted'
  const [count, send] = useReducer(modeRowCountStep, MODE_ROW_GONE)

  // A visit: the page became the Dashboard. The row slides down when it came from another page. It is
  // drawn in place on the app's first paint, and after a switch out of Task Mode, where the row was
  // already in sight. The second effect keeps what was drawn before, and runs after the first reads it.
  const arrivals = useRef(0)
  const drawnBefore = useRef<ModeRowDraw>('none')
  useEffect(() => {
    if (!counted) {
      send({ type: 'hide' })
      return
    }
    const slideIn = arrivals.current > 0 && drawnBefore.current === 'none'
    arrivals.current += 1
    send({ type: 'arrive', now: Date.now(), slideIn })
  }, [counted])
  useEffect(() => {
    drawnBefore.current = draw
  }, [draw])

  // The one clock. The count names the next moment and this rings then. A timer that rings a hair
  // early still counts as on time, or the count would wait for a ring that never comes.
  const deadline = modeRowCountDeadline(count)
  useEffect(() => {
    if (deadline === null) return
    const timer = window.setTimeout(() => send({ type: 'time', now: Math.max(Date.now(), deadline) }), Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(timer)
  }, [deadline])

  // Putting the phone away takes the row off: the next look at the app starts with it out of sight.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') send({ type: 'hide' })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const bringDown = useCallback(
    (how: 'pull' | 'handle') => {
      recordNavClick(userId, role ?? null, MODE_ROW_SHOWN_CONTROL, `#${how}`)
      send({ type: 'arrive', now: Date.now(), slideIn: true })
    },
    [userId, role],
  )

  // The pull: a finger going down at the top of the page, or a wheel turned up there.
  const pullArmed = counted && count.phase === 'gone'
  useEffect(() => {
    if (!pullArmed) return
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
  }, [pullArmed, bringDown])

  // A finger on the row holds the count. One that travels up sends the row away.
  const finger = useRef<{ y: number } | null>(null)
  function onFingerDown(e: PointerEvent<HTMLDivElement>) {
    finger.current = { y: e.clientY }
    send({ type: 'touch', now: Date.now(), hold: 'finger' })
  }
  function onFingerMove(e: PointerEvent<HTMLDivElement>) {
    const from = finger.current
    if (!from || !(from.y - e.clientY >= MODE_ROW_SWIPE_PX)) return
    finger.current = null
    recordNavClick(userId, role ?? null, MODE_ROW_SENT_CONTROL, '#swipe')
    send({ type: 'swipe', now: Date.now() })
  }
  function onFingerUp() {
    if (!finger.current) return
    finger.current = null
    send({ type: 'release', now: Date.now(), hold: 'finger' })
  }
  // A keyboard's focus inside the row holds it too.
  function onRowFocus(e: FocusEvent<HTMLDivElement>) {
    if (focusFromKeyboard(e.target)) send({ type: 'touch', now: Date.now(), hold: 'focus' })
  }
  function onRowBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    send({ type: 'release', now: Date.now(), hold: 'focus' })
  }

  if (draw === 'none') return null

  const on = modeRowThirdOn(mode)

  function press(third: ModeRowThird) {
    if (third === on) return
    // A row on its way out takes no press: the thumb was aimed at something that is leaving.
    if (counted && !modeRowTakesPress(count)) return
    recordNavClick(userId, role ?? null, MODE_ROW_PRESS_CONTROL, `#${third}`)
    if (third === 'job') recordJobModeEnabledOncePerSession(userId, role ?? null, 'row')
    // The row gets a fresh five seconds after a switch: the way back is where the thumb is.
    send({ type: 'press', now: Date.now() })
    for (const write of modeRowPressWrites(third)) setMode(write.key, write.on, 'row')
    const to = modeRowLandingPath(third, pathname)
    if (to) onLand(to)
    try {
      window.scrollTo({ top: 0 })
    } catch {
      /* ignore */
    }
  }

  // The row slides down only while it is arriving or showing, never on its way out.
  const slideIn = (count.phase === 'showing' || count.phase === 'held') && count.slideIn

  if (draw === 'held') {
    return (
      <AppTopBanner padY="0.4rem" padX="0.6rem" data-mode-row="row" style={{ background: 'var(--chrome-bg)' }}>
        <ModeRowThirds on={on} onPress={press} />
      </AppTopBanner>
    )
  }

  return (
    <AppTopBanner padY="0px" padX="0px" data-mode-row="tucked" style={{ background: 'var(--chrome-bg)' }}>
      {/* The clip comes first and names no top, so it starts where the line's own content does: under the status bar the line pays. */}
      {modeRowOnScreen(count) ? (
        <div className="modeRowClip" data-mode-row-phase={count.phase}>
          <div
            className="modeRowOver"
            style={COUNT_LENGTHS}
            {...(slideIn ? { 'data-mode-row-in': '' } : null)}
            onPointerDown={onFingerDown}
            onPointerMove={onFingerMove}
            onPointerUp={onFingerUp}
            onPointerCancel={onFingerUp}
            onPointerLeave={onFingerUp}
            onFocus={onRowFocus}
            onBlur={onRowBlur}
          >
            <ModeRowThirds on={on} onPress={press} />
            {/* The time left: a bar that starts full and runs out. Drawn again for every whole start, so it always starts full. */}
            <div className="modeRowBar" aria-hidden="true" key={`bar-${count.showing}`}>
              <i />
            </div>
            {/* The same for a person who asked their phone for less motion: five blocks that go out one a second. */}
            <div className="modeRowBlocks" aria-hidden="true" key={`blocks-${count.showing}`}>
              <b />
              <b />
              <b />
              <b />
              <b />
            </div>
          </div>
        </div>
      ) : null}
      {MODE_ROW_HANDLE ? (
        <button
          type="button"
          className="modeRowHandle"
          aria-label={MODE_ROW_WORDS.handle}
          title={MODE_ROW_WORDS.handleTip}
          onClick={() => {
            if (count.phase === 'gone') bringDown('handle')
          }}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </AppTopBanner>
  )
}
