import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pageTabStyle } from '../pageTabStyle'
import { BID_DETAIL_CLOSE_FLOAT_WIDTH, HIGHLIGHTED_TABS, SAFETY_ORANGE, bidDetailCloseFloatMobileStyle, bidsTabStyle, tabStyle } from './bidStyles'

const BIDS_COMPONENTS = resolve(__dirname, '../../components/bids')
const bidComponentSources = readdirSync(BIDS_COMPONENTS)
  .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
  .map((f) => ({ file: f, src: readFileSync(resolve(BIDS_COMPONENTS, f), 'utf8') }))

/** A CSS length in rem: '2rem' → 2, 0 → 0. Anything else fails the test that reads it. */
function remOf(v: string | number | undefined): number {
  if (v === 0 || v === '0') return 0
  const m = typeof v === 'string' ? /^(\d+(?:\.\d+)?)rem$/.exec(v.trim()) : null
  if (!m) throw new Error(`not a rem length: ${String(v)}`)
  return Number(m[1])
}

/** The right side of a padding shorthand: '1.5rem 2rem' → '2rem', '1rem' → '1rem'. */
function rightOf(padding: string): string {
  const parts = padding.trim().split(/\s+/)
  return parts.length === 1 ? parts[0]! : parts[1]!
}

const TABS = ['bid-board', 'counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submittals', 'rfi']

describe('Bids tab styles', () => {
  it('never set the background shorthand — it would reset the clip that keeps the pill slim', () => {
    for (const tab of TABS) {
      for (const active of [true, false]) {
        const style = bidsTabStyle(active, tab) as Record<string, unknown>
        expect('background' in style, `${tab} ${active ? 'open' : 'closed'}`).toBe(false)
        expect(style.backgroundClip).toBe('padding-box')
        expect(typeof style.backgroundColor).toBe('string')
      }
    }
    expect('background' in (tabStyle(true) as Record<string, unknown>)).toBe(false)
  })

  it('the three highlighted tabs fill orange when open and read orange when closed', () => {
    expect([...HIGHLIGHTED_TABS]).toEqual(['counts', 'pricing', 'cover-letter'])
    for (const tab of HIGHLIGHTED_TABS) {
      const open = bidsTabStyle(true, tab) as Record<string, unknown>
      expect(open.backgroundColor).toBe(SAFETY_ORANGE)
      expect(open.color).toBe('white')
      const closed = bidsTabStyle(false, tab) as Record<string, unknown>
      expect(closed.backgroundColor).toBe('transparent')
      expect(closed.color).toBe(SAFETY_ORANGE)
      expect(closed.fontWeight).toBe(600)
    }
  })

  it('every other tab is the plain Bids tab', () => {
    for (const tab of ['bid-board', 'takeoffs', 'labor', 'submittals']) {
      expect(bidsTabStyle(true, tab)).toEqual(tabStyle(true))
      expect(bidsTabStyle(false, tab)).toEqual(tabStyle(false))
    }
  })

  it('an open orange tab differs from an open blue one by its fill alone', () => {
    const { backgroundColor: orange, ...restOrange } = bidsTabStyle(true, 'pricing') as Record<string, unknown>
    const { backgroundColor: blue, ...restBlue } = tabStyle(true) as Record<string, unknown>
    expect(restOrange).toEqual(restBlue)
    expect(orange).not.toBe(blue)
  })

  it('the Bids tab is the page tab, narrower', () => {
    expect(tabStyle(true)).toEqual({ ...pageTabStyle(true), padding: '0.5rem 0.6rem', fontSize: '0.9375rem' })
  })
})

describe('the open bid’s × on a phone (v2.4451)', () => {
  const HOSTS = bidComponentSources.filter(({ src }) => src.includes('style={bidDetailCloseFloatMobileStyle}'))

  it('sits in the card’s top-right corner, a fixed width with no shadow over the content', () => {
    const s = bidDetailCloseFloatMobileStyle as Record<string, unknown>
    expect(s.position).toBe('absolute')
    expect(s.top).toBe(0)
    expect(s.right).toBe(0)
    expect(s.width).toBe(BID_DETAIL_CLOSE_FLOAT_WIDTH)
    expect(s.padding).toBe(0)
    expect('boxShadow' in s).toBe(false)
  })

  it('is floated by the nine bid cards, and each keeps a right padding at least as wide as the ×', () => {
    expect(HOSTS.map((h) => h.file).sort()).toEqual([
      'BidChangeOrderTab.tsx',
      'BidLienReleaseTab.tsx',
      'BidRfiTab.tsx',
      'BidSubmissionFollowupTab.tsx',
      'BidsCountsTab.tsx',
      'BidsCoverLetterTab.tsx',
      'BidsLaborTab.tsx',
      'BidsPricingTab.tsx',
      'BidsTakeoffTab.tsx',
    ])
    for (const { file, src } of HOSTS) {
      const at = src.indexOf('style={bidDetailCloseFloatMobileStyle}')
      // The card's own style object is the nearest padding above its × (the × has none inline).
      const paddings = [...src.slice(Math.max(0, at - 1500), at).matchAll(/padding: '([^']+)'/g)]
      const card = paddings[paddings.length - 1]?.[1]
      expect(card, `${file}: the card's padding`).toBeDefined()
      expect(remOf(rightOf(card!)), `${file}: the card's right padding (${card})`).toBeGreaterThanOrEqual(remOf(BID_DETAIL_CLOSE_FLOAT_WIDTH))
    }
  })
})

describe('the bid title on a phone (v2.4451)', () => {
  it('may shrink and wrap on every tab: no host holds its h2 at full width', () => {
    const uses = bidComponentSources.flatMap(({ file, src }) =>
      [...src.matchAll(/<BidWorkflowTabTitleWithPreview[\s\S]*?\/>/g)].map((m) => ({ file, tag: m[0] })),
    )
    expect(uses.length).toBeGreaterThanOrEqual(10)
    for (const { file, tag } of uses) {
      expect(tag, file).not.toMatch(/flex: '0 0 auto'|flexShrink: 0|whiteSpace: 'nowrap'/)
    }
  })
})

