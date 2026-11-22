// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LienDeskFindBox from './LienDeskFindBox'

afterEach(cleanup)

describe('LienDeskFindBox (v2.4721)', () => {
  it('types through to the desk, counts the matches, clears on × and on Esc, and / focuses it from the page', () => {
    const onChange = vi.fn()
    const { rerender } = render(<LienDeskFindBox value="" onChange={onChange} matched={12} isMobile={false} />)
    expect(screen.getByTestId('lien-desk-find').getAttribute('data-finding')).toBe('no')
    expect(screen.queryByTestId('lien-desk-find-count')).toBeNull()
    fireEvent.change(screen.getByTestId('lien-desk-find-input'), { target: { value: 'dud' } })
    expect(onChange).toHaveBeenLastCalledWith('dud')
    rerender(<LienDeskFindBox value="dud" onChange={onChange} matched={2} isMobile={false} />)
    expect(screen.getByTestId('lien-desk-find').getAttribute('data-finding')).toBe('yes')
    expect(screen.getByTestId('lien-desk-find-count').textContent).toBe('2 jobs')
    fireEvent.keyDown(screen.getByTestId('lien-desk-find-input'), { key: 'Escape' })
    expect(onChange).toHaveBeenLastCalledWith('')
    fireEvent.click(screen.getByTestId('lien-desk-find-clear'))
    expect(onChange).toHaveBeenCalledTimes(3)
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(document.activeElement).toBe(screen.getByTestId('lien-desk-find-input'))
  })

  it('is a quiet line (v2.7315): no border and no fill at rest, the clear with no fill, the / key drawn only for the hover and focus rules', () => {
    const { rerender } = render(<LienDeskFindBox value="" onChange={() => {}} matched={12} isMobile={false} />)
    const box = screen.getByTestId('lien-desk-find')
    expect(box.hasAttribute('data-lien-find-quiet')).toBe(true)
    expect(box.className).toBe('lienFind')
    expect(box.style.border).toBe('')
    expect(box.style.background).toBe('')
    expect(box.style.margin).toBe('')
    expect(box.style.paddingLeft).toBe('0.9rem')
    expect(box.style.height).toBe('47px')
    expect(document.querySelector('.lienFindKey')?.textContent).toBe('/')
    rerender(<LienDeskFindBox value="dud" onChange={() => {}} matched={2} isMobile={false} />)
    expect(screen.getByTestId('lien-desk-find-clear').style.background).toBe('none')
    expect(document.querySelector('.lienFindKey')).toBeNull()
  })

  it('on a phone the box is a thumb tall, its words are 16 px so an iPhone does not zoom the page, and × is a thumb wide (punch list #352, PR 5)', () => {
    const view = render(<LienDeskFindBox value="dud" onChange={() => {}} matched={2} isMobile />)
    expect(screen.getByTestId('lien-desk-find').style.minHeight).toBe('44px')
    expect(screen.getByTestId('lien-desk-find-input').style.fontSize).toBe('1rem')
    // The field and its × are a thumb's 44 px themselves, and the line keeps its 56 px (the phone walk of 2026-11-21 read the field at 34).
    expect(screen.getByTestId('lien-desk-find-input').style.minHeight).toBe('44px')
    expect(screen.getByTestId('lien-desk-find').style.paddingTop).toBe('6px')
    expect(screen.getByTestId('lien-desk-find-clear').style.width).toBe('44px')
    expect(screen.getByTestId('lien-desk-find-clear').style.height).toBe('44px')
    view.unmount()
    // A computer keeps the small box.
    render(<LienDeskFindBox value="dud" onChange={() => {}} matched={2} isMobile={false} />)
    expect(screen.getByTestId('lien-desk-find').style.minHeight).toBe('')
    expect(screen.getByTestId('lien-desk-find-input').style.fontSize).toBe('0.8125rem')
    expect(screen.getByTestId('lien-desk-find-input').style.minHeight).toBe('')
    expect(screen.getByTestId('lien-desk-find-clear').style.width).toBe('20px')
  })
})
