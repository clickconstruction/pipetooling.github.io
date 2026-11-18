/**
 * Paint a map on the Dashboard's top row (punch list #392, step 2): a press that is always there,
 * clocked in or not, with a job today or not. Until this press the only door with no job open was
 * the header's search, and a person had to know to type *paint*.
 *
 * It takes the row's three shapes (`paintPressShape`): wide beside the Tally square in Job Mode,
 * with a second line that says where the map will land. A quiet link on the office's phone. A
 * square after Job Report at a desk and on a leader's phone.
 *
 * The job comes from `paintPressLanding`: the job the person is clocked onto, else the stop under
 * way or next today, else the person picks. The wide press reads the day when it is drawn, since
 * its second line says the job. The other two read it on the press, so the Dashboard pays nothing
 * to draw them. A read that is slow or fails opens the sheet with no job set: the press never
 * waits on a weak signal.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSessionChanges } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { nowMinutesInAppTz } from '../../lib/jobMode/onMyWay'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { PAINT_PRESS_WORDS, paintPressHome, paintPressLanding, paintPressLine, type PaintPressShape } from '../../lib/paintedMap/paintedMapPress'
import { PAINT_PRESS_NO_DAY, loadPaintPressDay, type PaintPressDay } from '../../lib/paintedMap/paintedMapPressIo'
import { PAINT_SWATCH } from './paintedMapLook'

/** How long the press waits for the day before it opens the sheet with no job set. */
export const PAINT_PRESS_WAIT_MS = 2500

type Props = {
  userId: string | null | undefined
  role: string | null
  shape: PaintPressShape
  /** For a smoke: the day's read. */
  load?: (userId: string) => Promise<PaintPressDay>
  /** For a smoke: the clock, in ms. */
  now?: () => number
}

const swatch = (width: number): CSSProperties => ({ ...PAINT_SWATCH, width, flex: 'none', display: 'inline-block' })

const wide: CSSProperties = { flex: 1, minWidth: 0, minHeight: 48, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const square: CSSProperties = { flexShrink: 0, width: 72, alignSelf: 'stretch', minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0.15rem 0.2rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.2, textAlign: 'center', cursor: 'pointer', boxSizing: 'border-box' }
const link: CSSProperties = { minHeight: 36, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }

export function PaintAMapPress({ userId, role, shape, load = loadPaintPressDay, now = Date.now }: Props) {
  const eager = shape === 'wide'
  /** The day as last read. `null` until a read lands. */
  const [day, setDay] = useState<PaintPressDay | null>(null)
  /** A press is on its way to the sheet. A ref, since a second press can land before the screen is drawn again. */
  const opening = useRef(false)
  const gen = useRef(0)
  const subscribeSessionChanges = useSessionChanges()

  const read = useCallback(async (): Promise<PaintPressDay> => {
    if (!userId) return PAINT_PRESS_NO_DAY
    const mine = ++gen.current
    try {
      const got = await load(userId)
      if (mine === gen.current) setDay(got)
      return got
    } catch {
      // Nothing known: the sheet opens with no job set, and the person picks.
      return PAINT_PRESS_NO_DAY
    }
  }, [userId, load])

  // The wide press names the job, so it reads the day when drawn and again when the clock changes.
  useEffect(() => {
    if (!eager) return
    void read()
    return subscribeSessionChanges(() => void read())
  }, [eager, read, subscribeSessionChanges])

  const landingOf = (d: PaintPressDay) => paintPressLanding({ clock: d.clock, todayStops: d.todayStops, nowMinutes: nowMinutesInAppTz(now()) })

  const onPress = async () => {
    if (opening.current) return
    recordNavClick(userId, role, 'paint-a-map', `#dashboard-${shape}`)
    let known = eager ? day : null
    if (!known) {
      opening.current = true
      try {
        known = await Promise.race([read(), new Promise<PaintPressDay>((resolve) => window.setTimeout(() => resolve(PAINT_PRESS_NO_DAY), PAINT_PRESS_WAIT_MS))])
      } finally {
        opening.current = false
      }
    }
    startPaintedMap(paintPressHome(landingOf(known)))
  }

  if (!userId) return null

  if (shape === 'link') {
    return (
      <button type="button" data-paint-a-map-press="link" onClick={() => void onPress()} style={link}>
        <span aria-hidden style={swatch(16)} />
        {PAINT_PRESS_WORDS.press}
      </button>
    )
  }

  if (shape === 'square') {
    return (
      <button type="button" data-paint-a-map-press="square" title={PAINT_PRESS_WORDS.press} aria-label={PAINT_PRESS_WORDS.press} onClick={() => void onPress()} style={square}>
        <span aria-hidden style={swatch(20)} />
        <span>
          Paint
          <br />
          a map
        </span>
      </button>
    )
  }

  const line = day ? paintPressLine(landingOf(day)) : PAINT_PRESS_WORDS.reading
  return (
    <button type="button" data-paint-a-map-press="wide" aria-label={PAINT_PRESS_WORDS.aria(day ? line : null)} onClick={() => void onPress()} style={wide}>
      <span aria-hidden style={swatch(20)} />
      <span style={{ minWidth: 0, display: 'grid', gap: 1 }}>
        <b style={{ fontSize: '0.9375rem', lineHeight: 1.2 }}>{PAINT_PRESS_WORDS.press}</b>
        <span data-paint-a-map-press-line style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
      </span>
      <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontWeight: 700, flex: 'none' }}>›</span>
    </button>
  )
}
