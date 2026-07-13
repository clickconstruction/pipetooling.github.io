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
 */
import { marked } from 'marked'
import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'
import { encodeHelpIllustrations, expandHelpIllustrations } from './helpGuideIllustrations'

const CODE_OPEN = '[[[help-code-open]]]'
const CODE_CLOSE = '[[[help-code-close]]]'
const PRE_OPEN = '[[[help-pre-open]]]'
const PRE_CLOSE = '[[[help-pre-close]]]'

const MARKER_PATTERN = /\[\[\[help-(?:code|pre)-(?:open|close)\]\]\]/g

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
  return expandHelpIllustrations(restoreHelpCodeTags(sanitizeContractSigningHtml(encodeHelpCodeTags(rawHtml))))
}
