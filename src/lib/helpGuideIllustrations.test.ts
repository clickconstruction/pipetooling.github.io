import { describe, expect, it } from 'vitest'
import { encodeHelpIllustrations, expandHelpIllustrations } from './helpGuideIllustrations'
import { helpGuideMarkdownToSafeHtml } from './helpGuideHtml'

describe('encodeHelpIllustrations', () => {
  it('encodes button tokens into text markers', () => {
    const out = encodeHelpIllustrations('Tap {{button:green|Next Job}} to move on.')
    expect(out).toContain('[[[help-ill|button,green,Next%20Job]]]')
    expect(out).not.toContain('{{button')
  })

  it('encodes panel fences with URI-encoded captions', () => {
    const out = encodeHelpIllustrations(':::example Job Mode card\ncontent\n:::')
    expect(out).toContain('[[[help-panel-open|Job%20Mode%20card]]]')
    expect(out).toContain('[[[help-panel-close]]]')
  })

  it('strips literal markers from authored text', () => {
    const out = encodeHelpIllustrations('sneaky [[[help-ill|button,red,x]]] text')
    expect(out).toBe('sneaky  text')
  })
})

describe('expandHelpIllustrations', () => {
  it('renders known button variants with escaped labels', () => {
    const html = expandHelpIllustrations('[[[help-ill|button,amber,Turnaway%20%3Cnow%3E]]]')
    expect(html).toContain('background:#d97706')
    expect(html).toContain('Turnaway &lt;now&gt;')
    expect(html).not.toContain('<now>')
  })

  it('pins an example panel to the light theme, so its words stay readable in dark mode (v2.4329)', () => {
    const html = expandHelpIllustrations('[[[help-panel-open|A%20line]]]words[[[help-panel-close]]]')
    expect(html.startsWith('<div data-theme="light"')).toBe(true)
    expect(html).toContain('Example — A line')
  })

  it('renders the dark button the way the stage switch draws a selected In order (v2.4329)', () => {
    const html = expandHelpIllustrations('[[[help-ill|button,dark,In%20order]]]')
    expect(html).toContain('background:var(--text-strong);color:var(--surface)')
    expect(html).toContain('In order')
  })

  it('falls back to the outline style for unknown button variants', () => {
    const html = expandHelpIllustrations('[[[help-ill|button,plaid,Save]]]')
    expect(html).toContain('border:1px solid var(--border-strong)')
    expect(html).toContain('Save')
  })

  it('renders chips and icons', () => {
    expect(expandHelpIllustrations('[[[help-ill|chip,red,Not%20coming%20in]]]')).toContain('#b91c1c')
    expect(expandHelpIllustrations('[[[help-ill|icon,gear,]]]')).toContain('<svg')
    expect(expandHelpIllustrations('[[[help-ill|icon,unknown,]]]')).toBe('')
  })

  it('renders gif embeds with lazy loading, caption, and a validated filename', () => {
    const html = expandHelpIllustrations('[[[help-ill|gif,settings-basics.gif,Quick%20tour]]]')
    expect(html).toContain('src="/help/settings-basics.gif"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('Quick tour')
  })

  it('rejects gif filenames that are not plain .gif names', () => {
    expect(expandHelpIllustrations('[[[help-ill|gif,..%2Fsecret.gif,x]]]')).toBe('')
    expect(expandHelpIllustrations('[[[help-ill|gif,evil.js,x]]]')).toBe('')
  })

  it('unwraps <p> around standalone gif markers', () => {
    const html = expandHelpIllustrations('<p>[[[help-ill|gif,tour.gif,Cap]]]</p>')
    expect(html).not.toContain('<p><div')
    expect(html.startsWith('<div')).toBe(true)
  })

  it('unwraps <p> around panel markers and closes the panel div', () => {
    const html = expandHelpIllustrations(
      '<p>[[[help-panel-open|Card]]]</p><p>body</p><p>[[[help-panel-close]]]</p>',
    )
    expect(html).toContain('Example — Card')
    expect(html.indexOf('<div')).toBeLessThan(html.indexOf('<p>body</p>'))
    expect(html.trim().endsWith('</div>')).toBe(true)
    expect(html).not.toContain('<p><div')
  })
})

describe('helpGuideMarkdownToSafeHtml with illustrations', () => {
  it('renders a full guide snippet end-to-end', () => {
    const md = [
      ':::example The Job Mode card',
      'Tap {{button:blue|Leave Report}} or {{button:green|Next Job}}.',
      ':::',
      '',
      'The cell shows a {{chip:red|Not coming in}} chip.',
    ].join('\n')
    const html = helpGuideMarkdownToSafeHtml(md)
    expect(html).toContain('Example — The Job Mode card')
    expect(html).toContain('Leave Report')
    expect(html).toContain('background:#2563eb')
    expect(html).toContain('background:#16a34a')
    expect(html).toContain('#b91c1c')
    expect(html).not.toContain('[[[help-')
    expect(html).not.toContain('{{button')
  })

  it('keeps script injection impossible through token labels', () => {
    const html = helpGuideMarkdownToSafeHtml('{{button:blue|<script>alert(1)</script>}}')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('guide blocks (v2.5747): cards, Try it, folds, steps and the ring', () => {
  it('encodes each fence with its kind, and a close with the kind it closes, innermost first', () => {
    const out = encodeHelpIllustrations(':::cards\n:::card The ring\nwords\n:::tryit\nHover.\n:::\n:::fold More\ndeeper\n:::\n:::\n:::')
    expect(out).toContain('[[[help-block-open|cards,]]]')
    expect(out).toContain('[[[help-block-open|card,The%20ring]]]')
    expect(out).toContain('[[[help-block-open|tryit,]]]')
    expect(out).toContain('[[[help-block-open|fold,More]]]')
    const closes = [...out.matchAll(/\[\[\[help-block-close\|([a-z]+)\]\]\]/g)].map((m) => m[1])
    expect(closes).toEqual(['tryit', 'fold', 'card', 'cards'])
  })

  it('leaves an unknown fence as text, and still closes an example panel the old way', () => {
    const out = encodeHelpIllustrations(':::warning\nx\n:::\n:::example A\ny\n:::')
    expect(out).toContain(':::warning')
    expect(out).toContain('[[[help-panel-open|A]]]')
    expect(out).toContain('[[[help-panel-close]]]')
  })

  it('renders the blocks as the app’s cards, a Try it eyebrow, a closed fold, numbered steps', () => {
    const html = helpGuideMarkdownToSafeHtml(
      ':::cards\n\n:::card The ring\n\nIt fills.\n\n:::tryit\n\nHover for the step.\n\n:::\n\n:::fold If you want the details\n\nDeeper <b>words</b>.\n\n:::\n\n:::\n\n:::\n\n:::steps\n\n1. Morning.\n2. Lunch.\n\n:::',
    )
    expect(html).toContain('<div class="help-cards">')
    expect(html).toContain('<div class="help-card"><div class="help-card-title">The ring</div>')
    expect(html).toContain('<div class="help-tryit"><span class="help-eyebrow">Try it</span>')
    expect(html).toContain('<details class="help-fold"><summary>If you want the details</summary><div class="help-fold-body">')
    expect(html).toContain('</div></details>')
    // The list itself is the sanitizer's, which needs a DOM: helpGuideRing.test.ts proves the whole pipeline under jsdom.
    expect(html).toContain('<div class="help-steps">')
    expect(html).not.toContain('[[[help-')
    expect(html).not.toContain('<p>[[[')
  })

  it('a fold with no words on the fence reads More', () => {
    expect(helpGuideMarkdownToSafeHtml(':::fold\nx\n:::')).toContain('<summary>More</summary>')
  })

  it('draws the robot’s ring with seven segments, the step chips and the two presses', () => {
    const html = helpGuideMarkdownToSafeHtml(':::ring\n:::')
    expect(html).toContain('<div class="help-ring" data-at="0">')
    expect((html.match(/class="help-ring-seg"/g) ?? []).length).toBe(7)
    expect(html).toContain('<li data-step="0">Picked it up</li>')
    expect(html).toContain('<li data-step="6">Questions for you</li>')
    expect(html).toContain('<button type="button" data-help-ring="next">Next step</button>')
    expect(html).toContain('<button type="button" data-help-ring="reset">Start over</button>')
    expect(html).toContain('</ul></div></div>')
  })
})

