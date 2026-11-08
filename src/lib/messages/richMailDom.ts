/**
 * The rich view's sanitizer (punch list #259 PR 2, v2.6676): DOMPurify, pinned in `package.json`, with `richMail.ts`'s
 * rules in its hooks. One instance for the page, made on the first call (it needs a `window`); the pictures switch and
 * the counts ride on a module-level state the hooks read, set right before each synchronous `sanitize`.
 *
 * - `uponSanitizeElement`: a picture two pixels or smaller, or hidden, is removed (`isTrackingPixel`); any other is
 *   counted and, while pictures are off, loses its address and wears `data-picture-off` for the view's placeholder.
 * - `uponSanitizeAttribute`: `richAttr` cleans a style, holds a picture's or a link's address to its rule, or drops it.
 * - `afterSanitizeAttributes`: every link opens in a new tab with `noopener noreferrer`, as the plain view's do
 *   (`target` is forbidden on the way in, so the sender's own can never stay).
 */
import DOMPurify from 'dompurify'
import { isTrackingPixel, richAttr, RICH_MAIL_LINK_ATTRS, richMailConfig } from './richMail'

export interface RichMailDrawn {
  /** The HTML to draw, safe to set as a node's innerHTML. */
  html: string
  /** The pictures the mail carries, pixels not counted: how many Show pictures would turn on. */
  pictures: number
  /** The tracking pixels and spacers removed. */
  pixels: number
}

const state = { picturesOn: false, pictures: 0, pixels: 0 }

let purify: ReturnType<typeof DOMPurify> | null = null

function instance(): ReturnType<typeof DOMPurify> {
  if (purify) return purify
  const p = DOMPurify()
  p.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'img' || !(node instanceof Element)) return
    if (isTrackingPixel({ width: node.getAttribute('width'), height: node.getAttribute('height'), style: node.getAttribute('style') })) {
      state.pixels += 1
      node.remove()
      return
    }
    state.pictures += 1
    if (!state.picturesOn) {
      node.removeAttribute('src')
      node.removeAttribute('srcset')
      node.setAttribute('data-picture-off', '')
    }
  })
  p.addHook('uponSanitizeAttribute', (node, data) => {
    const rule = richAttr(node.nodeName.toLowerCase(), data.attrName, data.attrValue, state.picturesOn)
    if (!rule.keep) {
      data.keepAttr = false
      return
    }
    data.attrValue = rule.value
  })
  p.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', RICH_MAIL_LINK_ATTRS.target)
      node.setAttribute('rel', RICH_MAIL_LINK_ATTRS.rel)
    }
  })
  purify = p
  return p
}

/** The mail's HTML as the rich view draws it, with its pictures on or off, and what was counted on the way. */
export function sanitizeRichMail(html: string, picturesOn: boolean): RichMailDrawn {
  state.picturesOn = picturesOn
  state.pictures = 0
  state.pixels = 0
  const out = String(instance().sanitize(html, richMailConfig()))
  return { html: out, pictures: state.pictures, pixels: state.pixels }
}
