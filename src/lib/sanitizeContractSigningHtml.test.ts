// @vitest-environment jsdom
// The sanitizer runs on DOMParser in the app (contract signing page, help guides,
// HR docs). Node has no DOM and would only exercise the strip-to-text fallback —
// that path has its own suite in sanitizeContractSigningHtml.fallback.test.ts.
import { describe, expect, it } from 'vitest'
import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'

const clean = sanitizeContractSigningHtml

describe('sanitizeContractSigningHtml — what survives', () => {
  it('keeps the contract vocabulary: paragraphs, emphasis, lists, headings, quotes, tables', () => {
    const html =
      '<h2>Scope</h2><p>We will <strong>rough in</strong> and <em>top out</em>.</p>' +
      '<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><blockquote>quoted</blockquote>' +
      '<table><thead><tr><th colspan="2">Item</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>' +
      '<div><span>inline</span><br></div>'
    expect(clean(html)).toBe(html)
  })
  it('keeps http(s) links, and adds rel="noopener noreferrer" to a target="_blank" link that lacks one', () => {
    expect(clean('<a href="https://example.com/terms">terms</a>')).toBe('<a href="https://example.com/terms">terms</a>')
    expect(clean('<a href="HTTP://example.com">up</a>')).toBe('<a href="HTTP://example.com">up</a>')
    expect(clean('<a href="https://x.test" target="_blank">x</a>')).toBe('<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>')
    expect(clean('<a href="https://x.test" target="_blank" rel="nofollow">x</a>')).toBe('<a href="https://x.test" target="_blank" rel="nofollow">x</a>')
    expect(clean('<a href="https://x.test" target="_self">x</a>')).toBe('<a href="https://x.test" target="_self">x</a>')
  })
  it('returns nothing for blank input and trims the rest', () => {
    expect(clean('')).toBe('')
    expect(clean('   \n ')).toBe('')
    expect(clean('  <p>x</p>  ')).toBe('<p>x</p>')
    expect(clean('plain text only')).toBe('plain text only')
  })
})

describe('sanitizeContractSigningHtml — what is removed', () => {
  it('drops scripts, styles, frames, forms and their contents entirely', () => {
    expect(clean('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>')
    expect(clean('<style>p{display:none}</style><p>x</p>')).toBe('<p>x</p>')
    expect(clean('<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="x"><p>ok</p>')).toBe('<p>ok</p>')
    expect(clean('<form action="https://evil.test"><input name="a"><textarea>t</textarea><select><option>o</option></select><button>go</button></form>')).toBe('')
    expect(clean('<meta http-equiv="refresh" content="0"><link rel="stylesheet" href="x"><base href="https://evil.test/"><p>k</p>')).toBe('<p>k</p>')
    expect(clean('<svg onload="alert(1)"><circle></circle></svg><math><mi>x</mi></math><p>k</p>')).toBe('<p>k</p>')
  })
  it('unwraps tags outside the allowlist but keeps their text', () => {
    expect(clean('<section><p>inside</p></section>')).toBe('<p>inside</p>')
    expect(clean('<font color="red">red</font> <u>u</u> <s>struck</s> <code>c</code>')).toBe('red <u>u</u> struck c')
    expect(clean('<h5>five</h5><h1>one</h1>')).toBe('five<h1>one</h1>')
    expect(clean('<img src="x" onerror="alert(1)"><p>after</p>')).toBe('<p>after</p>') // void: nothing to keep
    expect(clean('<video controls><source src="x">fallback</video>')).toBe('fallback')
  })
  it('strips every attribute but href/target/rel/colspan/rowspan, and every on* handler', () => {
    expect(clean('<p class="x" style="color:red" id="p1" data-x="1" onclick="alert(1)" onmouseover="x()">t</p>')).toBe('<p>t</p>')
    expect(clean('<table><tbody><tr><td colspan="2" rowspan="3" style="x" bgcolor="red">c</td></tr></tbody></table>')).toBe(
      '<table><tbody><tr><td colspan="2" rowspan="3">c</td></tr></tbody></table>',
    )
    expect(clean('<a href="https://x.test" ONCLICK="alert(1)" title="t" download>x</a>')).toBe('<a href="https://x.test">x</a>')
  })
  it('drops any link target that is not http(s) — javascript:, data:, mailto:, relative, protocol-relative', () => {
    expect(clean('<a href="javascript:alert(1)">j</a>')).toBe('<a>j</a>')
    expect(clean('<a href="  JavaScript:alert(1)">j</a>')).toBe('<a>j</a>')
    expect(clean('<a href="data:text/html,x">d</a>')).toBe('<a>d</a>')
    expect(clean('<a href="mailto:a@b.c">m</a>')).toBe('<a>m</a>')
    expect(clean('<a href="/local">r</a>')).toBe('<a>r</a>')
    expect(clean('<a href="//evil.test">p</a>')).toBe('<a>p</a>')
  })
  it('reaches forbidden and unknown tags nested inside each other', () => {
    expect(clean('<section><div><script>x()</script><font>t</font></div></section>')).toBe('<div>t</div>')
    expect(clean('<p>a<span><iframe></iframe><b onclick="x">b</b></span></p>')).toBe('<p>a<span><b>b</b></span></p>')
  })
  it('does not run out of passes on a long document: 250 unknown wrappers cannot smuggle an on* handler through', () => {
    const padding = '<font>x</font>'.repeat(250)
    const out = clean(`${padding}<img src="x" onerror="alert(1)"><p>end</p>`)
    expect(out).toBe(`${'x'.repeat(250)}<p>end</p>`)
    expect(out).not.toMatch(/onerror|<img|<font/i)
  })
})
