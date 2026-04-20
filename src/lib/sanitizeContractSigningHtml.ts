/** Allowed tags for contract body (subset; no scripts, no inline handlers). */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'div',
  'span',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

const ALLOWED_ATTR = new Set(['href', 'target', 'rel', 'colspan', 'rowspan'])

/** Remove entirely (do not unwrap children into the document). */
const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'meta',
  'link',
  'base',
  'svg',
  'math',
])

function sanitizeWithDomParser(html: string): string {
  const wrapped = `<div id="contract-sanitize-root">${html}</div>`
  const doc = new DOMParser().parseFromString(wrapped, 'text/html')
  const root = doc.getElementById('contract-sanitize-root')
  if (!root) return ''

  let guard = 0
  const maxPasses = 200
  while (guard < maxPasses) {
    guard++
    let changed = false
    const elements = root.querySelectorAll('*')
    for (const el of elements) {
      const tag = el.tagName.toLowerCase()
      if (FORBIDDEN_TAGS.has(tag)) {
        el.remove()
        changed = true
        break
      }
      if (!ALLOWED_TAGS.has(tag)) {
        const parent = el.parentNode
        if (!parent) continue
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el)
        }
        el.remove()
        changed = true
        break
      }
    }
    if (!changed) break
  }

  for (const el of root.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) continue
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase()
      if (n.startsWith('on') || !ALLOWED_ATTR.has(n)) {
        el.removeAttribute(attr.name)
      }
    }
    if (tag === 'a') {
      const href = el.getAttribute('href')
      if (href && !/^https?:\/\//i.test(href.trim())) {
        el.removeAttribute('href')
      }
      if (el.getAttribute('target') === '_blank' && !el.getAttribute('rel')) {
        el.setAttribute('rel', 'noopener noreferrer')
      }
    }
  }

  return root.innerHTML
}

/** Last-resort strip when DOMParser is unavailable (e.g. Node tests). */
function stripTagsFallback(raw: string): string {
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
}

/**
 * Sanitize staff-provided HTML for the public contract signing page.
 * Uses the browser DOM (no extra npm deps) so Vite dev never hits optimize-dep 504 on dompurify.
 */
export function sanitizeContractSigningHtml(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (typeof document === 'undefined') {
    return stripTagsFallback(s)
  }
  try {
    return sanitizeWithDomParser(s)
  } catch {
    return stripTagsFallback(s)
  }
}
