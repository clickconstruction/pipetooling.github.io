/**
 * A dead press (punch list #194, v2.6062): the fill and the words of a button that cannot be
 * pressed yet, or is busy. What everyone sees found the app's dead buttons drawn white on a
 * literal grey, 2.54:1 on `#9ca3af` and 1.47:1 on `#d1d5db`, in both themes. The pair here is the
 * theme's own greys, so the words read 8.3:1 in light and 5.1:1 in dark, and a dead button dims
 * with the surface in dark instead of sitting on it as a light slab. `readablePairs.test.ts` holds
 * the pair at 4.5:1. Pure.
 */
export const DEAD_PRESS_FILL = 'var(--bg-200)'
export const DEAD_PRESS_TEXT = 'var(--text-700)'
