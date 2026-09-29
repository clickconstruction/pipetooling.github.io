// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BilledWordsLine, { billedWordsOverride } from './BilledWordsLine'
import type { BilledWordsLine as Line } from '../../lib/jobs/billedWordsLine'

const late: Line = {
  billed: 'Billed Sep 15',
  expect: '21 d past expected · they said Oct 3',
  action: 'new-date',
  tone: 'amber',
  title: 'Billed Sep 15 + this customer’s median pay speed (~21 days over 8 payments, last 12 months) → expected Oct 6 — Customer promised payment by Oct 3 (marked by Wendi)',
  full: 'Billed Sep 15 · 21 d past expected · they said Oct 3',
}

describe('BilledWordsLine (v2.4130)', () => {
  it('the expectation is the click: it opens They said… / New date… and stops the row click', () => {
    const onExpect = vi.fn()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BilledWordsLine line={late} onExpect={onExpect} />
      </div>,
    )
    expect(screen.getByTestId('billed-words-line').textContent).toBe('Billed Sep 15 · 21 d past expected · they said Oct 3')
    const btn = screen.getByRole('button', { name: '21 d past expected · they said Oct 3' })
    expect(btn.getAttribute('title')).toContain('click to record a new date the customer named')
    fireEvent.click(btn)
    expect(onExpect).toHaveBeenCalledTimes(1)
    expect(rowClick).not.toHaveBeenCalled()
  })

  it('without the right to record a promise the expectation is plain text with the math in its tooltip', () => {
    render(<BilledWordsLine line={{ ...late, action: 'they-said' }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('billed-words-expect').getAttribute('title')).toBe(late.title)
  })

  it('no expectation yet: the bill date alone', () => {
    render(<BilledWordsLine line={{ ...late, expect: null, full: 'Billed Sep 15' }} />)
    expect(screen.getByTestId('billed-words-line').textContent).toBe('Billed Sep 15')
    expect(screen.queryByTestId('billed-words-expect')).toBeNull()
  })

  it('billedWordsOverride hands the bar the tone and the whole sentence as its tooltip', () => {
    const o = billedWordsOverride(late)
    expect(o.tone).toBe('amber')
    expect(o.title).toBe(late.full)
  })
})
