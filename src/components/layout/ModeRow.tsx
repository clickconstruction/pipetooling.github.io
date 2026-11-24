import { useEffect, useLayoutEffect, useReducer, useRef, type CSSProperties, type FocusEvent, type PointerEvent } from 'react'
import { AppTopBanner } from './AppTopBanner'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { recordJobModeEnabledOncePerSession } from '../../lib/jobModeTelemetry'
import type { JobModeSource } from '../../lib/jobModeToggle'
import {
  MODE_ROW_HOME_ATTR,
  MODE_ROW_PRESS_CONTROL,
  MODE_ROW_SENT_CONTROL,
  MODE_ROW_THIRDS,
  MODE_ROW_WORDS,
  modeRowDraw,
  modeRowLandingPath,
  modeRowPressWrites,
  modeRowThirdOn,
  type ModeRowThird,
} from '../../lib/modeRow'
import {
  MODE_ROW_DEAD_MS,
  MODE_ROW_GONE,
  MODE_ROW_IN_MS,
  MODE_ROW_OUT_MS,
  MODE_ROW_SHOW_MS,
  MODE_ROW_SWIPE_PX,
  modeRowBackIsVisit,
  modeRowCountDeadline,
  modeRowCountStep,
  modeRowFlight,
  modeRowOnScreen,
  modeRowTakesPress,
} from '../../lib/modeRowCount'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { PageMode, PageModeKey } from '../../lib/pageMode'

/** Whether the focus that landed came from a keyboard. A tap that leaves focus on a third is not a hold. */
function focusFromKeyboard(target: Element): boolean {
  try {
    return target.matches(':focus-visible')
  } catch {
    return true
  }
}

/** The count's three lengths, handed to `index.css` so the bar, the slide and the way out run on the kernel's own numbers. */
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

/** The row as a small picture, three thirds with the middle one lit: the icon of its switch in the gear menu. */
export function ThreeThirdsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="8" width="19" height="8" rx="2.5" />
      <rect x="9" y="8" width="6" height="8" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Whether this person asked their phone for less motion. */
function lessMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The gear answers as the row lands on it: it swells once inside a ring, so the eye is left on the
 * press that holds the modes from now on. With less motion asked for, the ring alone.
 */
function gearAnswers(gear: Element): void {
  if (typeof gear.animate !== 'function') return
  const ring = ['0 0 0 0 rgba(37, 99, 235, 0)', '0 0 0 3px rgba(37, 99, 235, 0.75)', '0 0 0 0 rgba(37, 99, 235, 0)']
  const swell = lessMotion() ? ['none', 'none', 'none'] : ['scale(1)', 'scale(1.3)', 'scale(1)']
  try {
    gear.animate(
      ring.map((boxShadow, i) => ({ boxShadow, transform: swell[i], borderRadius: '8px' })),
      { duration: MODE_ROW_DEAD_MS + 80, delay: Math.max(0, MODE_ROW_OUT_MS - 80), easing: 'ease-out' },
    )
  } catch {
    /* an old browser: the row still shrinks to the gear */
  }
}

