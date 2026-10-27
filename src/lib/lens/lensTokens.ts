/**
 * The theme's tokens, read the way src/index.css declares them (punch list #194): the light block
 * (`:root, [data-theme='light']`) and the dark block (`:root[data-theme='dark']`), each a list of
 * `--name: value` in order. The `virtual:lens-tokens` plugin runs this over index.css at build time,
 * so the theme draft always starts from the shipped values. And the draft's two outputs: the CSS a
 * frame gets while a draft is on, and the patch for index.css a PR takes. Pure.
 */

export type ThemeName = 'light' | 'dark'
export type TokenBlock = { name: string; value: string }[]
export type ThemeTokens = Record<ThemeName, TokenBlock>
export type ThemeDraft = Record<ThemeName, Record<string, string>>

const LIGHT_SELECTOR = /^:root\s*,\s*\[data-theme=(['"])light\1\]$/
const DARK_SELECTOR = /^:root\[data-theme=(['"])dark\1\]$/

/** Strip comments, keeping offsets readable for the block scan. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

function declarations(body: string): TokenBlock {
  const out: TokenBlock = []
  for (const part of body.split(';')) {
    const m = part.match(/^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/i)
    if (m) out.push({ name: m[1]!, value: m[2]!.replace(/\s+/g, ' ') })
  }
  return out
}

/** The light and dark token blocks of a stylesheet. A name declared twice keeps its last value. */
export function parseThemeTokens(cssText: string): ThemeTokens {
  const css = stripComments(cssText)
  const out: ThemeTokens = { light: [], dark: [] }
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ')
    const theme: ThemeName | null = LIGHT_SELECTOR.test(selector) ? 'light' : DARK_SELECTOR.test(selector) ? 'dark' : null
    if (!theme) continue
    for (const d of declarations(m[2] ?? '')) {
      const at = out[theme].findIndex((x) => x.name === d.name)
      if (at >= 0) out[theme][at] = d
      else out[theme].push(d)
    }
  }
  return out
}

/** The CSS a frame gets while a draft is on: each theme's changed tokens, over the shipped ones. */
export function draftCss(draft: ThemeDraft): string {
  const block = (sel: string, vals: Record<string, string>) => {
    const keys = Object.keys(vals)
    return keys.length ? `${sel} { ${keys.map((k) => `${k}: ${vals[k]} !important;`).join(' ')} }` : ''
  }
  return [block("[data-theme='light']", draft.light), block(":root[data-theme='dark']", draft.dark)].filter(Boolean).join('\n')
}

/** The patch for src/index.css: each changed token with the value it replaces. */
export function draftPatch(draft: ThemeDraft, tokens: ThemeTokens): string {
  const was = (theme: ThemeName, name: string) => tokens[theme].find((t) => t.name === name)?.value ?? '(new)'
  const block = (theme: ThemeName, sel: string) => {
    const keys = Object.keys(draft[theme])
    return keys.length ? `${sel} {\n${keys.map((k) => `  ${k}: ${draft[theme][k]}; /* was ${was(theme, k)} */`).join('\n')}\n}\n` : ''
  }
  const body = block('light', ":root,\n[data-theme='light']") + block('dark', ":root[data-theme='dark']")
  return body ? `/* src/index.css: a theme draft from What everyone sees */\n${body}` : ''
}

/** The pairs a draft must keep readable, each foreground on its background, with the floor it must clear. */
export const DRAFT_PAIRS: readonly { label: string; fg: string; bg: string; floor: number }[] = [
  { label: 'Body text on a card', fg: '--text-base', bg: '--surface', floor: 4.5 },
  { label: 'Muted text on a card', fg: '--text-muted', bg: '--surface', floor: 4.5 },
  { label: 'Muted text on the page', fg: '--text-muted', bg: '--bg-page', floor: 4.5 },
  { label: 'A link on a card', fg: '--text-link', bg: '--surface', floor: 4.5 },
  { label: 'The top bar', fg: '--chrome-text', bg: '--chrome-bg', floor: 4.5 },
  { label: 'Amber words on amber', fg: '--text-amber-800', bg: '--bg-amber-tint', floor: 4.5 },
  { label: 'Red words on red', fg: '--text-red-700', bg: '--bg-red-tint', floor: 4.5 },
  { label: 'Green words on green', fg: '--text-green-700', bg: '--bg-green-tint', floor: 4.5 },
]

/** Where a token sits in the draft panel, by its name. */
export function tokenGroup(name: string): string {
  if (name.startsWith('--chrome-') || name === '--menu-bg') return 'Top bar and menus'
  if (/^--text-/.test(name)) return 'Text'
  if (/^--border/.test(name)) return 'Lines'
  if (/^--bg-[a-z]+-(tint|100|200)$/.test(name) || name === '--bg-cream') return 'Tints'
  if (/^--(bg-page|surface|bg-subtle|bg-muted|bg-200)$/.test(name)) return 'Page and surfaces'
  if (name.startsWith('--bid-mark')) return 'Bid marks'
  if (name.startsWith('--timeline-')) return 'Timeline'
  if (name.startsWith('--man-hours-')) return 'Hours'
  return 'Other'
}

export const TOKEN_GROUP_ORDER = ['Page and surfaces', 'Text', 'Lines', 'Top bar and menus', 'Tints', 'Bid marks', 'Timeline', 'Hours', 'Other'] as const

/** `#rgb` or `#rrggbb` as a color input reads it, or null for anything else (rgba, var, a keyword). */
export function hexOf(value: string | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}

export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
}

/** Put a draft into a frame's document as one style sheet, replace it, or take it out when empty. */
export function applyDraftStyle(doc: Document | null | undefined, css: string): void {
  if (!doc?.head) return
  let el = doc.querySelector('style[data-lens-draft]')
  if (!css) {
    el?.remove()
    return
  }
  if (!el) {
    el = doc.createElement('style')
    el.setAttribute('data-lens-draft', '')
    doc.head.appendChild(el)
  }
  el.textContent = css
}
