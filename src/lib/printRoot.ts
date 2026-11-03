/**
 * An in-page print that draws one window alone, at full size (Materials on site's labels and
 * manifest, v2.6432).
 *
 * The window is portalled to `<body>`, and in print every other child of `<body>` leaves the
 * layout. Hiding the page behind with `visibility: hidden` is not enough: a hidden page still
 * takes its width, and the Jobs page's tab strip runs past the sheet, so Chrome shrank the whole
 * printout to about two thirds to make it fit. On 2026-11-03 a 112px QR printed 68px across and
 * the manifest's ruled lines sat 29px apart instead of 44px. The root prints in the normal flow so
 * its sheets paginate, and the body that the scroll lock pins with `position: fixed` is let go,
 * or Chrome prints the first sheet alone.
 *
 * Pure. A window renders `<style>{printRootCss('its-class')}</style>` inside its root, and adds
 * its own rules for its chrome and its page breaks.
 */

/** Letter with half-inch margins prints 7.5 × 10 in: 720 × 960 CSS px at 96 dpi. */
export const LETTER_PRINTABLE_PX = { width: 720, height: 960 } as const

const CLASS_NAME = /^[a-z][a-z0-9-]*$/

/** The print rules for a window portalled to `<body>` whose root carries `rootClass`. */
export function printRootCss(rootClass: string): string {
  if (!CLASS_NAME.test(rootClass)) throw new Error(`printRootCss: "${rootClass}" is not a plain class name`)
  const root = `.${rootClass}`
  return [
    '@media print {',
    '@page { size: letter; margin: 0.5in; }',
    'html, body { background: #fff !important; }',
    'html.scroll-locked body { position: static !important; overflow: visible !important; top: auto !important; height: auto !important; padding-right: 0 !important; }',
    `body > *:not(${root}) { display: none !important; }`,
    `${root} { position: static !important; inset: auto !important; display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; z-index: auto !important; }`,
    '}',
  ].join(' ')
}
