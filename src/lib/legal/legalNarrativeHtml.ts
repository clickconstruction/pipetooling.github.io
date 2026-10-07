import { marked } from 'marked'
import { sanitizeContractSigningHtml } from '../sanitizeContractSigningHtml'

/**
 * The narrative's markdown as HTML for the firm's portal and its printed packet (v2.4812): marked,
 * then the contract-signing sanitizer the help guides use — its allowlist keeps headings, lists,
 * tables, emphasis and links, drops scripts, styles, forms, images and every inline handler, and
 * keeps an href only when it is absolute http(s). A kept link opens in a new tab.
 */
export function legalNarrativeHtml(markdown: string): string {
  const md = (markdown ?? '').trim()
  if (!md) return ''
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string
  return sanitizeContractSigningHtml(html).replace(/<a href="(https?:\/\/[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"')
}
