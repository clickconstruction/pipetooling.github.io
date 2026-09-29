/**
 * Read a contract as the customer sees it (v2.4098): the Contracts & terms card's door to the
 * customer's own page in sample mode — the same pages What customers see renders — with the
 * card's wording found and lit on it. Pure, except `findWordingInDocument`, which walks a DOM
 * the caller hands it.
 */
import { customerJourneys, findStep, type Journey, type JourneyId, type JourneyStep } from '../customerJourneys'
import { SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_JOB_CONTRACT } from '../customerSample'
import type { ContractCatalogEntry, ResolvedContractText } from './customerContractCatalog'

export type ReaderSurface = { journeyId: JourneyId; stepId: string; label: string; step: JourneyStep }

/** The card's surfaces the reader can show — a page, an email or a paper — in the order the card lists them. */
export function readerSurfacesFor(entry: Pick<ContractCatalogEntry, 'seenOn'>, journeys: Journey[] = customerJourneys()): ReaderSurface[] {
  const out: ReaderSurface[] = []
  for (const ref of entry.seenOn) {
    const step = findStep(journeys, ref.journeyId, ref.stepId)
    if (!step) continue
    if (step.render.kind !== 'page' && step.render.kind !== 'email' && step.render.kind !== 'paper') continue
    if (out.some((s) => s.journeyId === ref.journeyId && s.stepId === ref.stepId)) continue
    out.push({ journeyId: ref.journeyId, stepId: ref.stepId, label: step.label, step })
  }
  return out
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Who the sample is, for the band over the frame: the person, the place, and the number the page shows. */
export function readerSampleLine(surface: Pick<ReaderSurface, 'journeyId' | 'stepId'>): string {
  if (surface.journeyId === 'gc') return `${SAMPLE_GC.contact}, ${SAMPLE_GC.company} · Cedar Bend Apartments`
  if (surface.journeyId === 'sub') return "Sam Plumber, Sam's Plumbing LLC"
  if (surface.journeyId === 'homeowner') {
    if (surface.stepId.startsWith('estimate')) return `${SAMPLE_HOMEOWNER.name} · ${SAMPLE_ESTIMATE.title} · ${money(SAMPLE_ESTIMATE.totalCents)}`
    if (surface.stepId.startsWith('job-contract')) return `${SAMPLE_HOMEOWNER.name} · ${SAMPLE_HOMEOWNER.address} · Job ${SAMPLE_JOB_CONTRACT.jobNumber} · ${money(SAMPLE_JOB_CONTRACT.amountCents)}`
    return `${SAMPLE_HOMEOWNER.name} · ${SAMPLE_HOMEOWNER.address}`
  }
  return 'Sample'
}

function stripToText(text: string, format: ResolvedContractText['format']): string {
  // A block's end is a sentence's end: "<h3>Terms</h3><p>Half is due…" reads as two lines, not "Terms Half is due…".
  const raw = format === 'plain' ? text : text.replace(/<\/(p|h[1-6]|li|div|tr|blockquote|pre|dd|dt)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/** A sentence without its number, and without a short label before a colon ("A homeowner signing an agreement: I agree…"). */
function cleanSentence(sentence: string): string {
  const unnumbered = sentence.replace(/^[\d.)\s]+/, '')
  const colon = unnumbered.indexOf(':')
  return colon > 0 && colon <= 48 ? unnumbered.slice(colon + 1).trim() : unnumbered
}

function needleFrom(sentence: string, maxLength: number): string {
  const cleaned = cleanSentence(sentence)
  if (cleaned.length <= maxLength) return cleaned
  const cut = cleaned.slice(0, maxLength)
  const atWord = cut.lastIndexOf(' ')
  return (atWord > 24 ? cut.slice(0, atWord) : cut).trim()
}

/** The end of a long sentence, cut at a word — for a page that prints the sentence with one noun changed near its start. */
function tailNeedleFrom(sentence: string, maxLength: number): string | null {
  const cleaned = cleanSentence(sentence)
  if (cleaned.length <= maxLength) return null
  const cut = cleaned.slice(-maxLength)
  const atWord = cut.indexOf(' ')
  return (atWord >= 0 && atWord < cut.length - 24 ? cut.slice(atWord + 1) : cut).trim()
}

/**
 * Phrases the page can be searched for, best first: the first real sentences of the wording, unnumbered,
 * cut at a word. Several, because a page may carry the wording with one sentence changed (the consent
 * names the document) — the reader tries each until one is on the page.
 */
export function wordingNeedles(text: Pick<ResolvedContractText, 'text' | 'format'>, maxLength = 60, count = 3): string[] {
  const plain = stripToText(text.text, text.format)
  if (!plain) return []
  const sentences = plain.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
  const real = sentences.filter((s) => cleanSentence(s).length >= 24)
  const picked = (real.length > 0 ? real : sentences).slice(0, count)
  const heads = picked.map((s) => needleFrom(s, maxLength))
  const tails = picked.map((s) => tailNeedleFrom(s, maxLength)).filter((t): t is string => t != null)
  return Array.from(new Set([...heads, ...tails].filter(Boolean)))
}

/** The first of `wordingNeedles`; null when there is nothing to find. */
export function wordingNeedle(text: Pick<ResolvedContractText, 'text' | 'format'>, maxLength = 60): string | null {
  return wordingNeedles(text, maxLength, 1)[0] ?? null
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

export const READER_HIT_ATTR = 'data-contract-reader-hit'

const HIT_STYLE = { background: '#fff3bf', boxShadow: '0 0 0 4px #fff3bf', borderRadius: '3px' } as const

/** A block short enough to light whole; a longer one (a terms page in one box) gets only the phrase painted. */
const LIGHT_WHOLE_BLOCK_UP_TO = 400
const HIGHLIGHT_NAME = 'contract-reader'
const HIGHLIGHT_STYLE_ID = 'contract-reader-highlight-style'

export type WordingHit = { element: Element; range: Range | null }

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void }
type HighlightCtor = new (...ranges: Range[]) => unknown

/** The CSS Highlight API, when the page's window has it — it paints a range without touching the DOM. */
function highlightApi(doc: Document): { registry: HighlightRegistry; Highlight: HighlightCtor } | null {
  const w = doc.defaultView as (Window & { CSS?: { highlights?: HighlightRegistry }; Highlight?: HighlightCtor }) | null
  const registry = w?.CSS?.highlights
  const Ctor = w?.Highlight
  return registry && Ctor ? { registry, Highlight: Ctor } : null
}

function clearHits(doc: Document): void {
  for (const el of Array.from(doc.querySelectorAll(`[${READER_HIT_ATTR}]`))) {
    el.removeAttribute(READER_HIT_ATTR)
    const h = el as HTMLElement
    h.style.removeProperty('background-color')
    h.style.removeProperty('box-shadow')
    h.style.removeProperty('border-radius')
  }
  highlightApi(doc)?.registry.delete(HIGHLIGHT_NAME)
}

function light(el: HTMLElement): void {
  el.setAttribute(READER_HIT_ATTR, '')
  el.style.backgroundColor = HIT_STYLE.background
  el.style.boxShadow = HIT_STYLE.boxShadow
  el.style.borderRadius = HIT_STYLE.borderRadius
}

/**
 * The phrase inside a long block, as a Range on the first text node carrying it (whitespace as the page has
 * it). Nothing is inserted or split: a React page owns its text nodes, and a <mark> wrapped around one made
 * the estimate terms page throw on its next render and go blank.
 */
function phraseRange(doc: Document, block: Element, needle: string): Range | null {
  const pattern = new RegExp(needle.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'i')
  const walker = doc.createTreeWalker(block, 4 /* NodeFilter.SHOW_TEXT */)
  let node: Node | null = walker.nextNode()
  while (node) {
    const value = node.nodeValue ?? ''
    const m = pattern.exec(value)
    if (m) {
      const range = doc.createRange()
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      return range
    }
    node = walker.nextNode()
  }
  return null
}

/** Paints the range with the CSS Highlight API; false when the page's browser has none. */
function paintRange(doc: Document, range: Range): boolean {
  const api = highlightApi(doc)
  if (!api) return false
  if (!doc.getElementById(HIGHLIGHT_STYLE_ID)) {
    const style = doc.createElement('style')
    style.id = HIGHLIGHT_STYLE_ID
    style.textContent = `::highlight(${HIGHLIGHT_NAME}){background:${HIT_STYLE.background};color:inherit}`
    doc.head?.appendChild(style)
  }
  api.registry.set(HIGHLIGHT_NAME, new api.Highlight(range))
  return true
}

/**
 * Finds the smallest block on the page that carries one of the needles (tried in order) and lights it —
 * the whole block when it is short, just the phrase when the block is a long one and the browser can paint
 * a range — and returns the hit, or null. Earlier hits are cleared first, so a re-run after the page filled
 * in lands once.
 */
export function findWordingInDocument(doc: Document, needles: string | readonly string[]): WordingHit | null {
  clearHits(doc)
  const list = typeof needles === 'string' ? [needles] : needles
  for (const needle of list) {
    const want = norm(needle)
    if (!want) continue
    let best: Element | null = null
    let bestLen = Number.POSITIVE_INFINITY
    for (const el of Array.from(doc.querySelectorAll('p, li, td, th, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, pre, label, span, div'))) {
      const t = norm(el.textContent ?? '')
      if (!t.includes(want)) continue
      // A tie goes to the later element: the paragraph inside a wrapper that holds nothing else.
      if (t.length <= bestLen) {
        best = el
        bestLen = t.length
      }
    }
    if (!best) continue
    if (bestLen > LIGHT_WHOLE_BLOCK_UP_TO) {
      const range = phraseRange(doc, best, needle)
      if (range && paintRange(doc, range)) {
        best.setAttribute(READER_HIT_ATTR, '')
        return { element: best, range }
      }
    }
    light(best as HTMLElement)
    return { element: best, range: null }
  }
  return null
}

/** Scrolls the page so the hit sits mid-screen: the phrase when there is one, else the block. */
export function revealHit(hit: WordingHit): void {
  const doc = hit.element.ownerDocument
  const win = doc.defaultView
  if (hit.range && win) {
    const r = hit.range.getBoundingClientRect()
    if (r.height > 0 || r.width > 0) {
      win.scrollTo({ top: Math.max(0, r.top + win.scrollY - win.innerHeight / 2) })
      return
    }
  }
  hit.element.scrollIntoView({ block: 'center' })
}
