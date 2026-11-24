/**
 * The walk through what a person typed, before the update pill reloads over it (punch list #85, Diane,
 * 2026-11-24): *when a user hits the reload button, it should take the user to the areas where the words are
 * typed on the screen before the user hits confirm. These areas show up highlighted for a second, and if
 * there are several, it takes the user between them on their page.*
 *
 * A stop is one screenful. The walk brings the first place not yet shown to the middle of the screen, rings
 * it and every other typed place that can be seen with it, holds the ring a second, and goes on to the next
 * place not yet shown. So a form with six short fields is one stop, and a note at the top of a long page and
 * a message at its foot are two.
 *
 * The ring is an attribute, `data-typed-words-shown`, drawn by one rule in `index.css`. Nothing here changes
 * a field's words, its focus or its own style.
 *
 * The walk always takes at least one stop's time, even with nothing it can show (a field in a folded
 * section, a page it cannot read). The pill's **Reload anyway** is dead until the walk ends, so that floor is
 * also what stops a double press on **Reload** from being the confirm.
 */
import { typedTextFields } from './typedText'

/** How long a place stays ringed. */
export const TYPED_TOUR_SHOWN_MS = 1_000
/** The wait after the page is moved, for a smooth scroll to land, before the ring is drawn. */
export const TYPED_TOUR_SETTLE_MS = 450
/** The attribute the ring's CSS rule reads. */
export const TYPED_SHOWN_ATTR = 'data-typed-words-shown'

export type TypedTourDeps = {
  /** The places that hold typed words, top of the page first. */
  fields: () => Element[]
  /** Can this place be brought to the screen at all? A field in a folded section cannot. */
  canShow: (el: Element) => boolean
  /** Is it on the screen now, with nothing over it? */
  inView: (el: Element) => boolean
  /** Move the page so it is in the middle of the screen. */
  bring: (el: Element) => void
  /** Draw or lift the ring. */
  ring: (el: Element, on: boolean) => void
  wait: (ms: number) => Promise<void>
}

export type TypedTourEnd =
  /** Every place that could be shown was shown. */
  | 'shown'
  /** There was nothing that could be shown. The floor was still waited. */
  | 'nothing'
  /** `stop()` was called: the person took the page back, or the pill left. */
  | 'stopped'

export type TypedTour = { done: Promise<TypedTourEnd>; stop: () => void }

/** Starts the walk. `stop()` lifts every ring at once and ends it as `stopped`. */
export function startTypedTextTour(deps: TypedTourDeps = pageTourDeps()): TypedTour {
  let stopped = false
  const ringed = new Set<Element>()
  const lift = () => {
    for (const el of ringed) deps.ring(el, false)
    ringed.clear()
  }
  const walk = async (): Promise<TypedTourEnd> => {
    const all = deps.fields().filter(deps.canShow)
    if (all.length === 0) {
      await deps.wait(TYPED_TOUR_SHOWN_MS)
      return stopped ? 'stopped' : 'nothing'
    }
    const left = new Set(all)
    for (;;) {
      if (stopped) return 'stopped'
      // A place can leave the page while the walk is on another one.
      const first = all.find((el) => left.has(el) && deps.canShow(el))
      if (!first) break
      // The ring goes on at once and rides with its place while the page moves to it.
      const wasInView = deps.inView(first)
      deps.bring(first)
      left.delete(first)
      ringed.add(first)
      deps.ring(first, true)
      if (!wasInView) {
        await deps.wait(TYPED_TOUR_SETTLE_MS)
        if (stopped) return 'stopped'
      }
      // Every other typed place that can be seen with it is the same stop.
      for (const el of all) {
        if (!left.has(el) || !deps.canShow(el) || !deps.inView(el)) continue
        left.delete(el)
        ringed.add(el)
        deps.ring(el, true)
      }
      await deps.wait(TYPED_TOUR_SHOWN_MS)
      lift()
    }
    return stopped ? 'stopped' : 'shown'
  }
  return {
    done: walk().catch((): TypedTourEnd => {
      lift()
      return stopped ? 'stopped' : 'nothing'
    }),
    stop: () => {
      stopped = true
      lift()
    },
  }
}

/** The walk over the real page. */
export function pageTourDeps(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): TypedTourDeps {
  const view = doc?.defaultView
  const still = (() => {
    try {
      return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    } catch {
      return false
    }
  })()
  return {
    fields: () => typedTextFields(doc),
    canShow: (el) => {
      if (!el.isConnected) return false
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    },
    inView: (el) => {
      if (!doc || !view) return false
      const box = el.getBoundingClientRect()
      const w = view.innerWidth
      const h = view.innerHeight
      if (box.bottom <= 0 || box.top >= h || box.right <= 0 || box.left >= w) return false
      // Its middle, held to the screen: a tall box counts when the part on screen is the box itself.
      const x = Math.min(Math.max((box.left + box.right) / 2, 0), w - 1)
      const y = Math.min(Math.max((box.top + box.bottom) / 2, 0), h - 1)
      const top = doc.elementFromPoint?.(x, y)
      // A page that cannot say what is on top is taken at the box's word.
      return top == null || top === el || el.contains(top)
    },
    bring: (el) => {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: still ? 'auto' : 'smooth' })
      } catch {
        // an old engine without the options form
        el.scrollIntoView?.()
      }
    },
    ring: (el, on) => {
      if (on) el.setAttribute(TYPED_SHOWN_ATTR, '')
      else el.removeAttribute(TYPED_SHOWN_ATTR)
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
}
