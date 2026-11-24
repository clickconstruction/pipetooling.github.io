/**
 * One print job for the run: the notices' packet, a divider page, then the affidavits (punch list #362, step 6).
 *
 * The owner's answer of 2026-11-16 was *one press, one stack*. The two papers are two print documents with two
 * layouts: the notices print on the printer's own margins inside a body 44rem wide, and the affidavits print on a
 * page with no margin and carry their own gap on every sheet, so the short form fits its sheet. A legal paper may not
 * move, so nothing here redraws either. It lifts each document's styles and body as they are and gives each its own
 * named page:
 *
 *   - every `body { … }` rule becomes a rule on the part's wrapper, so each part keeps the body it was laid out in;
 *   - the affidavits' `@page { … margin: 0 }` becomes `@page lienStackAffidavits`, and their wrapper sits on that
 *     page, so the notices keep the printer's margins and the affidavits keep none.
 *
 * Measured in Chromium, 2026-11-24: every word of every page sits where it sits when each paper prints alone, with
 * the printer's margins at 0 and at 0.4 in. That holds only where the browser honours a named page, so a caller asks
 * `lienStackBrowserCan()` first and offers the two prints where it cannot.
 *
 * The merge refuses what it does not know (`lienStackParts` answers null): a document with more than one style block,
 * a style block in its body, or a rule on a bare element other than `body` and `html`. Either shell changing shape
 * then fails `lienRunStack.test.ts`, which merges the real documents, and never prints a paper that moved.
 *
 * Pure: two documents in, one out. With one part alone the answer is that part's own document, byte for byte.
 */
import { val } from '../valuesInPlace'

export const LIEN_STACK_CLASS = { notices: 'lienStackNotices', affidavits: 'lienStackAffidavits', divider: 'lienStackDivider' } as const
const AFFIDAVIT_PAGE = 'lienStackAffidavits'

export type LienStackParts = { css: string; body: string; links: string }

/** The selectors a part may put on a bare element: its body and the page. Anything else could reach the other paper. */
const KNOWN_BARE = /^(body|html|section \+ section)$/

/** The selectors of a style sheet, at any depth, with the at-rules named as they are written. */
function selectorsOf(css: string): string[] {
  const out: string[] = []
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of plain.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1]!.trim()
    if (sel) out.push(sel)
  }
  return out
}

/**
 * A print document's styles and body, or null when it is not the shape the merge knows: one style block in the head,
 * none in the body, and no rule on a bare element but `body`, `html` and the packet's `section + section`.
 */
export function lienStackParts(html: string): LienStackParts | null {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)
  const body = /<body>([\s\S]*)<\/body>/.exec(html)
  if (!head || !body) return null
  const styles = [...head[1]!.matchAll(/<style>([\s\S]*?)<\/style>/g)]
  if (styles.length !== 1) return null
  if (/<style[\s>]/.test(body[1]!)) return null
  const css = styles[0]![1]!
  for (const sel of selectorsOf(css)) {
    if (sel.startsWith('@')) {
      if (!/^@(page|media (print|all))$/.test(sel)) return null
      continue
    }
    for (const one of sel.split(',')) {
      const s = one.trim()
      if (s.startsWith('.')) continue
      if (!KNOWN_BARE.test(s)) return null
    }
  }
  const links = [...head[1]!.matchAll(/<link[^>]*>/g)].map((m) => m[0]).join('')
  return { css, body: body[1]!, links }
}

