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
const IN_APP_GUIDE_HREF = /href="\/help(?:\/|\?g=)([a-z0-9-]+)"/gi
const PLACEHOLDER_GUIDE_HREF = /href="https:\/\/guide\.help\.internal\/([a-z0-9-]+)"/g

/** `href="/help/<slug>"` and `href="/help?g=<slug>"` → a placeholder https href the sanitizer keeps. */
export function encodeHelpGuideLinks(html: string): string {
  return html
    .split(GUIDE_LINK_HOST).join('') // defensive: authored text can't pre-bake the placeholder
    .replace(IN_APP_GUIDE_HREF, (_m, slug: string) => `href="${GUIDE_LINK_HOST}${slug.toLowerCase()}"`)
}

/** Inverse of encodeHelpGuideLinks: the in-app address plus the hook GuideBrowser navigates on. */
export function restoreHelpGuideLinks(html: string): string {
  return html.replace(PLACEHOLDER_GUIDE_HREF, (_m, slug: string) => `href="/help?g=${slug}" data-guide="${slug}"`)
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
  return expandHelpIllustrations(restoreHelpGuideLinks(restoreHelpCodeTags(sanitized)))
}
