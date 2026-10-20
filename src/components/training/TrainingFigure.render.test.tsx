// @vitest-environment jsdom
/**
 * A figure in a lesson (punch list #116, v2.5598): every drawing in the registry renders as an image named
 * by its caption, inside a figure the page can find by name.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FIGURE_NAMES } from '../../lib/training/figures'
import { TrainingFigure } from './TrainingFigure'

afterEach(() => cleanup())

describe('TrainingFigure', () => {
  it.each(FIGURE_NAMES.map((n) => [n] as const))('%s draws an image named by its caption', (name) => {
    render(<TrainingFigure name={name} caption={`The ${name} caption.`} />)
    const img = screen.getByRole('img', { name: `The ${name} caption.` })
    expect(img.tagName.toLowerCase()).toBe('svg')
    expect(img.getAttribute('viewBox')).toMatch(/^0 0 300 \d+$/)
    const figure = document.querySelector(`figure[data-training-figure="${name}"]`)
    expect(figure?.querySelector('figcaption')?.textContent).toBe(`The ${name} caption.`)
  })
})
