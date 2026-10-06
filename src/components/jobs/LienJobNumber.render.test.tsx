// @vitest-environment jsdom
/**
 * The Lien desk's job number and a pane's job heading (v2.4535): with a door the number is a
 * button that opens the job and keeps the click to itself; with none both are plain.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LienJobHeading, LienJobNumber } from './LienJobNumber'

afterEach(cleanup)

describe('LienJobNumber', () => {
  it('with a door it is a button that opens the job and does not click the row around it', () => {
    const onOpen = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <LienJobNumber number="663" onOpen={onOpen} />
      </div>,
    )
    const number = screen.getByRole('button', { name: '663' })
    expect(number.getAttribute('title')).toBe('Open the job: its history, its bills and Edit')
    fireEvent.click(number)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('with no door it is the plain chip', () => {
    render(<LienJobNumber number="663" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('663').tagName).toBe('SPAN')
  })
})

describe('LienJobHeading', () => {
  it('with a door the whole line is the button (v2.4628), text that keeps the click to itself', () => {
    const onOpenJob = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <LienJobHeading label="663 · Knight Contracting- Taylor (GRAEF)" onOpenJob={onOpenJob} />
      </div>,
    )
    const door = screen.getByRole('button', { name: '663 · Knight Contracting- Taylor (GRAEF)' })
    expect(door.getAttribute('data-testid')).toBe('lien-job-heading')
    expect(door.className).toBe('lienJobDoor')
    expect(door.style.background).toBe('none')
    fireEvent.click(door)
    expect(onOpenJob).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('with no door it is the one bold line it always was', () => {
    const { container } = render(<LienJobHeading label="663 · Knight Contracting" />)
    expect(container.innerHTML).toBe('<strong style="font-size: 1rem;">663 · Knight Contracting</strong>')
  })

  it('a job with no name is its number alone', () => {
    render(<LienJobHeading label="663" onOpenJob={() => {}} />)
    expect(screen.getByTestId('lien-job-heading').textContent).toBe('663')
  })
  it('the number door is text too, not a chip (v2.4628): no fill, the row\u2019s color, underline by the class', () => {
    render(<LienJobNumber number="663" onOpen={() => {}} />)
    const door = screen.getByRole('button', { name: '663' })
    expect(door.className).toBe('lienJobDoor')
    expect(door.style.background).toBe('none')
    expect(door.style.color).toBe('inherit')
  })
})