/**
 * The mode row (punch list #425): **Task Mode · Dashboard · Job Mode**. `modeRow.ts` holds who gets it,
 * where and every word, and `modeRowCount.ts` its five seconds. This component draws it, feeds the
 * count what happened and sends each press through the page mode's one door.
 *
 * On the Dashboard (punch list #433) the row is the first thing a person sees when the app opens. It
 * lies over the top of the page, under the phone's own bar, and takes no room: its host is a line of
 * no height that is not an `AppTopBanner`, so the header under it pays the status bar as it does on
 * every page and nothing moves when the row comes or goes. When the five seconds run out, or a third
 * is pressed, the row shrinks into the header's gear and the gear answers. The gear menu lists the
 * same three modes, so that is where they are changed from then on. Nothing is left in the row's
 * place: no handle and no pull.
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
  atOpen = true,
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
  /** The phone's switch, **Modes at open** (`useModeRowAtOpen`). Unticked, the Dashboard opens with no row. */
  atOpen?: boolean
}) {
  const phone = useNarrowViewport640()
  const draw = modeRowDraw({ role, pathname, mode, phone, atOpen })
  const counted = draw === 'counted'
  const [count, send] = useReducer(modeRowCountStep, MODE_ROW_GONE)

  // The opening: the row's first draw after the app loads. It is drawn in place, with no slide. A row
  // Task Mode holds counts as that first draw, so leaving Task Mode later opens nothing. A phone whose
  // switch is unticked has had no opening, so ticking it shows the row there and then.
  const opened = useRef(false)
  useEffect(() => {
    if (!atOpen) opened.current = false
  }, [atOpen])
  useEffect(() => {
    if (!counted) {
      send({ type: 'hide' })
      return
    }
    if (opened.current) return
    opened.current = true
    send({ type: 'arrive', now: Date.now(), slideIn: false })
  }, [counted])
  useEffect(() => {
    if (draw !== 'none') opened.current = true
  }, [draw])

  // The one clock. The count names the next moment and this rings then. A timer that rings a hair
  // early still counts as on time, or the count would wait for a ring that never comes.
  const deadline = modeRowCountDeadline(count)
  useEffect(() => {
    if (deadline === null) return
    const timer = window.setTimeout(() => send({ type: 'time', now: Math.max(Date.now(), deadline) }), Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(timer)
  }, [deadline])

  // Putting the phone away takes the row off. Coming back after a minute or more is an opening, and the
  // row comes with it. Back sooner, a glance at a text, the app is as it was left: no row.
  const hiddenAt = useRef<number | null>(null)
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        send({ type: 'hide' })
        return
      }
      const away = hiddenAt.current
      hiddenAt.current = null
      if (counted && modeRowBackIsVisit(away, Date.now())) send({ type: 'arrive', now: Date.now(), slideIn: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [counted])

  // The way out: the row shrinks into the header's gear, and the gear answers. Where it is and how
  // big is read as the row leaves, before the first frame. With no gear on the screen the row slides up.
  const over = useRef<HTMLDivElement | null>(null)
  const leaving = counted && count.phase === 'leaving'
  useLayoutEffect(() => {
    const row = over.current
    if (!leaving || !row) return
    const gear = document.querySelector(`[${MODE_ROW_HOME_ATTR}]`)
    const flight = modeRowFlight(row.getBoundingClientRect(), gear ? gear.getBoundingClientRect() : null)
    if (!flight || !gear) {
      row.setAttribute('data-mode-row-out', 'up')
      return
    }
    row.setAttribute('data-mode-row-out', 'gear')
    row.style.setProperty('--mode-row-to-x', `${flight.x}px`)
    row.style.setProperty('--mode-row-to-y', `${flight.y}px`)
    row.style.setProperty('--mode-row-to-sx', String(flight.sx))
    row.style.setProperty('--mode-row-to-sy', String(flight.sy))
    gearAnswers(gear)
  }, [leaving])

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
    // The row Task Mode holds stays: a press on its lit third asks for nothing.
    if (!counted && third === on) return
    // A row on its way out takes no press: the thumb was aimed at something that is leaving.
    if (counted && !modeRowTakesPress(count)) return
    // The choice is made, the lit third's too: the row closes into the gear, where the modes are from now on.
    send({ type: 'press', now: Date.now() })
    if (third === on) {
      recordNavClick(userId, role ?? null, MODE_ROW_SENT_CONTROL, '#lit')
      return
    }
    recordNavClick(userId, role ?? null, MODE_ROW_PRESS_CONTROL, `#${third}`)
    if (third === 'job') recordJobModeEnabledOncePerSession(userId, role ?? null, 'row')
    for (const write of modeRowPressWrites(third)) setMode(write.key, write.on, 'row')
    const to = modeRowLandingPath(third, pathname)
    if (to) onLand(to)
    try {
      window.scrollTo({ top: 0 })
    } catch {
      /* ignore */
    }
  }

  if (draw === 'held') {
    return (
      <AppTopBanner padY="0.4rem" padX="0.6rem" data-mode-row="row" style={{ background: 'var(--chrome-bg)' }}>
        <ModeRowThirds on={on} onPress={press} />
      </AppTopBanner>
    )
  }

  if (!modeRowOnScreen(count)) return null

  // The row slides down only when coming back to the app brought it, never on its way out.
  const slideIn = (count.phase === 'showing' || count.phase === 'held') && count.slideIn

  return (
    // A line of no height, and no `AppTopBanner`: the header under it keeps paying the status bar, so nothing moves.
    <div className="modeRowHost" data-mode-row="over">
      <div className="modeRowClip" data-mode-row-phase={count.phase}>
        <div
          ref={over}
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
    </div>
  )
}
