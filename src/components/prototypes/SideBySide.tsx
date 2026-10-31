import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useOptionalAuth } from '../../hooks/useAuth'

/**
 * Prototypes beside today's look (punch list #217, *Show it, don't say it*). The owner asked to
 * see every prototype live, side by side with what the card draws today. Each prototype sits
 * behind a per-person switch on its card, remembered in localStorage and off by default, so the
 * card reads as today until a person turns it on. With `?sbs=1` on the page and a dev signed
 * in, the card draws both shapes one above the other, **Today** and the prototype's own label,
 * on the same live rows. `useShapeView(key)` is the switch and the page flag; `SideBySide` the
 * two blocks with their captions; `ShapeSwitch` the press on the card.
 */

export type ShapeView = {
  /** The person turned the new shape on for this card; off by default. */
  on: boolean
  setOn: (on: boolean) => void
  /** `?sbs=1` on the page and the signed-in person is a dev: draw today's shape and the new one together. */
  sideBySide: boolean
}

export const SIDE_BY_SIDE_PARAM = 'sbs'

/** The localStorage key for one card's switch, per person: `pt-shape-view:<key>:<userId>`. */
export function shapeViewStorageKey(key: string, userId: string | null | undefined): string {
  return `pt-shape-view:${key}:${userId ?? 'anon'}`
}

export function readShapeView(key: string, userId: string | null | undefined): boolean {
  try {
    return window.localStorage.getItem(shapeViewStorageKey(key, userId)) === '1'
  } catch {
    return false
  }
}

export function writeShapeView(key: string, userId: string | null | undefined, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(shapeViewStorageKey(key, userId), '1')
    else window.localStorage.removeItem(shapeViewStorageKey(key, userId))
  } catch {
    /* a private window or blocked storage: the switch holds for this visit only */
  }
}

/** Whether the page asks for both shapes: `?sbs=1` in the search string. The dev gate is the hook's. */
export function sideBySideRequested(search: string): boolean {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(SIDE_BY_SIDE_PARAM) === '1'
}

export function useShapeView(key: string): ShapeView {
  const auth = useOptionalAuth()
  const userId = auth?.user?.id ?? null
  const role = auth?.role ?? null
  const location = useLocation()
  const [on, setOnState] = useState<boolean>(() => readShapeView(key, userId))
  // The person signs in after the first render: read their own switch.
  useEffect(() => {
    setOnState(readShapeView(key, userId))
  }, [key, userId])
  const setOn = useCallback(
    (next: boolean) => {
      writeShapeView(key, userId, next)
      setOnState(next)
    },
    [key, userId],
  )
  const sideBySide = role === 'dev' && sideBySideRequested(location.search)
  return { on, setOn, sideBySide }
}

const CAPTION: CSSProperties = {
  margin: '0 0 0.3rem',
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

/** Today's shape above the prototype, each under its caption: **Today**, then `label` (*With the columns*). */
export function SideBySide({ today, shape, label, testId }: { today: ReactNode; shape: ReactNode; label: string; testId?: string }) {
  return (
    <div data-testid={testId ?? 'side-by-side'} data-side-by-side style={{ display: 'grid', gap: '0.25rem', marginBottom: '1rem' }}>
      <div data-side-by-side-today>
        <p style={CAPTION}>Today</p>
        {today}
      </div>
      <div data-side-by-side-shape>
        <p style={CAPTION}>{label}</p>
        {shape}
      </div>
    </div>
  )
}

/**
 * The per-person switch on a card: *Show the columns* while off, *Show today's look* while on.
 * Hidden when the page draws both shapes, since there is nothing to switch.
 */
export function ShapeSwitch({ view, words, style }: { view: ShapeView; words: { on: string; off: string }; style?: CSSProperties }) {
  if (view.sideBySide) return null
  return (
    <button
      type="button"
      data-shape-switch
      aria-pressed={view.on}
      onClick={() => view.setOn(!view.on)}
      style={{ padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-muted)', font: 'inherit', fontSize: '0.6875rem', lineHeight: 1.7, cursor: 'pointer', whiteSpace: 'nowrap', ...style }}
    >
      {view.on ? words.on : words.off}
    </button>
  )
}
