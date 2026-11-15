/**
 * Bring a pane's footer up (v2.7321): when the verdict band's act is the footer's main press and
 * that press is not one the band can run itself (a leader's signing row with its offer, a hold with
 * two ways out), the band scrolls the footer into view and puts the keyboard on its last live press,
 * which is the primary — the footers end their row with it. A ring on the footer for a moment says
 * where the eye should go (`[data-lien-foot-lit]` in `index.css`).
 */
export function bringLienFooterUp(footer: HTMLElement | null | undefined): void {
  if (!footer) return
  footer.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  const presses = Array.from(footer.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
  presses[presses.length - 1]?.focus?.({ preventScroll: true })
  footer.setAttribute('data-lien-foot-lit', '1')
  window.setTimeout(() => footer.removeAttribute('data-lien-foot-lit'), 1600)
}
