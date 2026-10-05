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
  it('with a door the number is the button and the name stands beside it', () => {
    const onOpenJob = vi.fn()
    render(<LienJobHeading label="663 · Knight Contracting- Taylor (GRAEF)" onOpenJob={onOpenJob} />)
    expect(screen.getByTestId('lien-job-heading').textContent).toBe('663Knight Contracting- Taylor (GRAEF)')
    expect(screen.getByText('Knight Contracting- Taylor (GRAEF)').tagName).toBe('STRONG')
    fireEvent.click(screen.getByRole('button', { name: '663' }))
    expect(onOpenJob).toHaveBeenCalledTimes(1)
  })

  it('with no door it is the one bold line it always was', () => {
    const { container } = render(<LienJobHeading label="663 · Knight Contracting" />)
    expect(container.innerHTML).toBe('<strong style="font-size: 1rem;">663 · Knight Contracting</strong>')
  })

  it('a job with no name is its number alone', () => {
    render(<LienJobHeading label="663" onOpenJob={() => {}} />)
    expect(screen.getByTestId('lien-job-heading').textContent).toBe('663')
  })
})
