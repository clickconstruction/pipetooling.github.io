// @vitest-environment jsdom
/**
 * Render smoke for the Uncollectible stamp (punch list #94, v2.4792; its dark palette, punch list
 * #145, v2.5769). The words are the kernel's (`uncollectible.test.ts`); here the four classes the
 * stamp wears are the four `index.css` defines, light and dark, read from the file and put on the
 * page, so the stamp and its stylesheet block cannot drift apart without a red test.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StagesUncollectibleStamp } from './StagesUncollectibleStamp'
import type { UncollectibleFacts } from '../../lib/jobs/uncollectible'

const FACTS: UncollectibleFacts = { markedYmd: '2026-10-06', reason: 'Shop closed and the owner left town.', open: 7502 }
const CLASSES = ['stagesUncollectibleStamp', 'stagesUncollectibleStampWord', 'stagesUncollectibleStampReason', 'stagesUncollectibleStampFacts'] as const

/** Every rule of index.css whose selector names the stamp: the light block and the dark override. */
function stampCss(): string {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  return (css.match(/^[^{}\n]*stagesUncollectibleStamp[^{}\n]*\{[^}]*\}/gm) ?? []).join('\n')
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
  document.querySelectorAll('style[data-test]').forEach((s) => s.remove())
})

describe('StagesUncollectibleStamp render smoke', () => {
  it('draws the word, the reason, the day and the dollars as one note wearing the four classes and no inline style', () => {
    render(<StagesUncollectibleStamp facts={FACTS} />)
    const stamp = screen.getByRole('note', { name: 'Uncollectible. Shop closed and the owner left town. Oct 6, 2026 · $7,502 given up on' })
    expect(stamp.hasAttribute('data-stages-uncollectible-stamp')).toBe(true)
    expect(stamp.className).toBe('stagesUncollectibleStamp')
    const [word, reason, facts] = Array.from(stamp.children) as [Element, Element, Element]
    expect(word.className).toBe('stagesUncollectibleStampWord')
    expect(word.textContent).toBe('Uncollectible')
    expect(reason.className).toBe('stagesUncollectibleStampReason')
    expect(reason.textContent).toBe('Shop closed and the owner left town.')
    expect(facts.className).toBe('stagesUncollectibleStampFacts')
    expect(Array.from(facts.children).map((c) => c.textContent)).toEqual(['Oct 6, 2026', '$7,502 given up on'])
    // Every pixel is the stylesheet's: nothing inline on the stamp or under it.
    expect(stamp.hasAttribute('style')).toBe(false)
    expect(stamp.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('index.css defines each of the four classes, and overrides the stamp and the reason for dark', () => {
    const css = stampCss()
    render(<StagesUncollectibleStamp facts={FACTS} />)
    const worn = new Set<string>()
    const stamp = screen.getByRole('note')
    for (const el of [stamp, ...Array.from(stamp.querySelectorAll('[class]'))]) el.classList.forEach((c) => worn.add(c))
    expect([...worn].sort()).toEqual([...CLASSES].sort())
    for (const c of CLASSES) expect(css, `.${c} has no rule in src/index.css`).toMatch(new RegExp(`^\\.${c} \\{`, 'm'))
    expect(css).toMatch(/^:root\[data-theme='dark'\] \.stagesUncollectibleStamp \{/m)
    expect(css).toMatch(/^:root\[data-theme='dark'\] \.stagesUncollectibleStampReason \{/m)
  })

  it('the stylesheet puts the dark palette on the stamp only under data-theme=dark', () => {
    const style = document.createElement('style')
    style.setAttribute('data-test', '')
    style.textContent = stampCss()
    document.head.appendChild(style)
    render(<StagesUncollectibleStamp facts={FACTS} />)
    const stamp = screen.getByRole('note')
    const reason = stamp.children[1]!
    // Light: red stencil on the pale pink panel, the reason in the deep red token.
    expect(getComputedStyle(stamp).color).toBe('var(--text-red-700)')
    expect(getComputedStyle(stamp).background).toBe('rgba(254, 226, 226, 0.6)')
    expect(getComputedStyle(reason).color).toBe('var(--text-red-900)')
    document.documentElement.setAttribute('data-theme', 'dark')
    // Dark: red-orange on the deep red panel, the reason in the row's own ink.
    expect(getComputedStyle(stamp).color).toBe('rgb(255, 138, 101)') // #ff8a65, as jsdom hands a hex back
    expect(getComputedStyle(stamp).background).toBe('var(--bg-red-100)')
    expect(getComputedStyle(reason).color).toBe('var(--text-strong)')
  })
})
