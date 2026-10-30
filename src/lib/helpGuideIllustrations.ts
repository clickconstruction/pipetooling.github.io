/**
 * Illustration tokens for /help guides — authors write lightweight tokens in
 * markdown and the renderer expands them into pixel-faithful mock UI (buttons,
 * chips, header icons, framed example panels) styled like the real app.
 *
 * Author syntax:
 *   {{button:<variant>|<label>}}   variants: blue green amber red purple gray outline outline-blue outline-amber
 *   {{chip:<variant>|<label>}}     variants: red green yellow blue purple gray
 *   {{icon:<name>}}                names: help gear search
 *   {{gif:<filename>|<caption>}}   screen recording from public/help/ (lazy-loaded,
 *                                  NOT precached — needs connectivity, unlike the mocks)
 *   :::example <caption>           framed panel that looks like an app card
 *   …markdown…                     (regular markdown inside)
 *   :::
 *   :::cards … :::                 (v2.5747) a grid of cards; inside it, each card is
 *   :::card <title> … :::            a titled card, which may hold
 *   :::tryit … :::                   a Try it line (the eyebrow TRY IT over the words) and
 *   :::fold <summary> … :::          a fold, closed until pressed (More by default)
 *   :::steps … :::                 a numbered list drawn with big numerals
 *   :::ring … :::                  the robot's ring, seven segments the reader taps through
 *   Blocks nest; every open has its own `:::` close, innermost first.
 *
 * How it works: tokens are URI-encoded into `[[[help-ill|…]]]` text markers
 * BEFORE marked runs, so they ride through markdown + the sanitizer as plain
 * text; expansion happens LAST and emits only fixed templates with escaped
 * labels — author input can never smuggle attributes or tags through.
 */

import { HEARTBEAT_STEPS, HEARTBEAT_STEP_WORDS } from '../../supabase/functions/_shared/twinHeartbeat'

const MARKER_PATTERN = /\[\[\[help-(?:ill|panel-open|panel-close|block-open|block-close)[^\]]*\]\]\]/g

/** The block fences a guide may open (`:::<kind> <caption>`); the conformance test refuses any other. */
export const BLOCK_KINDS = ['example', 'cards', 'card', 'tryit', 'fold', 'steps', 'ring'] as const
export type HelpBlockKind = (typeof BLOCK_KINDS)[number]

/**
 * The example panel's ground and its caption's ink, and the grey mock button's pair (punch list #194, v2.6085). The
 * panel pins itself light, so these are literals: the caption read 2.43:1 as `#9ca3af`, and reads 4.63:1 as the light
 * theme's muted text; the grey button is the app's dead press in light (`deadPress.ts`, 8.33:1). `readablePairs.test.ts`
 * holds both.
 */
export const GUIDE_PANEL_GROUND = '#f9fafb'
export const GUIDE_CAPTION_INK = '#6b7280'
export const GUIDE_DEAD_BUTTON = { fill: '#e5e7eb', ink: '#374151' } as const

const BUTTON_STYLES: Record<string, string> = {
  blue: 'background:#2563eb;color:white;border:none;',
  green: 'background:#16a34a;color:white;border:none;',
  amber: 'background:#d97706;color:white;border:none;',
  red: 'background:#dc2626;color:white;border:none;',
  purple: 'background:#7c3aed;color:white;border:none;',
  gray: `background:${GUIDE_DEAD_BUTTON.fill};color:${GUIDE_DEAD_BUTTON.ink};border:none;`,
  // v2.4329: the selected In order on the Bill tab's stage switch — the theme's strongest ink, so it reads in both themes.
  dark: 'background:var(--text-strong);color:var(--surface);border:none;',
  outline: 'background:white;color:#1f2937;border:1px solid var(--border-strong);',
  'outline-blue': 'background:white;color:#1d4ed8;border:1px solid #93c5fd;',
  'outline-amber': 'background:white;color:#b45309;border:1px solid #fcd34d;',
}

const CHIP_STYLES: Record<string, string> = {
  red: 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;',
  green: 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;',
  yellow: 'background:#fffbeb;color:#b45309;border:1px solid #fcd34d;',
  blue: 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;',
  purple: 'background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;',
  gray: 'background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;',
}

/**
 * Valid token variants, for the guide conformance test — renderButton/renderChip
 * fall back silently (outline/gray) on unknown variants, so authoring typos are
 * only catchable by validating the source tokens.
 */
export const BUTTON_VARIANTS = Object.keys(BUTTON_STYLES)
export const CHIP_VARIANTS = Object.keys(CHIP_STYLES)

