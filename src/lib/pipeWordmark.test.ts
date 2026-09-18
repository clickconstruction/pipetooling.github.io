import { describe, expect, it } from 'vitest'

import { PIPE_GLYPHS, PIPE_STROKE, buildPipeWord, canRenderPipeWord, pipeFreeTips } from './pipeWordmark'

describe('pipeWordmark (v2.3583)', () => {
  it('knows the sign-in title and the default title, and refuses a word with a missing glyph', () => {
    expect(canRenderPipeWord('ClickPlumbing.com')).toBe(true)
    expect(canRenderPipeWord('Click Plumbing')).toBe(true)
    expect(canRenderPipeWord('Zed')).toBe(false)
    expect(canRenderPipeWord('')).toBe(false)
    expect(buildPipeWord('Zed')).toBeNull()
  })

  it('finds free tips: a run end that no other run touches', () => {
    expect(pipeFreeTips(PIPE_GLYPHS.l!)).toHaveLength(2) // top and bottom of the stem
    expect(pipeFreeTips(PIPE_GLYPHS.o!)).toHaveLength(0) // a closed loop has no ends
    expect(pipeFreeTips(PIPE_GLYPHS.k!)).toHaveLength(4) // stem top and bottom, the arm's top, the leg's foot; the stub touches both
    expect(pipeFreeTips(PIPE_GLYPHS.P!)).toHaveLength(1) // the bowl closes back onto the stem
    expect(pipeFreeTips(PIPE_GLYPHS.b!)).toHaveLength(1) // the bowl's ends sit on the stem, and its bottom run covers the stem's foot
    expect(pipeFreeTips(PIPE_GLYPHS.g!)).toHaveLength(1) // only the hook's end is open
    const tip = pipeFreeTips(PIPE_GLYPHS.l!)[0]!
    expect([tip.dx, tip.dy]).toEqual([0, -1]) // the top tip points up
  })

  it('a wheel glyph turns its marked tip into a handwheel on a stem, the other tips into flanges', () => {
    const i = buildPipeWord('i')!
    expect(i.wheels).toHaveLength(1)
    expect(i.flanges).toHaveLength(1)
    const w = i.wheels[0]!
    expect(w.stem.y1).toBe(46)
    expect(w.cy).toBeLessThan(46) // the wheel rides above the stem's top
    expect(w.cx).toBe(w.stem.x2)
    expect(w.ring).toBeCloseTo(PIPE_STROKE * 0.42)
    const period = buildPipeWord('.')!
    expect(period.wheels).toHaveLength(1)
    expect(period.flanges).toHaveLength(1)
  })

  it('a flange sits just inside the tip, across the pipe', () => {
    const l = buildPipeWord('l')!
    const top = l.flanges.find((f) => f.angle === -90)!
    expect(top.across).toBeCloseTo(PIPE_STROKE * 1.9)
    expect(top.thick).toBeCloseTo(PIPE_STROKE * 0.45)
    expect(top.cy).toBeCloseTo(4 + top.thick * 0.5) // pulled back into the run so the pipe never shows past it
  })

  it('the sign-in title: three wheels, thirty flanges, one path, a viewBox the width of the word', () => {
    const g = buildPipeWord('ClickPlumbing.com')!
    expect(g.wheels).toHaveLength(3)
    expect(g.flanges).toHaveLength(30)
    expect(g.path.startsWith('M')).toBe(true)
    expect(g.path.match(/M/g)!.length).toBeGreaterThan(17) // more runs than letters
    const expectedW = [...'ClickPlumbing.com'].reduce((a, ch) => a + PIPE_GLYPHS[ch]!.w + 8, 0) - 8 + 28
    expect(g.viewBox).toEqual({ x: 0, y: -22, w: expectedW, h: 158 })
    expect(g.stroke).toBe(PIPE_STROKE)
  })

  it('a space advances the pen and draws nothing', () => {
    const a = buildPipeWord('Click')!
    const b = buildPipeWord('Click Plumbing')!
    expect(b.viewBox.w).toBeGreaterThan(a.viewBox.w)
    expect(b.flanges.length).toBeGreaterThan(a.flanges.length)
    expect(b.wheels).toHaveLength(2)
  })
})
