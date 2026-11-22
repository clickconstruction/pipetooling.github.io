// @vitest-environment jsdom
/**
 * A place's words in a list (punch list #413): one line as it is, and a long description as its
 * short form with a press that opens the whole of it and folds it again.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PaintedPlaceWords } from './PaintedPlaceWords'

const SEWER = '4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. It runs straight, under the left edge of the front walk. The old clay line is still in the ground beside it, capped at both ends.'

afterEach(() => cleanup())

describe('PaintedPlaceWords', () => {
  it('draws nothing for a place with no words', () => {
    const view = render(<PaintedPlaceWords words="  " />)
    expect(view.container.textContent).toBe('')
  })

  it('draws one line whole, with no press', () => {
    render(<PaintedPlaceWords words="Close it behind you." />)
    expect(screen.getByText('Close it behind you.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('[data-place-words]')?.getAttribute('data-place-words')).toBe('whole')
  })

  it('keeps the lines of a short description', () => {
    render(<PaintedPlaceWords words={'Garage.\nBehind the water heater.'} />)
    const text = document.querySelector('[data-place-words] > span') as HTMLElement
    expect(text.textContent).toBe('Garage.\nBehind the water heater.')
    expect(text.style.whiteSpace).toBe('pre-wrap')
  })

  it('cuts a long description, opens the whole of it on a press 44 px tall, and folds it again', () => {
    render(<PaintedPlaceWords words={SEWER} name="Buried sewer line" />)
    const wrap = document.querySelector('[data-place-words]') as HTMLElement
    expect(wrap.getAttribute('data-place-words')).toBe('short')
    expect(wrap.querySelector('span')?.textContent).toBe('4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. …')
    const more = screen.getByRole('button', { name: 'Read it all: Buried sewer line' }) as HTMLButtonElement
    expect(more.textContent).toBe('Read it all')
    expect(more.style.minHeight).toBe('44px')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(wrap.getAttribute('data-place-words')).toBe('whole')
    expect(wrap.querySelector('span')?.textContent).toBe(SEWER)
    const less = screen.getByRole('button', { name: 'Show less: Buried sewer line' })
    expect(less.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(less)
    expect(wrap.getAttribute('data-place-words')).toBe('short')
  })

  it('does not hand its press to the row it sits in', () => {
    let rowPresses = 0
    render(
      <div onClick={() => (rowPresses += 1)}>
        <PaintedPlaceWords words={SEWER} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Read it all' }))
    expect(rowPresses).toBe(0)
  })
})
