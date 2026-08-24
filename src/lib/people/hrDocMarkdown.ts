/**
 * Markdown → safe HTML for HR file docs (People → HR summary/narrative), and a
 * heading extractor for the narrative's jump-to-section list (v2.2230).
 *
 * HR docs are agent-authored plain markdown (no help-guide illustration tokens),
 * so this reuses the contract-signing sanitizer directly — the same trusted
 * boundary the help guides use — without the illustration marker dance. The
 * content is dev-only and repo-adjacent; the sanitizer is defense-in-depth.
 */
import { marked } from 'marked'
import { sanitizeContractSigningHtml } from '../sanitizeContractSigningHtml'

/** Render an HR doc's markdown to sanitized HTML. Empty/blank → ''. */
export function hrDocMarkdownToSafeHtml(markdown: string): string {
  if (markdown.trim() === '') return ''
  const rawHtml = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  return sanitizeContractSigningHtml(rawHtml)
}

export type HrDocHeading = {
  /** Heading text, markdown/backticks stripped. */
  text: string
  /** 1–6. */
  level: number
  /** Stable slug for an in-page anchor; unique within one doc. */
  slug: string
}

/** Slugify heading text for an anchor id. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract ATX headings (`#`..`######`) from an HR doc, in document order, with
 * de-duplicated slugs. Fenced code blocks are skipped so `#` inside them is not
 * mistaken for a heading. Used to build the narrative jump list.
 */
export function extractHrDocHeadings(markdown: string): HrDocHeading[] {
  const out: HrDocHeading[] = []
  const seen = new Map<string, number>()
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const level = m[1]!.length
    const text = m[2]!.replace(/`/g, '').replace(/\*\*/g, '').trim()
    if (text === '') continue
    const base = slugify(text) || 'section'
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.push({ text, level, slug: n === 0 ? base : `${base}-${n}` })
  }
  return out
}
