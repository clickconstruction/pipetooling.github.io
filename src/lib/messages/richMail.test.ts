import { describe, expect, it } from 'vitest'
import { cleanStyle, EMAIL_VIEW_KEY, isTrackingPixel, keepEmailView, pixelSize, readEmailView, richAttr, RICH_MAIL_FORBID_ATTR, RICH_MAIL_FORBID_TAGS, richMailConfig, RICH_MAIL_URI } from './richMail'

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m }
}

describe('the view kept on the device (#259)', () => {
  it('opens on Plain until someone presses Rich text, and keeps the press', () => {
    const s = store()
    expect(readEmailView(s)).toBe('plain')
    keepEmailView('rich', s)
    expect(s.map.get(EMAIL_VIEW_KEY)).toBe('rich')
    expect(readEmailView(s)).toBe('rich')
    keepEmailView('plain', s)
    expect(readEmailView(s)).toBe('plain')
    expect(readEmailView(store({ [EMAIL_VIEW_KEY]: 'odd' }))).toBe('plain')
    expect(readEmailView(null)).toBe('plain')
  })

  it('reads Plain and keeps nothing on a browser whose storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readEmailView(throwing)).toBe('plain')
    expect(() => keepEmailView('rich', throwing)).not.toThrow()
  })
})

describe('the sanitizer’s rules', () => {
  it('forbids what runs, fetches, posts, frames or styles the page, and what could meet the app’s own CSS', () => {
    for (const t of ['script', 'style', 'link', 'meta', 'base', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'video', 'audio']) expect(RICH_MAIL_FORBID_TAGS).toContain(t)
    for (const a of ['srcset', 'background', 'ping', 'id', 'class', 'target', 'formaction']) expect(RICH_MAIL_FORBID_ATTR).toContain(a)
    expect(RICH_MAIL_FORBID_TAGS).not.toContain('table')
    expect(RICH_MAIL_FORBID_TAGS).not.toContain('img')
    expect(RICH_MAIL_FORBID_TAGS).not.toContain('a')
    const cfg = richMailConfig()
    expect(cfg.USE_PROFILES).toEqual({ html: true })
    expect(cfg.WHOLE_DOCUMENT).toBe(false)
    expect(cfg.ALLOW_DATA_ATTR).toBe(true)
    expect(cfg.ALLOWED_URI_REGEXP).toBe(RICH_MAIL_URI)
  })

  it('lets through the web, mail, a phone, a text and a plain value, and no other scheme', () => {
    for (const u of ['https://a.example/x', 'http://a.example', 'mailto:a@b.example', 'tel:+15125550142', 'sms:+15125550142', '600', '#ffffff', 'left', 'Arial, sans-serif', '50%']) expect(RICH_MAIL_URI.test(u), u).toBe(true)
    for (const u of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/png;base64,AAAA', 'cid:logo@sender', 'file:///etc/passwd', 'vbscript:x', 'blob:https://a.example/1', 'ftp://a.example']) expect(RICH_MAIL_URI.test(u), u).toBe(false)
  })

  it('cleans a style of what fetches or escapes, and keeps the rest', () => {
    expect(cleanStyle('color: #333; background: url(https://t.example/p.gif); font-weight: bold')).toBe('color: #333; font-weight: bold')
    expect(cleanStyle("width:100px;behavior:url(#default#time2);background-image:URL('x.png')")).toBe('width:100px')
    expect(cleanStyle('position: fixed; top: 0; color: red')).toBe('top: 0; color: red')
    expect(cleanStyle('position: sticky; position: relative')).toBe('position: relative')
    expect(cleanStyle('width: expression(alert(1)); @import url(x)')).toBe('')
    expect(cleanStyle('background: image-set(url(a.png) 1x)')).toBe('')
    expect(cleanStyle('  ;; ')).toBe('')
  })

  it('reads a size in pixels and knows a tracking pixel or a hidden picture', () => {
    expect(pixelSize('1')).toBe(1)
    expect(pixelSize(' 600px ')).toBe(600)
    expect(pixelSize('100%')).toBeNull()
    expect(pixelSize('auto')).toBeNull()
    expect(pixelSize(null)).toBeNull()
    expect(isTrackingPixel({ width: '1', height: '1', style: null })).toBe(true)
    expect(isTrackingPixel({ width: null, height: '2px', style: null })).toBe(true)
    expect(isTrackingPixel({ width: null, height: null, style: 'width:1px;height:1px' })).toBe(true)
    expect(isTrackingPixel({ width: null, height: null, style: 'display:none' })).toBe(true)
    expect(isTrackingPixel({ width: null, height: null, style: 'visibility: hidden;' })).toBe(true)
    expect(isTrackingPixel({ width: '600', height: '1', style: null })).toBe(true)
    expect(isTrackingPixel({ width: '600', height: '120', style: 'display:block' })).toBe(false)
    expect(isTrackingPixel({ width: null, height: null, style: null })).toBe(false)
    expect(isTrackingPixel({ width: '100%', height: 'auto', style: 'max-width: 100%' })).toBe(false)
  })

  it('keeps a picture’s address only while pictures are on and only from the web or its own bytes', () => {
    expect(richAttr('img', 'src', 'https://a.example/p.png', false)).toEqual({ keep: false })
    expect(richAttr('img', 'src', 'https://a.example/p.png', true)).toEqual({ keep: true, value: 'https://a.example/p.png' })
    expect(richAttr('img', 'src', ' data:image/gif;base64,R0lGOD ', true)).toEqual({ keep: true, value: 'data:image/gif;base64,R0lGOD' })
    expect(richAttr('img', 'src', 'cid:logo@sender', true)).toEqual({ keep: false })
    expect(richAttr('img', 'src', 'http://a.example/p.png', true)).toEqual({ keep: true, value: 'http://a.example/p.png' })
    expect(richAttr('img', 'alt', 'The plans', false)).toEqual({ keep: true, value: 'The plans' })
  })

  it('keeps a link’s address only to the web, mail or a phone, and cleans a style wherever it sits', () => {
    expect(richAttr('a', 'href', 'https://plans.example/set', false)).toEqual({ keep: true, value: 'https://plans.example/set' })
    expect(richAttr('a', 'href', 'mailto:greg@hillside.example', true)).toEqual({ keep: true, value: 'mailto:greg@hillside.example' })
    expect(richAttr('a', 'href', 'data:image/png;base64,AAAA', true)).toEqual({ keep: false })
    expect(richAttr('a', 'href', 'javascript:alert(1)', true)).toEqual({ keep: false })
    expect(richAttr('td', 'style', 'padding: 4px; background: url(x)', false)).toEqual({ keep: true, value: 'padding: 4px' })
    expect(richAttr('td', 'style', 'background: url(x)', false)).toEqual({ keep: false })
    expect(richAttr('td', 'width', '600', false)).toEqual({ keep: true, value: '600' })
  })
})
