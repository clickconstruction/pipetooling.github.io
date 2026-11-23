/**
 * The newest ask wins (v2.8304). A list that asks again on every chip and every typed word has more than one read out
 * at once, and they do not come back in the order they left: a slow read for the first chip lands after a fast read
 * for the second. Unchecked, the older answer paints over the newer one, or its failure is drawn over rows that read.
 *
 * `next()` starts an ask and hands back a check. The check is true only while no later ask has started, so a read
 * that is no longer the newest drops its answer and its failure alike. Pure: no clock, no React. A screen keeps one
 * in a ref.
 */
export type NewestAsk = {
  /** Start an ask. The function it returns says whether this ask is still the newest one. */
  next: () => () => boolean
}

export function newestAsk(): NewestAsk {
  let newest = 0
  return {
    next: () => {
      const mine = ++newest
      return () => mine === newest
    },
  }
}
