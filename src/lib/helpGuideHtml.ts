/**
 * Markdown → safe HTML for /help guide bodies.
 *
 * Reuses the contract-signing sanitizer UNTOUCHED (it guards a signing-critical
 * surface and must not be loosened). That sanitizer unwraps `code`/`pre`, which
 * guides need for exact button labels — so those two tags are encoded to text
 * markers before sanitizing and restored after. The restore step reintroduces
 * only bare `<code>`/`<pre>` tags (no attributes), so nothing dangerous can
 * ride through. Guide content is repo-authored and bundled; the sanitizer here
 * is defense-in-depth, not the security boundary.
 *
 * The same sanitizer keeps an `href` only when it is absolute http(s), so a
 * guide-to-guide link written as `/help/<slug>` (or `/help?g=<slug>`) used to
 * come out as a bare `<a>` with no href — a dead link in six guides (found on
 * the v2.3516 live pass). Those links are encoded to a placeholder https host
 * before sanitizing and restored after as `href="/help?g=<slug>" data-guide=
 * "<slug>"`; GuideBrowser turns a click on `a[data-guide]` into an in-app
 * navigation. Only a bare slug (`[a-z0-9-]+`) survives the round trip.
 * v2.4868: the short `?g=<slug>` (forty guides wrote it, every one dead until then) rides
 * the same way, and so does a heading of another guide, `/help/<slug>#<anchor>`, restored
 * with a `data-guide-anchor` GuideBrowser scrolls to. An email address in a guide is an
 * example, so the autolink marked makes of it, which the sanitizer leaves hrefless, is
 * printed as text. `helpGuideLinks.guides.test.ts` renders every guide and fails on a dead link.
 *
 * v2.4290: a link to a page of the app (`/settings?tab=settings-jobs&focus=issuer.signerName`,
 * `/jobs?tab=stages&gcReview=1`, `/dashboard`) rides the same way — a second placeholder host,
 * restored as `href="<path>" data-app="<path>"`; GuideBrowser navigates in place. Only a root
 * path of plain URL characters (`[A-Za-z0-9/?&=#._%-]`, no `..`, no `//`) survives.
 */
import { marked } from 'marked'
import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'
import { encodeHelpIllustrations, expandHelpIllustrations } from './helpGuideIllustrations'

const CODE_OPEN = '[[[help-code-open]]]'
const CODE_CLOSE = '[[[help-code-close]]]'
const PRE_OPEN = '[[[help-pre-open]]]'
const PRE_CLOSE = '[[[help-pre-close]]]'

const MARKER_PATTERN = /\[\[\[help-(?:code|pre)-(?:open|close)\]\]\]/g

/** Placeholder host: absolute https, so the contract sanitizer keeps the href. */
const GUIDE_LINK_HOST = 'https://guide.help.internal/'
const IN_APP_GUIDE_HREF = /href="(?:\/help\/|\/help\?g=|\?g=)([a-z0-9-]+)(?:#([a-z0-9-]+))?"/gi
const PLACEHOLDER_GUIDE_HREF = /href="https:\/\/guide\.help\.internal\/([a-z0-9-]+)(?:#([a-z0-9-]+))?"/g

/** What the sanitizer leaves of an autolinked email address: a bare `<a>` around it (v2.4868). */
const HREFLESS_EMAIL_LINK = /<a>([^<>\s@]+@[^<>\s]+)<\/a>/g

