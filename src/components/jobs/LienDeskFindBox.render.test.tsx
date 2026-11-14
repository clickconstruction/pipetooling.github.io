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

  it('on a phone the box is a thumb tall, its words are 16 px so an iPhone does not zoom the page, and × is a thumb wide (punch list #352, PR 5)', () => {
    const view = render(<LienDeskFindBox value="dud" onChange={() => {}} matched={2} isMobile />)
    expect(screen.getByTestId('lien-desk-find').style.minHeight).toBe('44px')
    expect(screen.getByTestId('lien-desk-find-input').style.fontSize).toBe('1rem')
    expect(screen.getByTestId('lien-desk-find-clear').style.width).toBe('34px')
    view.unmount()
    // A computer keeps the small box.
    render(<LienDeskFindBox value="dud" onChange={() => {}} matched={2} isMobile={false} />)
    expect(screen.getByTestId('lien-desk-find').style.minHeight).toBe('')
    expect(screen.getByTestId('lien-desk-find-input').style.fontSize).toBe('0.8125rem')
    expect(screen.getByTestId('lien-desk-find-clear').style.width).toBe('20px')
  })
})
