// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { clearFindMarks, markFindMatches, narrowToMarked } from './helpGuideFind'

function page(): HTMLDivElement {
  const root = document.createElement('div')
  root.innerHTML = [
    '<p>Every rule the app follows.</p>',
    '<h2>The clock</h2>',
    '<p>The clock runs by month.</p>',
    '<h3>The month rule</h3>',
    '<p>A notice names each unpaid month. The month rule is the one to learn.</p>',
    '<h3>Residential shortens everything</h3>',
    '<p>On a residential property the deadline comes a month earlier.</p>',
    '<h2>The notice</h2>',
    '<h3>The § 53.056 notice</h3>',
    '<p>Certified mail, return receipt. Section 53.056 says who gets it.</p>',
  ].join('')
  document.body.appendChild(root)
  return root
}

describe('helpGuideFind (v2.4655)', () => {
  it('marks every match, case-insensitive, and clears back to the same text', () => {
    const root = page()
    expect(markFindMatches(root, 'month')).toBe(5)
    const marks = root.querySelectorAll('mark[data-find]')
    expect(marks).toHaveLength(5)
    expect(marks[0]!.textContent).toBe('month')
    expect(root.querySelector('h3')!.innerHTML).toBe('The <mark data-find="">month</mark> rule')
    clearFindMarks(root)
    expect(root.querySelectorAll('mark')).toHaveLength(0)
    expect(root.querySelector('h3')!.textContent).toBe('The month rule')
    expect(root.querySelector('h3')!.childNodes).toHaveLength(1)
    expect(markFindMatches(root, 'm')).toBe(0)
    expect(markFindMatches(root, '  ')).toBe(0)
  })
  it('narrows to the sections that hold a mark: a rule under its group, the group heading kept, the rest hidden; off shows all', () => {
    const root = page()
    markFindMatches(root, '53.056')
    expect(narrowToMarked(root, true)).toBe(2) // The notice · The § 53.056 notice
    const shown = Array.from(root.children).filter((el) => !(el as HTMLElement).hidden).map((el) => el.textContent)
    expect(shown).toEqual(['The notice', 'The § 53.056 notice', 'Certified mail, return receipt. Section 53.056 says who gets it.'])
    clearFindMarks(root)
    markFindMatches(root, 'residential')
    narrowToMarked(root, true)
    expect(Array.from(root.children).filter((el) => !(el as HTMLElement).hidden).map((el) => el.tagName)).toEqual(['H2', 'H3', 'P'])
    expect(narrowToMarked(root, false)).toBe(5)
    expect(Array.from(root.children).every((el) => !(el as HTMLElement).hidden)).toBe(true)
  })
  it('a match in a group’s own lead keeps the lead; a match before the first heading shows that paragraph', () => {
    const root = page()
    markFindMatches(root, 'runs by')
    narrowToMarked(root, true)
    expect(Array.from(root.children).filter((el) => !(el as HTMLElement).hidden).map((el) => el.textContent)).toEqual(['The clock', 'The clock runs by month.'])
    clearFindMarks(root)
    markFindMatches(root, 'app follows')
    narrowToMarked(root, true)
    expect(Array.from(root.children).filter((el) => !(el as HTMLElement).hidden).map((el) => el.textContent)).toEqual(['Every rule the app follows.'])
  })
})