/** Placeholder host for a page of the app (v2.4290); the path rides after it, percent-encoded. */
const PAGE_LINK_HOST = 'https://page.help.internal/'
const IN_APP_PAGE_HREF = /href="(\/(?!help(?:[/?]|"))[A-Za-z0-9/?&;=#._%-]*)"/g
const PLACEHOLDER_PAGE_HREF = /href="https:\/\/page\.help\.internal\/([A-Za-z0-9%._-]*)"/g

/**
 * Placeholder host for a link to a heading of the same guide (v2.4529): `[The month rule](#the-month-rule)`.
 * Restored as `href="#<anchor>" data-anchor="<anchor>"`; GuideBrowser scrolls to the heading.
 */
const ANCHOR_LINK_HOST = 'https://anchor.help.internal/'
const IN_GUIDE_ANCHOR_HREF = /href="#([a-z0-9-]+)"/g
const PLACEHOLDER_ANCHOR_HREF = /href="https:\/\/anchor\.help\.internal\/([a-z0-9-]+)"/g

/** A root path a guide may send the reader to: plain URL characters, no `..`, no protocol-relative `//`. */
export function isHelpGuidePagePath(path: string): boolean {
  return /^\/[A-Za-z0-9/?&=#._%-]*$/.test(path) && !path.includes('..') && !path.startsWith('//') && !path.startsWith('/help/') && !path.startsWith('/help?')
}

/** `href="/help/<slug>"` and `href="/help?g=<slug>"` → a placeholder https href the sanitizer keeps; a page path likewise. */
export function encodeHelpGuideLinks(html: string): string {
  return html
    .split(GUIDE_LINK_HOST).join('') // defensive: authored text can't pre-bake the placeholder
    .split(PAGE_LINK_HOST).join('')
    .split(ANCHOR_LINK_HOST).join('')
    .replace(IN_GUIDE_ANCHOR_HREF, (_m, anchor: string) => `href="${ANCHOR_LINK_HOST}${anchor}"`)
    .replace(IN_APP_GUIDE_HREF, (_m, slug: string, anchor?: string) => `href="${GUIDE_LINK_HOST}${slug.toLowerCase()}${anchor ? `#${anchor.toLowerCase()}` : ''}"`)
    .replace(IN_APP_PAGE_HREF, (m, path: string) => {
      // marked writes `&amp;` in attributes; the path travels plain and is re-escaped on restore.
      const plain = path.replace(/&amp;/g, '&')
      return isHelpGuidePagePath(plain) ? `href="${PAGE_LINK_HOST}${encodeURIComponent(plain)}"` : m
    })
}

/** Inverse of encodeHelpGuideLinks: the in-app address plus the hook GuideBrowser navigates on. */
export function restoreHelpGuideLinks(html: string): string {
  return html
    .replace(PLACEHOLDER_ANCHOR_HREF, (_m, anchor: string) => `href="#${anchor}" data-anchor="${anchor}"`)
    .replace(PLACEHOLDER_GUIDE_HREF, (_m, slug: string, anchor?: string) =>
      anchor ? `href="/help?g=${slug}#${anchor}" data-guide="${slug}" data-guide-anchor="${anchor}"` : `href="/help?g=${slug}" data-guide="${slug}"`,
    )
    .replace(PLACEHOLDER_PAGE_HREF, (m, enc: string) => {
      let path = ''
      try {
        path = decodeURIComponent(enc)
      } catch {
        return m
      }
      if (!isHelpGuidePagePath(path)) return m
      const attr = path.replace(/&/g, '&amp;').replace(/"/g, '')
      return `href="${attr}" data-app="${attr}"`
    })
}

/** Replace code/pre tags (attributes dropped) with text markers that survive sanitizing. */
export function encodeHelpCodeTags(html: string): string {
  return html
    .replace(MARKER_PATTERN, '') // defensive: authored text can't smuggle markers
    .replace(/<code[^>]*>/gi, CODE_OPEN)
    .replace(/<\/code>/gi, CODE_CLOSE)
    .replace(/<pre[^>]*>/gi, PRE_OPEN)
    .replace(/<\/pre>/gi, PRE_CLOSE)
}

/** Inverse of encodeHelpCodeTags; reintroduces only bare tags. */
export function restoreHelpCodeTags(html: string): string {
  // split/join instead of replaceAll: tsconfig lib predates es2021.
  return html
    .split(CODE_OPEN).join('<code>')
    .split(CODE_CLOSE).join('</code>')
    .split(PRE_OPEN).join('<pre>')
    .split(PRE_CLOSE).join('</pre>')
}

export function helpGuideMarkdownToSafeHtml(markdown: string): string {
  // Per-call options (not marked.setOptions) to avoid coupling with contractBodyFormat's config.
  // Illustration tokens ({{button:…}}, :::example panels) are marker-encoded before marked and
  // expanded after sanitizing — see helpGuideIllustrations.ts.
  // breaks: true (unlike contracts) so multi-line :::example panels render as stacked lines.
  const rawHtml = marked.parse(encodeHelpIllustrations(markdown), { async: false, gfm: true, breaks: true })
  const sanitized = sanitizeContractSigningHtml(encodeHelpGuideLinks(encodeHelpCodeTags(rawHtml)))
  return expandHelpIllustrations(restoreHelpGuideLinks(restoreHelpCodeTags(sanitized))).replace(HREFLESS_EMAIL_LINK, '$1')
}
