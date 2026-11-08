/**
 * Messages: an email as rich text (punch list #259 PR 2, v2.6676). The bids@ reader keeps each inbound email's HTML part
 * at `<line id>/body.html` (v2.6675, `messages.body_html_path`), and the message window draws it behind two chips over
 * the words, **Rich text · Plain**. A stranger wrote that HTML, so it goes through DOMPurify (pinned in `package.json`)
 * with these rules on top, and nothing in it runs, posts, phones home or styles the page around it:
 *
 * - no script, style, link, meta, base, frame, object, form or media tag (`RICH_MAIL_FORBID_TAGS`); a removed tag's
 *   words stay, as DOMPurify keeps them, so a form's labels still read;
 * - no `srcset`, `background`, `ping`, `id` or `class` (`RICH_MAIL_FORBID_ATTR`): a background fetches, a class or an id
 *   could meet the app's own CSS;
 * - an inline `style` loses every declaration that fetches or escapes (`cleanStyle`: `url(`, `expression(`, `@import`,
 *   `behavior`, a fixed or sticky position);
 * - a tracking pixel is gone (`isTrackingPixel`: a picture two pixels or smaller either way, or hidden);
 * - every other picture is off until **Show pictures** is pressed (`richAttr` drops `src` while pictures are off; on, an
 *   `https:` or an inline `data:image` address stays and a `cid:` one, whose bytes are in Gmail, is dropped);
 * - a link keeps an `http(s):`, `mailto:`, `tel:` or `sms:` address alone, and opens in a new tab as the plain view's
 *   do (`RICH_MAIL_LINK_ATTRS`).
 *
 * The choice is remembered on the device (`readEmailView` / `keepEmailView`, `localStorage` in try/catch), Plain until
 * someone presses Rich text. Pure: `richMailDom.ts` wires these rules into DOMPurify's hooks, and `RichMailView.tsx`
 * draws the answer.
 */

export type EmailView = 'rich' | 'plain'

/** Where the device keeps the choice. */
export const EMAIL_VIEW_KEY = 'messages.emailView.v1'

/** The view kept on this browser; Plain when none is, or when the browser keeps nothing. */
export function readEmailView(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): EmailView {
  try {
    return storage?.getItem(EMAIL_VIEW_KEY) === 'rich' ? 'rich' : 'plain'
  } catch {
    return 'plain'
  }
}

export function keepEmailView(view: EmailView, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(EMAIL_VIEW_KEY, view)
  } catch {
    // A browser that keeps nothing opens on Plain next time.
  }
}

/** The chips' words, in the order they are drawn. */
export const EMAIL_VIEW_WORDS: Readonly<Record<EmailView, string>> = { rich: 'Rich text', plain: 'Plain' }

/** The words around the pictures: the press, and the line while they are off. */
export const RICH_MAIL_WORDS = {
  showPictures: 'Show pictures',
  showPicturesTitle: 'Loads the sender’s pictures from their server. Off until you press it.',
  picturesOff: (n: number) => (n === 1 ? '1 picture is off.' : `${n} pictures are off.`),
  reading: 'Reading the sender’s layout…',
} as const

/** Tags that run, fetch, post, frame or style the page around them. Their words stay; their contents of script and style do not. */
export const RICH_MAIL_FORBID_TAGS: readonly string[] = [
  'script',
  'noscript',
  'style',
  'link',
  'meta',
  'base',
  'head',
  'title',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'option',
  'optgroup',
  'textarea',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'template',
  'slot',
  'dialog',
  'map',
  'area',
  'marquee',
]

/** Attributes that fetch on their own, or could meet the app's own CSS and scripts. */
export const RICH_MAIL_FORBID_ATTR: readonly string[] = ['srcset', 'sizes', 'ping', 'background', 'poster', 'longdesc', 'usemap', 'formaction', 'action', 'target', 'dynsrc', 'lowsrc', 'id', 'class', 'contenteditable', 'autofocus', 'tabindex']

/**
 * What DOMPurify lets an attribute's value be at all. DOMPurify runs this over every attribute that is not a known
 * plain one (`width="600"`, `bgcolor="#fff"`, `align="left"` included), so the shape is DOMPurify's own: a scheme we
 * open (the web, mail, a phone, a text), or a value with no scheme (one that starts with no letter, or a word no colon
 * follows). `javascript:`, `cid:`, `file:` and every other scheme fail it. An inline `data:image` picture passes through
 * DOMPurify's own door for `img src` alone, and `richAttr` holds it to the picture kinds.
 */
