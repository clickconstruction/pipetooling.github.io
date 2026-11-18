// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GearAnswerDot, NavRowLinkMenuRows, TellTheDevMenuRow } from './NavRowMenuRows'
import { TELL_THE_DEV_OPEN_EVENT, type TellTheDevOpenRequest } from '../../lib/tellTheDev/openBox'
import { setUnreadDevAnswers } from '../../lib/tellTheDev/answerDot'

/**
 * The gear menu's rows for the presses the phone's header had no room for (the owner's ask of 2026-11-18).
 * A press that moved must still do what it did: the wrench opens the same box, the links open the same pages.
 */
afterEach(() => {
  cleanup()
  setUnreadDevAnswers(0)
})

function heardRequests(): TellTheDevOpenRequest[] {
  const heard: TellTheDevOpenRequest[] = []
  const on = (e: Event) => heard.push((e as CustomEvent<TellTheDevOpenRequest>).detail)
  window.addEventListener(TELL_THE_DEV_OPEN_EVENT, on)
  return heard
}

describe('TellTheDevMenuRow', () => {
  it('draws nothing while the wrench is on the row', () => {
    const { container } = render(<TellTheDevMenuRow inMenu={[]} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
    cleanup()
    const people = render(<TellTheDevMenuRow inMenu={['people']} onClose={() => {}} />)
    expect(people.container.innerHTML).toBe('')
  })

  it('asks for the box through the header door, then closes the menu', () => {
    const heard = heardRequests()
    const order: string[] = []
    window.addEventListener(TELL_THE_DEV_OPEN_EVENT, () => order.push('asked'), { once: true })
    const onClose = vi.fn(() => order.push('closed'))
    render(<TellTheDevMenuRow inMenu={['wrench']} onClose={onClose} />)
    const row = screen.getByRole('button', { name: 'Tell the dev' })
    expect(row.textContent).toBe('Tell the dev')
    fireEvent.click(row)
    expect(heard).toEqual([{ door: 'header' }])
    expect(onClose).toHaveBeenCalledTimes(1)
    // The box reads the page inside the press, so the ask comes before the menu closes under it.
    expect(order).toEqual(['asked', 'closed'])
  })

  it('says an answer is waiting, as the wrench does', () => {
    setUnreadDevAnswers(2)
    render(<TellTheDevMenuRow inMenu={['wrench']} onClose={() => {}} />)
    const row = screen.getByRole('button', { name: 'Tell the dev. An answer is waiting.' })
    expect(row.getAttribute('title')).toBe('The dev answered your note')
  })
})

describe('GearAnswerDot', () => {
  it('shows only with an unread answer and the wrench in the menu', () => {
    const dots = (inMenu: readonly ('wrench' | 'people')[]) => {
      const { container } = render(<GearAnswerDot inMenu={inMenu} />)
      const n = container.querySelectorAll('span').length
      cleanup()
      return n
    }
    expect(dots(['wrench'])).toBe(0)
    setUnreadDevAnswers(1)
    expect(dots(['wrench'])).toBe(1)
    expect(dots([])).toBe(0)
    expect(dots(['people'])).toBe(0)
  })
})

describe('NavRowLinkMenuRows', () => {
  const rows = (inMenu: readonly ('wrench' | 'people' | 'customers')[], onClose = () => {}) =>
    render(
      <MemoryRouter>
        <NavRowLinkMenuRows inMenu={inMenu} onClose={onClose} />
      </MemoryRouter>,
    )

  it('draws no link for a press still on the row', () => {
    rows(['wrench'])
    expect(screen.queryAllByRole('link')).toEqual([])
  })

  it('opens the pages the presses opened, Customers before People as on the row', () => {
    const onClose = vi.fn()
    rows(['wrench', 'people', 'customers'], onClose)
    const links = screen.getAllByRole('link')
    expect(links.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href'), a.textContent])).toEqual([
      ['Customers', '/customers', 'Customers'],
      ['People', '/people', 'People'],
    ])
    fireEvent.click(links[1] as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws the people row alone when only it left', () => {
    rows(['wrench', 'people'])
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/people'])
  })
})