/** A part's styles with its body's rules moved onto its wrapper, and its page named when it has one of its own. */
function scoped(css: string, wrapper: string, page: string | null): string {
  const onWrapper = css.replace(/(?<![\w-])body\s*\{/g, `.${wrapper} {`)
  return page ? onWrapper.replace(/@page\s*\{/g, `@page ${page} {`) : onWrapper
}

export type LienStackDivider = {
  /** The line under the head: what follows this page. */
  lead: string
  /** One line a fact, under the lead. */
  lines: ReadonlyArray<string>
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The words on the page between the two papers. An office sheet, in no job's filed copy: it says where the notices
 * end and what the affidavits behind it need.
 */
export function lienStackDividerWords(input: { notices: number; affidavits: number; dayWords: string }): LienStackDivider {
  const n = input.notices
  const a = input.affidavits
  return {
    lead: `${a} lien ${a === 1 ? 'affidavit follows' : 'affidavits follow'} this page, in county clerk order.`,
    lines: [
      `The ${n === 1 ? 'notice' : `${n} notices`} before this page ${n === 1 ? 'goes in its envelopes' : 'go in their envelopes'}.`,
      'The papers after it are signed before a notary, then filed with the county clerk.',
      `Printed ${input.dayWords}.`,
    ],
  }
}

function dividerHtml(d: LienStackDivider): string {
  return `<div class="${LIEN_STACK_CLASS.divider}"><div class="lienStackBand"></div><h1>Lien affidavits</h1><p class="lienStackLead">${esc(d.lead)}</p>${d.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`
}

const DIVIDER_CSS = `
  .${LIEN_STACK_CLASS.divider} { break-before: page; page-break-before: always; font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 44rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.6; }
  .${LIEN_STACK_CLASS.divider} .lienStackBand { height: 16px; background: #111; margin: 0 0 18px; }
  .${LIEN_STACK_CLASS.divider} h1 { font-size: 1.6rem; margin: 0 0 10px; }
  .${LIEN_STACK_CLASS.divider} .lienStackLead { font-size: 1.1rem; font-weight: 700; margin: 0 0 12px; }
  .${LIEN_STACK_CLASS.divider} p { margin: 0 0 6px; }
  @media print { .${LIEN_STACK_CLASS.divider} { margin: 0.5in auto; } }`

export type LienRunStackInput = {
  /** The notices' packet as it prints alone, or null when no notice prints. */
  noticesHtml: string | null
  /** The affidavits' batch as it prints alone, or null when no affidavit prints. */
  affidavitsHtml: string | null
  divider: LienStackDivider
  title: string
}

/**
 * The run's one document. One part alone is that part's own document, unchanged. Both parts merge, or the answer is
 * null when either is not the shape the merge knows, and the caller prints them one at a time.
 */
export function lienRunStackHtml(input: LienRunStackInput): string | null {
  const { noticesHtml, affidavitsHtml } = input
  if (!noticesHtml && !affidavitsHtml) return null
  if (!noticesHtml) return affidavitsHtml
  if (!affidavitsHtml) return noticesHtml
  const n = lienStackParts(noticesHtml)
  const a = lienStackParts(affidavitsHtml)
  if (!n || !a) return null
  const css = [
    'html, body { margin: 0; padding: 0; background: #fff; }',
    scoped(n.css, LIEN_STACK_CLASS.notices, null),
    `.${LIEN_STACK_CLASS.affidavits} { page: ${AFFIDAVIT_PAGE}; }`,
    scoped(a.css, LIEN_STACK_CLASS.affidavits, AFFIDAVIT_PAGE),
    DIVIDER_CSS,
  ].join('\n')
  const links = n.links === a.links ? n.links : n.links + a.links
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(input.title)}</title>${links}
<style>
${css}
</style></head><body><div class="${LIEN_STACK_CLASS.notices}">${n.body}</div>${dividerHtml(input.divider)}<div class="${LIEN_STACK_CLASS.affidavits}">${a.body}</div></body></html>`
}

/** Whether this browser gives a named page its own margins: without it the two papers cannot share one print job. */
export function lienStackBrowserCan(supports: ((property: string, value: string) => boolean) | null | undefined = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? (p, v) => CSS.supports(p, v) : null): boolean {
  try {
    return Boolean(supports?.('page', AFFIDAVIT_PAGE))
  } catch {
    return false
  }
}

/**
 * The stack's order as one sentence for the screen, each count a value: *One stack, in this order: 6 notices by
 * envelope, a divider page, then 10 affidavits by county clerk.* Where the two kinds print apart (`stacked` false) it
 * says so: *Two prints: 6 notices by envelope, then 10 affidavits by county clerk.*
 */
export function lienStackOrderWords(notices: number, affidavits: number, stacked = true): string {
  const n = notices > 0 ? `${val('count', String(notices))} ${notices === 1 ? 'notice' : 'notices'} by envelope` : ''
  const a = affidavits > 0 ? `${val('count', String(affidavits))} ${affidavits === 1 ? 'affidavit' : 'affidavits'} by county clerk` : ''
  if (n && a) return stacked ? `One stack, in this order: ${n}, a divider page, then ${a}.` : `Two prints: ${n}, then ${a}.`
  return n || a ? `One stack: ${n || a}.` : ''
}
