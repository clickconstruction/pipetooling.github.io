/**
 * On-screen keyboard detection from visual-viewport geometry.
 *
 * `position: fixed` elements anchor to the layout viewport, so when the mobile
 * keyboard opens they either float mid-screen (iOS pans the visual viewport)
 * or ride on top of the keyboard (Android resizes it). Fixed bottom bars are
 * unusable while typing either way — the fix is to hide them, native-app
 * style, whenever the keyboard is occluding the page.
 *
 * The keyboard is detected as the only thing that shrinks the visual
 * viewport's *layout-space* height relative to `window.innerHeight`:
 * pinch-zoom shrinks `visualViewport.height` but raises `scale` by the same
 * factor (the product stays ~innerHeight), and browser-chrome collapse moves
 * both `innerHeight` and the product together. Only keyboard occlusion opens a
 * large gap between the two.
 */
export const KEYBOARD_OCCLUSION_MIN_PX = 150

export function isOnScreenKeyboardOccluding(
  windowInnerHeight: number,
  visualViewportHeight: number | null | undefined,
  visualViewportScale: number | null | undefined,
): boolean {
  if (visualViewportHeight == null || !Number.isFinite(visualViewportHeight)) return false
  if (!Number.isFinite(windowInnerHeight) || windowInnerHeight <= 0) return false
  const scale =
    visualViewportScale != null && Number.isFinite(visualViewportScale) && visualViewportScale > 0
      ? visualViewportScale
      : 1
  const layoutSpaceVisibleHeight = visualViewportHeight * scale
  return windowInnerHeight - layoutSpaceVisibleHeight >= KEYBOARD_OCCLUSION_MIN_PX
}
