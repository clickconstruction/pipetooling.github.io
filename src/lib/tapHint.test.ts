// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { TAP_HINT_DURATION_MS, isDeadTap, tapHintCss } from './tapHint'

describe('isDeadTap', () => {
  const host = document.createElement('div')
  host.innerHTML = `
    <div id="card">
      <a href="/x" id="link"><span id="link-inner">#74</span></a>
      <button id="btn">▶</button>
      <div id="dead">12925 FM 20, Kingsbury, TX</div>
      <span role="button" id="rb">custom</span>
    </div>`

  const el = (id: string) => host.querySelector(`#${id}`)!

  it('is false anywhere inside an interactive element', () => {
    expect(isDeadTap(el('link'))).toBe(false)
    expect(isDeadTap(el('link-inner'))).toBe(false)
    expect(isDeadTap(el('btn'))).toBe(false)
    expect(isDeadTap(el('rb'))).toBe(false)
  })

  it('is true on dead space, the card itself, and non-element targets', () => {
    expect(isDeadTap(el('dead'))).toBe(true)
    expect(isDeadTap(el('card'))).toBe(true)
    expect(isDeadTap(null)).toBe(true)
  })
})

describe('tapHintCss', () => {
  it('scopes the ring + fade to the container and covers reduced motion', () => {
    const css = tapHintCss('.estimate-card--tap-hint')
    expect(css).toContain('.estimate-card--tap-hint :is(a, button, [role="button"])')
    expect(css).toContain('est-tap-hint-fade')
    expect(css).toContain('prefers-reduced-motion')
    expect(TAP_HINT_DURATION_MS).toBeGreaterThan(900)
  })
})
