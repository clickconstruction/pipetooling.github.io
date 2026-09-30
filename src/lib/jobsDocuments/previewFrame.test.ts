import { describe, expect, it } from 'vitest'
import { previewFrameHtml } from './previewFrame'

describe('previewFrameHtml', () => {
  it('puts the base tag first in a document’s head, so every link opens a tab of its own', () => {
    const out = previewFrameHtml('<!doctype html><html><head><meta charset="utf-8" /><title>t</title></head><body><a href="https://x.test">x</a></body></html>')
    expect(out).toContain('<head><base target="_blank"><meta charset="utf-8" />')
    expect(out.match(/<base/g)).toHaveLength(1)
  })

  it('reads a head with attributes, in any case', () => {
    expect(previewFrameHtml('<HTML><HEAD lang="en"><title>t</title></HEAD><body></body></HTML>')).toContain('<HEAD lang="en"><base target="_blank"><title>')
  })

  it('leads a fragment, or a document with no head, with the tag', () => {
    expect(previewFrameHtml('<div>Hello</div>')).toBe('<base target="_blank"><div>Hello</div>')
    expect(previewFrameHtml('<html><body><p>Hi</p></body></html>').startsWith('<base target="_blank"><html>')).toBe(true)
  })

  it('is not fooled by <header>, and leaves a document that sets its own base alone', () => {
    expect(previewFrameHtml('<header>Top</header>')).toBe('<base target="_blank"><header>Top</header>')
    const own = '<html><head><base href="https://x.test/"></head><body></body></html>'
    expect(previewFrameHtml(own)).toBe(own)
  })
})
