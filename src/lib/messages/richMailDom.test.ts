// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeRichMail } from './richMailDom'

/** An invitation as a mail client writes it: a whole document, a style block, a table of scope, a linked word, a logo, a tracker. */
const INVITATION = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invitation</title><style>p { color: red } body { background: url(https://t.example/bg.png) }</style></head>
<body style="background: url(https://t.example/bg.png); margin: 0" onload="alert(1)">
<div id="root" class="btn" style="font-family: Arial; position: fixed; top: 0">
<p>Wendi,</p>
<p>We at <b>Maxx Builders</b> invite you to bid. <a href="https://maxxbuilders.box.example/s/vzgc9sp8" target="_self" onclick="steal()">Link to Plans</a></p>
<table width="600" style="border-collapse: collapse" background="https://t.example/tbl.png"><tr><td style="padding: 4px; background-image: url(https://t.example/cell.png)">Scope</td><td>Plumbing</td></tr></table>
<img src="https://maxxbuilders.example/logo.png" width="200" height="60" alt="Maxx Builders" srcset="https://maxxbuilders.example/logo@2x.png 2x">
<img src="https://track.example/o.gif?id=42" width="1" height="1" alt="">
<img src="https://track.example/spacer.gif" style="display:none">
<img src="cid:sig@sender" width="120" height="40" alt="signature">
<script>alert(1)</script>
<form action="https://evil.example/post"><input name="pw"><button>Send</button></form>
<iframe src="https://evil.example"></iframe>
<a href="javascript:alert(1)">bad</a> <a href="mailto:glenn@maxxbuilders.example">write</a>
</body></html>`

describe('sanitizeRichMail: DOMPurify with the house rules (#259)', () => {
  it('strips scripts, forms, frames, styles, handlers, backgrounds, ids and classes, and keeps the layout', () => {
    const { html } = sanitizeRichMail(INVITATION, false)
    for (const bad of ['<script', '<style', '<form', '<input', '<button', '<iframe', '<meta', '<title', 'onload', 'onclick', 'alert(', 'javascript:', 'background=', 'url(', 'id="root"', 'class="btn"', 'position: fixed', 'srcset', 'target="_self"', 'evil.example']) {
      expect(html, bad).not.toContain(bad)
    }
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')!
    expect(table.getAttribute('width')).toBe('600')
    expect(table.getAttribute('style')).toBe('border-collapse: collapse')
    expect(table.hasAttribute('background')).toBe(false)
    const td = doc.querySelector('td')!
    expect(td.getAttribute('style')).toBe('padding: 4px')
    expect(td.textContent).toBe('Scope')
    expect(html).toContain('<b>Maxx Builders</b>')
    const wrap = doc.querySelector('div')!
    expect(wrap.getAttribute('style')).toBe('font-family: Arial; top: 0')
    expect(wrap.hasAttribute('id')).toBe(false)
    expect(wrap.hasAttribute('class')).toBe(false)
    // The form's words stay; the form is gone.
    expect(doc.body.textContent).toContain('Send')
  })

  it('opens every link in a new tab with noopener noreferrer, drops a javascript: one, keeps mailto:', () => {
    const { html } = sanitizeRichMail(INVITATION, false)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const links = [...doc.querySelectorAll('a')]
    // The javascript: link loses its address and stays words; the two good ones open in a new tab.
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://maxxbuilders.box.example/s/vzgc9sp8', null, 'mailto:glenn@maxxbuilders.example'])
    for (const a of links.filter((a) => a.hasAttribute('href'))) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(links[1]!.hasAttribute('target')).toBe(false)
    expect(doc.body.textContent).toContain('bad')
  })

  it('removes the tracking pixels, and turns every other picture off until asked', () => {
    const off = sanitizeRichMail(INVITATION, false)
    expect(off.pixels).toBe(2)
    expect(off.pictures).toBe(2)
    expect(off.html).not.toContain('track.example')
    const doc = new DOMParser().parseFromString(off.html, 'text/html')
    const imgs = [...doc.querySelectorAll('img')]
    expect(imgs.length).toBe(2)
    for (const img of imgs) {
      expect(img.hasAttribute('src')).toBe(false)
      expect(img.hasAttribute('data-picture-off')).toBe(true)
    }
    expect(imgs[0]!.getAttribute('alt')).toBe('Maxx Builders')
    expect(imgs[0]!.getAttribute('width')).toBe('200')
  })

  it('with pictures on, loads the web ones and never a cid: one, and the pixels stay gone', () => {
    const on = sanitizeRichMail(INVITATION, true)
    expect(on.pixels).toBe(2)
    expect(on.pictures).toBe(2)
    const doc = new DOMParser().parseFromString(on.html, 'text/html')
    const imgs = [...doc.querySelectorAll('img')]
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['https://maxxbuilders.example/logo.png', null])
    expect(imgs.map((i) => i.hasAttribute('data-picture-off'))).toEqual([false, false])
    expect(on.html).not.toContain('track.example')
    expect(on.html).not.toContain('srcset')
  })

  it('keeps an inline data:image picture when pictures are on, and a plain fragment as it is', () => {
    const on = sanitizeRichMail('<p>Hi</p><img src="data:image/png;base64,iVBORw0KGgo=" width="10" height="10" alt="dot">', true)
    expect(on.html).toContain('src="data:image/png;base64,iVBORw0KGgo="')
    expect(on.pictures).toBe(1)
    const plain = sanitizeRichMail('<p>Just <i>words</i>.</p>', false)
    expect(plain).toEqual({ html: '<p>Just <i>words</i>.</p>', pictures: 0, pixels: 0 })
  })
})
