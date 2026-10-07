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
})
