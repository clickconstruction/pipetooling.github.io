/**
 * Share pages for help guides (v2.3147; a landing page and its own card since
 * v2.4190): a texted `clicktooling.com/g/<slug>/` link unfurls as a rich card
 * in iMessage / WhatsApp / Slack — the guide's own title, its first sentence,
 * a card drawn for that guide — and takes the human into the app at
 * `/help?g=<slug>`. Two kinds of fetcher read it: crawlers that never run
 * JavaScript (Slack, Facebook, WhatsApp) read the tags; Apple's Messages runs
 * a real WebKit, and v2.3147's instant bounce took it to the app shell and
 * then the sign-in page before it read anything — the owner's text showed a
 * bare `clicktooling.com`. So the page is now a real landing page (the title,
 * the first sentence, an Open button) that redirects only a human, after the
 * page has loaded, and never a known preview agent or a hidden tab. The Vite
 * build writes one page — and one 1200×630 card — per guide from these pure
 * helpers (`helpSharePagesPlugin` in vite.config.ts). Same shape as the portal
 * shell (v2.2033) and job-share.
 */

export const HELP_SHARE_PATH_PREFIX = '/g/'
/** The site's card — the fallback when a build could not draw the guide's own. */
export const HELP_SHARE_CARD_IMAGE = '/og-card.png'
export const HELP_SHARE_CARD_WIDTH = 1200
export const HELP_SHARE_CARD_HEIGHT = 630
/** How long a human sees the landing page before it opens the app (ms) — long enough for a preview agent that runs scripts to have read it. */
export const HELP_SHARE_REDIRECT_MS = 1600
/** Preview agents that run JavaScript or say who they are: never redirected, so the card they read is this page's. */
export const HELP_SHARE_PREVIEW_AGENTS = /bot|crawl|spider|preview|fetch|facebookexternalhit|Facebot|Twitterbot|Slackbot|WhatsApp|LinkedInBot|Discordbot|TelegramBot|Applebot|LinkPresentation|Embedly|Iframely|Pinterest|Skype|Viber|Snapchat/i

/** `/g/<slug>/card.png` — the guide's own card, beside its page. */
export function helpShareCardPath(slug: string): string {
  return `${HELP_SHARE_PATH_PREFIX}${slug}/card.png`
}

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
  /** The guide's category, for the landing page's eyebrow. */
  category?: string
  /** The card image's path on the origin — the guide's own `card.png` when the build drew one, else the site card. */
  image?: string
}

/** "How do I split a job into stages…" — the card's title, mirroring the Help page's own heading. */
export function helpShareTitle(title: string): string {
  const t = title.trim().replace(/[.?]+$/, '')
  return `How do I ${t}?`
}

/**
 * One static HTML page: the card tags for every fetcher, a real landing page
 * for whoever reads it, and a redirect only for a human — after load, never
 * for a known preview agent, never in a hidden tab.
 */
