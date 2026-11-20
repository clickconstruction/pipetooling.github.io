/**
 * Where the document builder's flow frame ends (punch list #404). The frame keeps one height, so the slider and the
 * Next press stay put while the page above them changes, and it must fit on the screen whole, or the slider is out of
 * reach on a phone.
 *
 * Two ways to size it. With room under where the frame starts, it ends at the bottom of the screen and the page stays
 * where it is: that is a computer. Without that room, which is a phone with the Documents tab row above it, the frame is
 * sized to the screen from the builder's own top, and the builder scrolls itself to the top of the screen once.
 *
 * Pure: no React, no DOM.
 */

/** The frame is never taller than the mock-up's frame and never shorter than this. */
export const FRAME_MAX_PX = 680
export const FRAME_MIN_PX = 420
/** With less room than this under the frame's top, the frame is sized from the builder's own top instead. */
export const FRAME_ROOM_MIN_PX = 480
/** The gap left under the frame, and above the builder once it has scrolled itself to the top. */
export const FRAME_GAP_PX = 12
export const FRAME_LEAD_PX = 8

export type FramePlace = {
  /** What `offset` is measured from: the top of the page, or the top of the open builder. */
  from: 'page' | 'builder'
  offset: number
}

/**
 * `top` is how far the frame starts from the top of the page, `inset` how far from the top of the open builder, and
 * `screen` the screen's height, all in px.
 */
export function framePlace(m: { top: number; inset: number; screen: number }): FramePlace {
  const room = m.screen - m.top - FRAME_GAP_PX
  return room >= FRAME_ROOM_MIN_PX ? { from: 'page', offset: m.top } : { from: 'builder', offset: m.inset }
}

/** True when the builder should scroll itself to the top of the screen as it opens. */
export function frameScrollsIntoView(place: FramePlace | null): boolean {
  return place?.from === 'builder'
}

/** The frame's height as CSS. Before the first measure it is the tallest frame, which a measure then corrects. */
export function frameHeightCss(place: FramePlace | null): string {
  if (!place) return `${FRAME_MAX_PX}px`
  const room =
    place.from === 'page'
      ? `calc(100dvh - ${place.offset}px - var(--app-bottom-chrome, 0px) - ${FRAME_GAP_PX}px)`
      : `calc(100dvh - ${place.offset}px - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px) - ${FRAME_GAP_PX + FRAME_LEAD_PX}px)`
  return `max(${FRAME_MIN_PX}px, min(${FRAME_MAX_PX}px, ${room}))`
}

/** The room kept above the builder when it scrolls itself to the top: the phone's status bar, then a small lead. */
export const FRAME_SCROLL_MARGIN_CSS = `calc(var(--app-top-chrome, 0px) + ${FRAME_LEAD_PX}px)`