export const RICH_MAIL_URI = /^(?:(?:https?|mailto|tel|sms):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

/** The addresses a link may open: never an inline picture, which DOMPurify would otherwise let through `href`. */
export const RICH_MAIL_LINK_URI = /^(?:https?|mailto|tel|sms):/i

/** The addresses a picture may load from once pictures are on: the web, or its own bytes. A `cid:` picture's bytes are in Gmail. */
export const RICH_MAIL_PICTURE_URI = /^(?:https?:|data:image\/(?:png|gif|jpe?g|webp);)/i

/** What every link gets, as `MessageBody` gives the plain view's. */
export const RICH_MAIL_LINK_ATTRS = { target: '_blank', rel: 'noopener noreferrer' } as const

/** A picture this many pixels or smaller, either way, is a tracking pixel or a spacer, never something to see. */
export const PIXEL_MAX_PX = 2

/** DOMPurify's settings for the rich view: the HTML profile, the tags and attributes above out, the addresses above in, data- attributes kept for the pictures-off mark. */
export function richMailConfig(): {
  USE_PROFILES: { html: true }
  FORBID_TAGS: string[]
  FORBID_ATTR: string[]
  ALLOWED_URI_REGEXP: RegExp
  ALLOW_DATA_ATTR: boolean
  WHOLE_DOCUMENT: boolean
  RETURN_DOM: false
  RETURN_DOM_FRAGMENT: false
} {
  return {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [...RICH_MAIL_FORBID_TAGS],
    FORBID_ATTR: [...RICH_MAIL_FORBID_ATTR],
    ALLOWED_URI_REGEXP: RICH_MAIL_URI,
    ALLOW_DATA_ATTR: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }
}

/** A declaration that fetches, runs or escapes the view. */
const STYLE_FETCHES = /url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|javascript:|image-set\s*\(/i
const STYLE_ESCAPES = /^\s*position\s*:\s*(?:fixed|sticky)\b/i

/** An inline style with the declarations that fetch or escape taken out; '' when nothing is left. */
export function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && !STYLE_FETCHES.test(d) && !STYLE_ESCAPES.test(d))
    .join('; ')
}

/** The facts of a picture the pixel rule reads: its size attributes and its inline style, as written. */
export interface PictureFacts {
  width: string | null
  height: string | null
  style: string | null
}

/** A size as an attribute or a style writes it, in pixels; null for a percentage, `auto`, or words. */
export function pixelSize(value: string | null | undefined): number | null {
  if (value == null) return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(value)
  return m ? Number(m[1]) : null
}

const styleSize = (style: string | null, prop: 'width' | 'height'): number | null => {
  if (!style) return null
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style)
  return m ? pixelSize(m[1]!) : null
}

/** A tracking pixel or a spacer: two pixels or smaller either way, by attribute or by style, or hidden by style. */
export function isTrackingPixel(img: PictureFacts): boolean {
  const sizes = [pixelSize(img.width), pixelSize(img.height), styleSize(img.style, 'width'), styleSize(img.style, 'height')]
  if (sizes.some((n) => n !== null && n <= PIXEL_MAX_PX)) return true
  return Boolean(img.style && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(img.style))
}

export type AttrRule = { keep: true; value: string } | { keep: false }

/**
 * One attribute as the rich view keeps it: a style cleaned, a picture's address only while pictures are on and only
 * from the web or its own bytes, a link's address only to the web, mail or a phone, everything else as DOMPurify left
 * it. The tag and the attribute's name come lower-case.
 */
export function richAttr(tag: string, name: string, value: string, picturesOn: boolean): AttrRule {
  if (name === 'style') {
    const cleaned = cleanStyle(value)
    return cleaned ? { keep: true, value: cleaned } : { keep: false }
  }
  if (tag === 'img' && name === 'src') return picturesOn && RICH_MAIL_PICTURE_URI.test(value.trim()) ? { keep: true, value: value.trim() } : { keep: false }
  if (tag === 'a' && name === 'href') return RICH_MAIL_LINK_URI.test(value.trim()) ? { keep: true, value: value.trim() } : { keep: false }
  return { keep: true, value }
}
