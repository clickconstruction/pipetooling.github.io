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

  it('falls back to the outline style for unknown button variants', () => {
    const html = expandHelpIllustrations('[[[help-ill|button,plaid,Save]]]')
    expect(html).toContain('border:1px solid #d1d5db')
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
