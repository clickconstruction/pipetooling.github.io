import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'
import { confirmReloadAsk, currentReloadAsk, endReloadAsk, mountReloadAskHost, subscribeReloadAsk } from '../lib/reloadOverWords'
import { pageTourDeps, startTypedTextTour, type TypedTour } from '../lib/typedTextTour'
import {
  UPDATE_PILL_CONFIRM,
  UPDATE_PILL_TYPED_WORDS,
  UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT,
  updatePillIgnoresPress,
  updatePillSide,
  type UpdatePillSide,
} from '../lib/updatePillWarn'

const TOUCHES = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const

/**
 * The warning a reload press gets when the page holds typed words and the press has no pill of its own: the
 * gear menu's **Hard Reload** and **Reload** on a page that could not load (`reloadOverWords.ts`). Mounted once,
 * beside the update pill, and drawn only while a press is being asked about.
 *
 * It is the update pill's warning (`UpdatePrompt`, v2.8499) as a bar of its own: the same line, the same walk
 * through each place that holds words, **Reload anyway** dead until the walk ends, **Not now**, a touch off
 * the bar forgetting it, and the bar stepping to the top of the screen while a place under its foot is shown.
 *
 * `role="status"`, not a dialog: the page behind must stay free to scroll, since scrolling it is the walk.
 */
export function ReloadOverWordsBar() {
  const ask = useSyncExternalStore(subscribeReloadAsk, currentReloadAsk, () => null)
  const askId = ask?.id ?? null
  const [shown, setShown] = useState(false)
  const [side, setSide] = useState<UpdatePillSide>('bottom')
  const barRef = useRef<HTMLDivElement | null>(null)
  const notNowRef = useRef<HTMLButtonElement | null>(null)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => mountReloadAskHost(), [])

  // Each new ask is walked from its start.
  useEffect(() => {
    if (askId == null) return
    setShown(false)
    setSide('bottom')
    startedAtRef.current = Date.now()
    // The safe press takes the focus: a keyboard's next key lands on the bar, and never on Reload anyway.
    notNowRef.current?.focus({ preventScroll: true })
    let tour: TypedTour | null = startTypedTextTour({
      ...pageTourDeps(),
      onStop: (places) =>
        setSide(
          updatePillSide(
            places.map((place) => place.getBoundingClientRect()),
            window.innerHeight,
          ),
        ),
    })
    const mine = tour
    void mine.done.then((end) => {
      if (tour !== mine) return
      if (end !== 'stopped') setShown(true)
    })
    return () => {
      tour = null
      mine.stop()
    }
  }, [askId])

  /** True for a press or a touch that is the tail of the press that raised the bar. */
  const tooSoon = useCallback(
    () => updatePillIgnoresPress('showing', startedAtRef.current == null ? null : Date.now() - startedAtRef.current),
    [],
  )

  // A touch anywhere off the bar forgets the ask: the person went back to their words.
  useEffect(() => {
    if (askId == null) return
    const touched = (event: Event) => {
      const target = event.target
      if (target instanceof Node && barRef.current?.contains(target)) return
      if (tooSoon()) return
      endReloadAsk()
    }
    for (const ev of TOUCHES) window.addEventListener(ev, touched, { capture: true, passive: true })
    return () => {
      for (const ev of TOUCHES) window.removeEventListener(ev, touched, { capture: true })
    }
  }, [askId, tooSoon])

  if (!ask) return null
  const dead = !shown

  return (
    <div
      ref={barRef}
      role="status"
      style={{
        position: 'fixed',
        ...(side === 'top' ? { top: '1rem' } : { bottom: '1rem' }),
        left: '50%',
        transform: 'translateX(-50%)',
        // Over the update pill, which sits in the same spot.
        zIndex: 9999,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        rowGap: '0.375rem',
        width: 'max-content',
        maxWidth: '92vw',
        padding: '0.625rem 0.75rem 0.625rem 1rem',
        borderRadius: '1rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}
    >
      <span style={{ flex: '1 1 100%', fontSize: '0.875rem', color: 'var(--text-base)' }}>{UPDATE_PILL_TYPED_WORDS}</span>
      <button
        type="button"
        // Dead while the walk shows what was typed. Not `disabled`, so it can still be reached and read.
        aria-disabled={dead || undefined}
        onClick={() => {
          if (dead) return
          confirmReloadAsk()
        }}
        style={{
          minHeight: UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT,
          padding: '0.375rem 1rem',
          borderRadius: '9999px',
          border: 'none',
          background: dead ? DEAD_PRESS_FILL : '#f97316',
          color: dead ? DEAD_PRESS_TEXT : '#ffffff',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: dead ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {UPDATE_PILL_CONFIRM}
      </button>
      <button
        ref={notNowRef}
        type="button"
        onClick={() => {
          if (tooSoon()) return
          endReloadAsk()
        }}
        style={{
          minHeight: UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT,
          padding: '0.375rem 0.5rem',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Not now
      </button>
    </div>
  )
}