export function helpSharePageHtml(page: HelpSharePage): string {
  const origin = page.origin.replace(/\/+$/, '')
  const title = helpShareTitle(page.title)
  const url = helpShareUrl(origin, page.slug)
  const app = `${origin}${helpGuideAppPath(page.slug)}`
  const image = `${origin}${page.image || HELP_SHARE_CARD_IMAGE}`
  const desc = page.description || 'A ClickTooling help guide.'
  const eyebrow = page.category ? `ClickTooling help · ${page.category}` : 'ClickTooling help'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ClickTooling</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:site_name" content="ClickTooling">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${HELP_SHARE_CARD_WIDTH}">
<meta property="og:image:height" content="${HELP_SHARE_CARD_HEIGHT}">
<meta property="og:image:alt" content="${escapeHtml(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta name="twitter:image:alt" content="${escapeHtml(title)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0f172a">
<style>
  body{margin:0;background:#f3f4f6;color:#1c2635;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
  main{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  .eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:0 0 .5rem}
  h1{font-size:1.6rem;line-height:1.25;margin:0 0 .75rem}
  p{margin:0 0 1.25rem;color:#374151}
  .open{display:inline-block;padding:.7rem 1.2rem;border-radius:.6rem;background:#2563eb;color:#fff;font-weight:700;text-decoration:none}
  .fine{font-size:.8rem;color:#6b7280;margin-top:1rem}
</style>
</head>
<body>
<main>
<p class="eyebrow">${escapeHtml(eyebrow)}</p>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(desc)}</p>
<p><a class="open" href="${escapeHtml(app)}" data-open-app>Open in ClickTooling ›</a></p>
<p class="fine">This guide lives inside ClickTooling; it opens there in a moment, and asks you to sign in if you are not already.</p>
</main>
<script>
(function(){
  var app=${JSON.stringify(app)};
  var agents=${HELP_SHARE_PREVIEW_AGENTS.toString()};
  if(agents.test(navigator.userAgent||''))return;
  function go(){if(document.visibilityState==='hidden')return;window.location.replace(app)}
  if(document.readyState==='complete')setTimeout(go,${HELP_SHARE_REDIRECT_MS});
  else window.addEventListener('load',function(){setTimeout(go,${HELP_SHARE_REDIRECT_MS})});
})();
</script>
</body>
</html>
`
}

// ---------- the guide's own card ----------

const CARD_PAD = 80
const CARD_TEXT_WIDTH = HELP_SHARE_CARD_WIDTH - CARD_PAD * 2
/** Average glyph width of a bold sans title, as a fraction of the font size — wide enough that a line never overruns. */
const CARD_GLYPH = 0.56

/** Break a title into lines no wider than the card at the given size (a word longer than a line stands alone). */
export function helpShareCardLines(title: string, fontSize: number, maxWidth = CARD_TEXT_WIDTH): string[] {
  const perLine = Math.max(8, Math.floor(maxWidth / (fontSize * CARD_GLYPH)))
  const lines: string[] = []
  let line = ''
  for (const word of title.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= perLine || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** The biggest of three sizes at which the title fits in four lines. */
export function helpShareCardFit(title: string): { fontSize: number; lines: string[] } {
  for (const fontSize of [66, 56, 48]) {
    const lines = helpShareCardLines(title, fontSize)
    if (lines.length <= 4) return { fontSize, lines }
  }
  const lines = helpShareCardLines(title, 40)
  return { fontSize: 40, lines: lines.slice(0, 5) }
}

const escapeXml = escapeHtml

/**
 * The 1200×630 card as SVG — the app's dark look (the site card's), the
 * wordmark, the category as an eyebrow, the "How do I …?" title wrapped to
 * fit, the share address as the footer. The build rasterises it to PNG
 * (Messages and Twitter do not take SVG cards).
 */
export function helpShareCardSvg(input: { title: string; category?: string; slug: string }): string {
  const title = helpShareTitle(input.title)
  const { fontSize, lines } = helpShareCardFit(title)
  const lineHeight = Math.round(fontSize * 1.16)
  const block = lines.length * lineHeight
  const top = Math.max(200, Math.round((HELP_SHARE_CARD_HEIGHT - block) / 2) + 20)
  const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  const tspans = lines.map((l, i) => `<tspan x="${CARD_PAD}" y="${top + i * lineHeight}">${escapeXml(l)}</tspan>`).join('')
  const eyebrow = ['Help guide', input.category?.trim()].filter(Boolean).join(' · ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HELP_SHARE_CARD_WIDTH}" height="${HELP_SHARE_CARD_HEIGHT}" viewBox="0 0 ${HELP_SHARE_CARD_WIDTH} ${HELP_SHARE_CARD_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
<rect width="${HELP_SHARE_CARD_WIDTH}" height="${HELP_SHARE_CARD_HEIGHT}" fill="#0f172a"/>
<rect x="0" y="0" width="${HELP_SHARE_CARD_WIDTH}" height="10" fill="#2563eb"/>
<g font-family="${font}">
<text x="${CARD_PAD}" y="96" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="-0.5">Click<tspan fill="#60a5fa">Tooling</tspan></text>
<text x="${CARD_PAD}" y="150" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="3" style="text-transform:uppercase">${escapeXml(eyebrow.toUpperCase())}</text>
<text font-size="${fontSize}" font-weight="800" fill="#ffffff" letter-spacing="-1">${tspans}</text>
<text x="${CARD_PAD}" y="${HELP_SHARE_CARD_HEIGHT - 56}" font-size="24" fill="#64748b">clicktooling.com${HELP_SHARE_PATH_PREFIX}${escapeXml(input.slug)}/</text>
</g>
</svg>`
}