/** Header icons guides reference (paths copied from Layout.tsx / HeaderGlobalSearch.tsx). */
const ICON_PATHS: Record<string, string> = {
  help: 'M224 224C224 171 267 128 320 128C373 128 416 171 416 224C416 266.7 388.1 302.9 349.5 315.4C321.1 324.6 288 350.7 288 392L288 416C288 433.7 302.3 448 320 448C337.7 448 352 433.7 352 416L352 392C352 390.3 352.6 387.9 355.5 384.7C358.5 381.4 363.4 378.2 369.2 376.3C433.5 355.6 480 295.3 480 224C480 135.6 408.4 64 320 64C231.6 64 160 135.6 160 224C160 241.7 174.3 256 192 256C209.7 256 224 241.7 224 224zM320 576C342.1 576 360 558.1 360 536C360 513.9 342.1 496 320 496C297.9 496 280 513.9 280 536C280 558.1 297.9 576 320 576z',
  gear: 'M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z',
  search:
    'M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Replace author tokens with text markers that survive marked + the sanitizer.
 * Runs on raw markdown BEFORE marked.
 */
export function encodeHelpIllustrations(markdown: string): string {
  // Fences, line by line with a stack, so a close knows which kind it closes (a fold ends in </details>).
  const stack: HelpBlockKind[] = []
  const fenced = markdown
    .replace(MARKER_PATTERN, '') // defensive: authored text can't smuggle markers
    .split('\n')
    .map((line) => {
      const open = /^:::([a-z]+)[ \t]*(.*)$/.exec(line)
      if (open && (BLOCK_KINDS as readonly string[]).includes(open[1]!)) {
        const kind = open[1] as HelpBlockKind
        stack.push(kind)
        const caption = encodeURIComponent((open[2] ?? '').trim())
        return kind === 'example' ? `[[[help-panel-open|${caption}]]]` : `[[[help-block-open|${kind},${caption}]]]`
      }
      if (/^:::[ \t]*$/.test(line)) {
        const kind = stack.pop() ?? 'example'
        return kind === 'example' ? '[[[help-panel-close]]]' : `[[[help-block-close|${kind}]]]`
      }
      return line
    })
    .join('\n')
  return fenced
    .replace(/\{\{(button|chip|icon|gif):([a-z0-9._-]+)(?:\|([^}]*))?\}\}/gi, (_m, kind: string, variant: string, label?: string) => {
      const payload = [kind.toLowerCase(), variant, label ?? ''].map((p) => encodeURIComponent(p)).join(',')
      return `[[[help-ill|${payload}]]]`
    })
}

function renderButton(variant: string, label: string): string {
  const style = BUTTON_STYLES[variant] ?? BUTTON_STYLES.outline!
  return (
    `<span style="display:inline-block;${style}padding:0.3rem 0.75rem;border-radius:6px;` +
    `font-size:0.85em;font-weight:600;line-height:1.25;">${escapeHtml(label)}</span>`
  )
}

function renderChip(variant: string, label: string): string {
  const style = CHIP_STYLES[variant] ?? CHIP_STYLES.gray!
  return (
    `<span style="display:inline-block;${style}padding:0.1rem 0.6rem;border-radius:999px;` +
    `font-size:0.8em;font-weight:600;line-height:1.4;">${escapeHtml(label)}</span>`
  )
}

/** Screen recordings live in public/help/; filename is allowlist-validated (no paths). */
function renderGif(filename: string, caption: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*\.gif$/i.test(filename) || filename.includes('..')) return ''
  const captionHtml = caption.trim()
    ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">${escapeHtml(caption.trim())}</div>`
    : ''
  return (
    `<div style="margin:0.75rem 0;">` +
    `<img src="/help/${filename}" alt="${escapeHtml(caption.trim() || 'Screen recording')}" loading="lazy" ` +
    `style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;display:block;" />` +
    `${captionHtml}</div>`
  )
}

function renderIcon(name: string): string {
  const path = ICON_PATHS[name]
  if (!path) return ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" ` +
    `fill="currentColor" aria-hidden="true" style="vertical-align:-0.15em;">` +
    `<path d="${path}" /></svg>`
  )
}

// The panel is drawn light (an app card on a light page). v2.4329: `data-theme="light"` pins what is inside it
// to the light tokens too; without it the dark theme's pale text sat on the light panel and could not be read.
const PANEL_OPEN_HTML = (caption: string) =>
  `<div data-theme="light" style="border:1px solid #e5e7eb;border-radius:8px;background:${GUIDE_PANEL_GROUND};padding:0.75rem 1rem;margin:0.75rem 0;">` +
  `<div style="font-size:0.7rem;font-weight:700;color:${GUIDE_CAPTION_INK};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">` +
  `${caption ? `Example — ${escapeHtml(caption)}` : 'Example'}</div>`

