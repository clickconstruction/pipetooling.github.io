/**
 * Illustration tokens for /help guides — authors write lightweight tokens in
 * markdown and the renderer expands them into pixel-faithful mock UI (buttons,
 * chips, header icons, framed example panels) styled like the real app.
 *
 * Author syntax:
 *   {{button:<variant>|<label>}}   variants: blue green amber red gray outline outline-blue outline-amber
 *   {{chip:<variant>|<label>}}     variants: red green yellow blue gray
 *   {{icon:<name>}}                names: help gear
 *   {{gif:<filename>|<caption>}}   screen recording from public/help/ (lazy-loaded,
 *                                  NOT precached — needs connectivity, unlike the mocks)
 *   :::example <caption>           framed panel that looks like an app card
 *   …markdown…                     (regular markdown inside)
 *   :::
 *
 * How it works: tokens are URI-encoded into `[[[help-ill|…]]]` text markers
 * BEFORE marked runs, so they ride through markdown + the sanitizer as plain
 * text; expansion happens LAST and emits only fixed templates with escaped
 * labels — author input can never smuggle attributes or tags through.
 */

const MARKER_PATTERN = /\[\[\[help-(?:ill|panel-open|panel-close)[^\]]*\]\]\]/g

const BUTTON_STYLES: Record<string, string> = {
  blue: 'background:#2563eb;color:white;border:none;',
  green: 'background:#16a34a;color:white;border:none;',
  amber: 'background:#d97706;color:white;border:none;',
  red: 'background:#dc2626;color:white;border:none;',
  gray: 'background:#9ca3af;color:white;border:none;',
  outline: 'background:white;color:#1f2937;border:1px solid #d1d5db;',
  'outline-blue': 'background:white;color:#1d4ed8;border:1px solid #93c5fd;',
  'outline-amber': 'background:white;color:#b45309;border:1px solid #fcd34d;',
}

const CHIP_STYLES: Record<string, string> = {
  red: 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;',
  green: 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;',
  yellow: 'background:#fffbeb;color:#b45309;border:1px solid #fcd34d;',
  blue: 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;',
  gray: 'background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;',
}

/** Header icons guides reference (paths copied from Layout.tsx). */
const ICON_PATHS: Record<string, string> = {
  help: 'M224 224C224 171 267 128 320 128C373 128 416 171 416 224C416 266.7 388.1 302.9 349.5 315.4C321.1 324.6 288 350.7 288 392L288 416C288 433.7 302.3 448 320 448C337.7 448 352 433.7 352 416L352 392C352 390.3 352.6 387.9 355.5 384.7C358.5 381.4 363.4 378.2 369.2 376.3C433.5 355.6 480 295.3 480 224C480 135.6 408.4 64 320 64C231.6 64 160 135.6 160 224C160 241.7 174.3 256 192 256C209.7 256 224 241.7 224 224zM320 576C342.1 576 360 558.1 360 536C360 513.9 342.1 496 320 496C297.9 496 280 513.9 280 536C280 558.1 297.9 576 320 576z',
  gear: 'M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z',
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
  return markdown
    .replace(MARKER_PATTERN, '') // defensive: authored text can't smuggle markers
    .replace(/^:::example[ \t]*(.*)$/gm, (_m, caption: string) => {
      return `[[[help-panel-open|${encodeURIComponent(caption.trim())}]]]`
    })
    .replace(/^:::[ \t]*$/gm, '[[[help-panel-close]]]')
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
    ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:0.3rem;">${escapeHtml(caption.trim())}</div>`
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

const PANEL_OPEN_HTML = (caption: string) =>
  `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:0.75rem 1rem;margin:0.75rem 0;">` +
  `<div style="font-size:0.7rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">` +
  `${caption ? `Example — ${escapeHtml(caption)}` : 'Example'}</div>`

/**
 * Expand markers into fixed HTML templates. Runs LAST, on sanitized HTML —
 * everything emitted here is template-authored; labels are escaped.
 */
export function expandHelpIllustrations(html: string): string {
  return html
    // Block markers end up wrapped in <p> by marked; unwrap so the divs nest cleanly.
    .replace(/<p>\s*(\[\[\[help-panel-(?:open\|[^\]]*|close)\]\]\])\s*<\/p>/g, '$1')
    .replace(/<p>\s*(\[\[\[help-ill\|gif,[^\]]*\]\]\])\s*<\/p>/g, '$1')
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
