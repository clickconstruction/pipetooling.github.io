/**
 * Share pages for help guides (v2.3147): a texted `clicktooling.com/g/<slug>/`
 * link unfurls as a rich card in iMessage / WhatsApp / Slack — the guide's
 * own title, its first sentence, the ClickTooling card — then bounces the
 * human into the app at `/help?g=<slug>`. Link crawlers never run the app's
 * JavaScript, so the card has to be static HTML: the Vite build writes one
 * page per guide from these pure helpers (`helpSharePagesPlugin` in
 * vite.config.ts). Same shape as the portal shell (v2.2033) and job-share.
 */

export const HELP_SHARE_PATH_PREFIX = '/g/'
export const HELP_SHARE_CARD_IMAGE = '/og-card.png'
export const HELP_SHARE_CARD_WIDTH = 1200
export const HELP_SHARE_CARD_HEIGHT = 630

/** `https://clicktooling.com/g/split-a-job-into-stages/` — the trailing slash is what GitHub Pages serves an index.html at. */
export function helpShareUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, '')}${HELP_SHARE_PATH_PREFIX}${slug}/`
}

/** The app URL a share page bounces to. */
export function helpGuideAppPath(slug: string): string {
  return `/help?g=${encodeURIComponent(slug)}`
}

/**
 * The card's one-line description: the guide's first paragraph with the
 * markdown and the mock-UI tokens stripped, cut at a sentence end under
 * `max` characters.
 */
export function helpShareDescription(body: string, max = 200): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const para: string[] = []
  let inBlock = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith(':::')) {
      inBlock = !inBlock
      continue
    }
    if (inBlock) continue
    if (!line) {
      if (para.length > 0) break
      continue
    }
    if (/^(#|\{\{gif:|[-*] |\d+\. |\||>)/.test(line)) {
      if (para.length > 0) break
      continue
    }
    para.push(line)
  }
  let text = para
    .join(' ')
    .replace(/\{\{(button|chip|icon):[^|}]*\|([^}]*)\}\}/g, '$2')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`).trim()
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type HelpSharePage = {
  slug: string
  /** The guide's frontmatter title, e.g. "split a job into stages and bill stage by stage". */
  title: string
  description: string
  /** The canonical app origin (https://clicktooling.com). */
  origin: string
}

/** "How do I split a job into stages…" — the card's title, mirroring the Help page's own heading. */
export function helpShareTitle(title: string): string {
  const t = title.trim().replace(/[.?]+$/, '')
  return `How do I ${t}?`
}

/** One static HTML page: OG + Twitter tags for the crawler, an instant bounce for the human. */
export function helpSharePageHtml(page: HelpSharePage): string {
  const origin = page.origin.replace(/\/+$/, '')
  const title = helpShareTitle(page.title)
  const url = helpShareUrl(origin, page.slug)
  const app = `${origin}${helpGuideAppPath(page.slug)}`
  const image = `${origin}${HELP_SHARE_CARD_IMAGE}`
  const desc = page.description || 'A ClickTooling help guide.'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ClickTooling</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="noindex">
<meta property="og:site_name" content="ClickTooling">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="${HELP_SHARE_CARD_WIDTH}">
<meta property="og:image:height" content="${HELP_SHARE_CARD_HEIGHT}">
<meta property="og:image:alt" content="ClickTooling help guide">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta http-equiv="refresh" content="0;url=${escapeHtml(app)}">
<script>window.location.replace(${JSON.stringify(app)})</script>
</head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:2rem;color:#1c2635">
<p>Opening <strong>${escapeHtml(title)}</strong> in ClickTooling…</p>
<p><a href="${escapeHtml(app)}">Tap here if nothing happens</a></p>
</body>
</html>
`
}