// The robot's ring (v2.5747): seven arcs around the icon, the same seven steps the Bid Board's ring fills, drawn
// here so a guide can let the reader tap through them (`helpGuideRing.ts` moves it; GuideBrowser routes the press).
const RING_STEP_WORDS = HEARTBEAT_STEPS.map((k) => HEARTBEAT_STEP_WORDS[k])
const RING_ARCS = (() => {
  const n = RING_STEP_WORDS.length
  const cx = 48
  const cy = 48
  const r = 38
  const gap = 6
  const span = 360 / n - gap
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`
  }
  const arcs: string[] = []
  for (let i = 0; i < n; i += 1) {
    const a0 = i * (360 / n) + gap / 2
    const a1 = a0 + span
    arcs.push(`<path class="help-ring-seg" data-seg="${i}" d="M ${point(a0)} A ${r} ${r} 0 0 1 ${point(a1)}" fill="none" stroke-width="10" />`)
  }
  return arcs.join('')
})()

function renderRing(): string {
  const chips = RING_STEP_WORDS.map((w, i) => `<li data-step="${i}">${escapeHtml(w)}</li>`).join('')
  return (
    `<div class="help-ring" data-at="0">` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="The robot's ring, seven segments">${RING_ARCS}` +
    `<text x="48" y="56" text-anchor="middle" font-size="22">🤖</text></svg>` +
    `<div><p class="help-ring-word" data-ring-word>Nothing yet</p>` +
    `<p class="help-ring-sub" data-ring-sub>Each tap is one step of the robot’s work. Seven taps is a sealed number.</p>` +
    `<button type="button" data-help-ring="next">Next step</button><button type="button" data-help-ring="reset">Start over</button>` +
    `<ul class="help-ring-steps" aria-label="The seven steps">${chips}</ul></div>`
  )
}

function blockOpen(kind: string, caption: string): string {
  switch (kind) {
    case 'cards':
      return '<div class="help-cards">'
    case 'card':
      return `<div class="help-card"><div class="help-card-title">${escapeHtml(caption)}</div>`
    case 'tryit':
      return '<div class="help-tryit"><span class="help-eyebrow">Try it</span>'
    case 'fold':
      return `<details class="help-fold"><summary>${escapeHtml(caption || 'More')}</summary><div class="help-fold-body">`
    case 'steps':
      return '<div class="help-steps">'
    case 'ring':
      return renderRing()
    default:
      return ''
  }
}

function blockClose(kind: string): string {
  if (kind === 'fold') return '</div></details>'
  return (BLOCK_KINDS as readonly string[]).includes(kind) ? '</div>' : ''
}

/**
 * Expand markers into fixed HTML templates. Runs LAST, on sanitized HTML —
 * everything emitted here is template-authored; labels are escaped.
 */
export function expandHelpIllustrations(html: string): string {
  return html
    // Block markers end up wrapped in <p> by marked; unwrap so the divs nest cleanly.
    .replace(/<p>\s*(\[\[\[help-panel-(?:open\|[^\]]*|close)\]\]\])\s*<\/p>/g, '$1')
    .replace(/<p>\s*(\[\[\[help-block-(?:open|close)\|[^\]]*\]\]\])\s*<\/p>/g, '$1')
    .replace(/<p>\s*(\[\[\[help-ill\|gif,[^\]]*\]\]\])\s*<\/p>/g, '$1')
    .replace(/\[\[\[help-block-open\|([a-z]+),([^\]]*)\]\]\]/g, (_m, kind: string, enc: string) => {
      let caption = ''
      try {
        caption = decodeURIComponent(enc)
      } catch {
        caption = ''
      }
      return blockOpen(kind, caption)
    })
    .replace(/\[\[\[help-block-close\|([a-z]+)\]\]\]/g, (_m, kind: string) => blockClose(kind))
    .replace(/\[\[\[help-panel-open\|([^\]]*)\]\]\]/g, (_m, enc: string) => {
      let caption = ''
      try {
        caption = decodeURIComponent(enc)
      } catch {
        caption = ''
      }
      return PANEL_OPEN_HTML(caption)
    })
    .replace(/\[\[\[help-panel-close\]\]\]/g, '</div>')
    .replace(/\[\[\[help-ill\|([^\]]*)\]\]\]/g, (_m, payload: string) => {
      const parts = payload.split(',')
      let kind = ''
      let variant = ''
      let label = ''
      try {
        kind = decodeURIComponent(parts[0] ?? '')
        variant = decodeURIComponent(parts[1] ?? '')
        label = decodeURIComponent(parts[2] ?? '')
      } catch {
        return ''
      }
      if (kind === 'button') return renderButton(variant, label)
      if (kind === 'chip') return renderChip(variant, label)
      if (kind === 'icon') return renderIcon(variant)
      if (kind === 'gif') return renderGif(variant, label)
      return escapeHtml(label)
    })
}
