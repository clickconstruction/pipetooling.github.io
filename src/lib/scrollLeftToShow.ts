/**
 * Where a sideways scroller sits so one of its children reads whole (v2.7878, the Prospects pills on
 * a phone: the lit pill sat past the right edge, so the page showed two pills with neither lit).
 *
 * Every number is a pixel count. `itemLeft` is measured from the left edge of the scroller's
 * content, so it does not change as the scroller moves. `peek` is how much of the neighbour stays
 * in view beside the item, so the reader sees there is more to either side. It gives way when the
 * view is too narrow to hold the item and both peeks.
 *
 * The answer moves the scroller as little as it can: an item already whole in view leaves it where
 * it is. An item wider than the view shows its start. The answer never passes either end.
 */
export type ScrollLeftToShowInput = {
  /** Where the scroller sits now. */
  scrollLeft: number
  /** The scroller's visible width. */
  viewWidth: number
  /** The width of everything the scroller holds. */
  contentWidth: number
  /** The item's left edge, from the content's left edge. */
  itemLeft: number
  itemWidth: number
  /** How much of the neighbour stays in view on each side. */
  peek?: number
}

export function scrollLeftToShow({ scrollLeft, viewWidth, contentWidth, itemLeft, itemWidth, peek = 0 }: ScrollLeftToShowInput): number {
  const max = Math.max(0, contentWidth - viewWidth)
  const clamp = (n: number) => Math.min(max, Math.max(0, Math.round(n)))
  if (viewWidth <= 0 || itemWidth <= 0) return clamp(scrollLeft)
  // The peek shrinks to what the view can spare once the item itself is in it.
  const room = Math.max(0, Math.min(peek, (viewWidth - itemWidth) / 2))
  const itemRight = itemLeft + itemWidth
  if (itemWidth >= viewWidth) return clamp(itemLeft)
  if (itemLeft - room < scrollLeft) return clamp(itemLeft - room)
  if (itemRight + room > scrollLeft + viewWidth) return clamp(itemRight + room - viewWidth)
  return clamp(scrollLeft)
}
