/**
 * Dead-tap hint (v2.2289) — when someone taps a card where nothing is
 * clickable, the card's real click zones flash the app's focus ring and
 * fade. Fires only on dead taps: a tap that lands on an interactive element
 * just does its job.
 */

export const TAP_HINT_INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]'

/** How long the hint class stays on (matches the CSS animation, +50ms slack). */
export const TAP_HINT_DURATION_MS = 950

/** True when a click landed on dead space (no interactive ancestor). */
export function isDeadTap(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return target.closest(TAP_HINT_INTERACTIVE_SELECTOR) == null
}

/** The keyframes + rule for a container class; ring = the app's focus language. */
export function tapHintCss(containerSelector: string): string {
  return `
  @keyframes est-tap-hint-fade {
    0% { outline-color: #2563eb; }
    55% { outline-color: #2563eb; }
    100% { outline-color: transparent; }
  }
  ${containerSelector} :is(a, button, [role="button"]) {
    outline: 2px solid transparent;
    outline-offset: 3px;
    animation: est-tap-hint-fade 0.9s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    ${containerSelector} :is(a, button, [role="button"]) {
      animation: none;
      outline-color: #2563eb;
    }
  }
`
}
